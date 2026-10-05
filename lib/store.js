import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.OPS_DATA_DIR || path.join(__dirname, '..', 'data') // 테스트가 실데이터를 건드리지 않도록 오버라이드 가능
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json')

// 팀이 이 웹앱에서 직접 관리하는 필드. 포털 동기화는 이 필드들을 절대 건드리지 않는다.
export const TEAM_FIELDS = [
  'businessDivision', 'pm', 'note', 'reviewMethod', 'chair', 'reviewDate', 'reviewResult', 'reviewContent',
  'pmRequest', 'pmDue', 'pmComplete', 'cftRequest', 'sysManage', 'notice', 'approval',
]
// 포털 동기화가 갱신하는 필드.
export const PORTAL_FIELDS = [
  'contractName', 'contractOrg', 'contractMethod', 'appliedBusiness', 'businessType', 'deptName', 'bm', 'contractDate', 'dueDate', 'amount',
]

// missing(파일이 아예 없음)과 corrupt(있는데 깨짐)를 구분한다 — 이 둘을 같은 값으로 취급하면
// "손상된 실제 데이터"가 "아직 시드 안 된 상태"로 오인되어 더미데이터로 조용히 덮어써질 수 있다.
function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return { value: fallback, corrupt: false }
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), corrupt: false }
  } catch (err) {
    console.error(`[store] ${filePath} 파싱 실패, 손상된 파일일 수 있습니다:`, err.message)
    return { value: fallback, corrupt: true }
  }
}

// 임시 파일에 먼저 쓰고 이름을 바꿔치기(원자적 교체) — 저장 도중 문제가 생겨도 원본이 깨지지 않는다.
function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

const projectsLoad = readJson(PROJECTS_FILE, null)
if (projectsLoad.corrupt) {
  // projects.json이 손상된 채로 서버를 계속 띄우면 다음 줄의 isSeeded() 체크가 "시드 안 됨"으로
  // 오판해서 실제 데이터를 더미데이터로 덮어쓸 수 있다 — 그런 조용한 데이터 유실보다는
  // 서버가 아예 뜨지 않는 게 훨씬 안전하다. data/projects.json.tmp나 백업에서 복구한 뒤 재시작할 것.
  throw new Error(`data/projects.json이 손상되어 서버를 시작할 수 없습니다. 파일을 확인/복구한 뒤 다시 시작하세요.`)
}
let projects = projectsLoad.value
let history = readJson(HISTORY_FILE, []).value
let comments = readJson(COMMENTS_FILE, []).value
let nextId = projects ? Math.max(0, ...projects.map((p) => p.id)) + 1 : 1

export function isSeeded() {
  return projects !== null
}

export function seedProjects(records) {
  const now = new Date().toISOString()
  projects = records.map((r, i) => ({
    id: i + 1,
    portalKey: null,
    excluded: false,
    isNew: false,
    createdAt: now,
    updatedAt: now,
    businessDivision: '미래전장사업부문',
    ...r,
  }))
  nextId = projects.length + 1
  writeJsonAtomic(PROJECTS_FILE, projects)
}

export function getProjects() {
  return projects ?? []
}

export function getProject(id) {
  return (projects ?? []).find((p) => p.id === Number(id))
}

function logHistory(entries) {
  if (entries.length === 0) return
  history = [...history, ...entries].slice(-2000)
  writeJsonAtomic(HISTORY_FILE, history)
}

export function getHistory() {
  return history
}

export function createProject(data) {
  const now = new Date().toISOString()
  const rec = {
    id: nextId++,
    portalKey: null, excluded: false, isNew: false,
    contractName: '', deptName: null, bm: null, contractOrg: null, contractMethod: null,
    appliedBusiness: null, businessType: null, contractDate: null, dueDate: null, amount: null,
    businessDivision: '미래전장사업부문',
    pm: null, note: null, reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
    pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
    createdAt: now, updatedAt: now,
    ...data,
  }
  projects = [...(projects ?? []), rec]
  writeJsonAtomic(PROJECTS_FILE, projects)
  logHistory([{ id: `${Date.now()}-c`, ts: now, projectId: rec.id, recordName: rec.contractName, field: '__created__', from: null, to: null }])
  return rec
}

export function updateProject(id, patch, actor = null) {
  const target = getProject(id)
  if (!target) return null
  const now = new Date().toISOString()
  const entries = Object.entries(patch).filter(([k, v]) => k !== 'isNew' && target[k] !== v)
  const logs = entries.map(([field, value]) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: now, projectId: id, recordName: target.contractName, field, from: target[field], to: value, actor,
  }))
  const updated = { ...target, ...patch, updatedAt: now }
  projects = projects.map((p) => (p.id === Number(id) ? updated : p))
  writeJsonAtomic(PROJECTS_FILE, projects)
  logHistory(logs)
  return updated
}

// 되돌리기: history 항목 하나를 골라 그 필드를 from 값으로 되돌린다.
export function undoHistoryEntry(historyId) {
  const entry = history.find((h) => h.id === historyId)
  if (!entry || entry.field === '__created__' || entry.field === '__sync__') return null
  return updateProject(entry.projectId, { [entry.field]: entry.from })
}

export function deleteProject(id) {
  return updateProject(id, { excluded: true })
}

export function syncPortal(portalRows) {
  const now = new Date().toISOString()
  const byKey = new Map((projects ?? []).map((p) => [p.portalKey, p]))
  const seenKeys = new Set()
  let created = 0, updated = 0
  const logs = []

  const nextProjects = [...(projects ?? [])]

  for (const row of portalRows) {
    seenKeys.add(row.portalKey)
    const existing = byKey.get(row.portalKey)
    const portalPatch = Object.fromEntries(PORTAL_FIELDS.map((f) => [f, row[f] ?? null]))

    if (existing) {
      const idx = nextProjects.findIndex((p) => p.id === existing.id)
      const changed = PORTAL_FIELDS.some((f) => existing[f] !== portalPatch[f]) || existing.excluded
      if (changed) {
        nextProjects[idx] = { ...existing, ...portalPatch, excluded: false, updatedAt: now }
        updated++
      }
    } else {
      const newRecord = {
        id: nextId++,
        portalKey: row.portalKey,
        excluded: false,
        isNew: true,
        businessDivision: null,
        pm: null, note: null, reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
        pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
        createdAt: now, updatedAt: now,
        ...portalPatch,
      }
      nextProjects.push(newRecord)
      byKey.set(row.portalKey, newRecord) // 같은 업로드 안에 계약번호가 중복되면 이후 행은 새로 만들지 않고 이 레코드에 병합되어야 한다
      created++
    }
  }

  // 포털에 더 이상 없는 항목은 제외됨 처리(삭제 아님).
  let excluded = 0
  for (const p of nextProjects) {
    if (p.portalKey && !seenKeys.has(p.portalKey) && !p.excluded) {
      p.excluded = true
      p.updatedAt = now
      excluded++
    }
  }

  projects = nextProjects
  writeJsonAtomic(PROJECTS_FILE, projects)
  if (created > 0 || updated > 0 || excluded > 0) {
    logHistory([{
      id: `${Date.now()}-sync`, ts: now, projectId: null, recordName: '(포털 동기화)',
      field: '__sync__', from: null, to: `신규 ${created} · 갱신 ${updated} · 제외 ${excluded}`,
    }])
  }
  return { created, updated, excluded, total: portalRows.length }
}

// ponytail: projects.json/history.json/comments.json은 각각 원자적으로 저장되지만, 두 파일에
//걸친 쓰기(예: 안건 수정 + 이력 기록)는 하나의 트랜잭션이 아니다. 그 사이에 프로세스가 죽으면
// 안건 데이터는 반영되고 이력 한 줄만 유실될 수 있다. 지금 규모(사내 소수 인원, 수백 건)에서는
// 감수할 만한 리스크로 보고 넘어간다 — 필요해지면 두 파일을 하나의 저장 단위로 합치면 된다.

export function markSeen(id) {
  return updateProject(id, { isNew: false })
}

export function getComments() {
  return comments
}

export function addComment(projectId, author, text) {
  const mentions = [...text.matchAll(/@([^\s@]+)/g)].map((m) => m[1])
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId, author: author?.trim() || '익명', text: text.trim(), mentions, ts: new Date().toISOString(),
  }
  comments = [...comments, entry]
  writeJsonAtomic(COMMENTS_FILE, comments)
  return entry
}
