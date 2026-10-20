import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { classifyReviewMethod, FACE_TO_FACE_DEFAULT } from './classify.js'

const FACE_TO_FACE_SONCHUNGGEUM = '대면보고(부문장)'
// 구 엑셀 심의방법 값 중 이미 신규 스키마 값 그대로인 것들 — 이 값들은 그대로 받아들인다.
const LEGACY_REVIEW_METHOD_PASSTHROUGH = new Set(['미실시', '대상아님', '서면보고', FACE_TO_FACE_SONCHUNGGEUM, FACE_TO_FACE_DEFAULT])

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.OPS_DATA_DIR || path.join(__dirname, '..', 'data') // 테스트가 실데이터를 건드리지 않도록 오버라이드 가능
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json')

// 팀이 이 웹앱에서 직접 관리하는 필드. 포털 동기화는 이 필드들을 절대 건드리지 않는다.
export const TEAM_FIELDS = [
  'businessDivision', 'pm', 'pmDeptName', 'note', 'reviewMethod', 'chair', 'reviewDate', 'reviewResult', 'reviewContent',
  'pmRequest', 'pmDue', 'pmComplete', 'cftRequest',
  'cftAi', 'cftSwTest', 'cftPurchase', 'cftQuality', 'cftCostAnalysis', 'cftMns', 'cftSystemEng', 'cftBizMgmt',
  'notice', 'approval',
  'isSonchunggeum', 'classificationConfirmed',
]
// [유관부서(CFT)] 검토현황 — 8개 부서가 전부 완료돼야 다음 단계(검토완료)로 넘어간다. computeStage()에서도 이 목록을 쓴다.
export const CFT_DEPT_FIELDS = ['cftAi', 'cftSwTest', 'cftPurchase', 'cftQuality', 'cftCostAnalysis', 'cftMns', 'cftSystemEng', 'cftBizMgmt']
// 포털 동기화가 갱신하는 필드.
export const PORTAL_FIELDS = [
  'contractName', 'contractOrg', 'contractMethod', 'appliedBusiness', 'businessType', 'deptName', 'bm', 'contractDate', 'dueDate', 'amount',
]
// 국책사업 전용 포털 업로드가 갱신하는 필드. 계약번호 기반 PORTAL_FIELDS와는 별개 — syncGovPortal만 건드린다.
export const GOV_FIELDS = [
  'contractOrg', 'deptName', 'bm', 'contractDate', 'dueDate', 'amount',
  'govFundAmount', 'privateCashAmount', 'privateInKindAmount', 'privateTotalAmount',
  'govStage', 'govStatus', 'settlementType', 'participationType',
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
    govKey: null,
    projectType: '사업',
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
    portalKey: null, govKey: null, projectType: '사업', excluded: false, isNew: false,
    contractName: '', deptName: null, bm: null, contractOrg: null, contractMethod: null,
    appliedBusiness: null, businessType: null, contractDate: null, dueDate: null, amount: null,
    govFundAmount: null, privateCashAmount: null, privateInKindAmount: null, privateTotalAmount: null,
    govStage: null, govStatus: null, settlementType: null, participationType: null,
    businessDivision: '미래전장사업부문',
    pm: null, pmDeptName: null, note: null, reviewMethod: '미지정', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
    pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null,
    cftAi: null, cftSwTest: null, cftPurchase: null, cftQuality: null, cftCostAnalysis: null, cftMns: null, cftSystemEng: null, cftBizMgmt: null,
    notice: null, approval: null,
    // 수기로 직접 만든 안건은 자동판정 대상이 아니라서(포털 데이터가 없음) 확정할 것도 없다 —
    // "심의 대상 확정 필요" 목록에 안 뜨도록 처음부터 확정된 것으로 둔다.
    autoClassification: null, classificationReason: null, classificationConfirmed: true, isSonchunggeum: false,
    createdAt: now, updatedAt: now,
    ...data,
  }
  // 수기로 만든 안건이라도 사업형태/금액을 직접 지정했으면 포털 동기화와 똑같은 분류 로직을 적용한다 —
  // "확정 필요" 상태로 둬서 사람이 한 번 검토·확정하게 한다.
  if (data.businessType != null || data.amount != null) {
    const cls = classifyReviewMethod(rec.businessType, rec.amount)
    rec.autoClassification = cls.autoClassification
    rec.classificationReason = cls.classificationReason
    rec.classificationConfirmed = false
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
  // 사업형태나 금액이 바뀌면 1차 분류 추천값도 다시 계산한다 — 포털 동기화와 같은 로직.
  // 이미 "확정"해둔 추천값이라도 근거(사업형태/금액)가 바뀌면 그 확정은 더 이상 유효하지 않으므로
  // 다시 "확정 필요" 상태로 되돌린다.
  if ('businessType' in patch || 'amount' in patch) {
    const businessType = 'businessType' in patch ? patch.businessType : target.businessType
    const amount = 'amount' in patch ? patch.amount : target.amount
    const cls = classifyReviewMethod(businessType, amount)
    patch = { ...patch, ...cls, classificationConfirmed: false }
  }
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
  if (!entry || entry.field === '__created__' || entry.field === '__sync__' || entry.field === '__deleted__') return null
  return updateProject(entry.projectId, { [entry.field]: entry.from })
}

// 사용자가 직접 안건을 지우는 경우는 완전 삭제다(복원 불가) — 포털 재동기화가 내부적으로
// 쓰는 excluded 플래그(아래 syncPortal)와는 별개의 동작이다.
export function deleteProject(id) {
  const target = getProject(id)
  if (!target) return null
  const now = new Date().toISOString()
  projects = projects.filter((p) => p.id !== Number(id))
  writeJsonAtomic(PROJECTS_FILE, projects)
  logHistory([{ id: `${Date.now()}-d`, ts: now, projectId: Number(id), recordName: target.contractName, field: '__deleted__', from: null, to: null }])
  return { id: Number(id), deleted: true }
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
        // 포털 금액·사업형태가 바뀌면 1차 자동판정 추천값도 다시 계산한다 — 사람이 이미 "확정"한
        // reviewMethod/classificationConfirmed는 건드리지 않고, 추천 문구만 최신으로 갱신한다.
        const cls = classifyReviewMethod(portalPatch.businessType, portalPatch.amount)
        nextProjects[idx] = {
          ...existing, ...portalPatch,
          autoClassification: cls.autoClassification, classificationReason: cls.classificationReason,
          excluded: false, updatedAt: now,
        }
        updated++
      }
    } else {
      const cls = classifyReviewMethod(portalPatch.businessType, portalPatch.amount)
      const newRecord = {
        id: nextId++,
        portalKey: row.portalKey,
        govKey: null,
        projectType: '사업',
        excluded: false,
        isNew: true,
        businessDivision: null,
        pm: null, pmDeptName: null, note: null, reviewMethod: '미지정', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
        pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null,
        cftAi: null, cftSwTest: null, cftPurchase: null, cftQuality: null, cftCostAnalysis: null, cftMns: null, cftSystemEng: null, cftBizMgmt: null,
        notice: null, approval: null,
        autoClassification: cls.autoClassification, classificationReason: cls.classificationReason,
        classificationConfirmed: false, isSonchunggeum: false,
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

// 국책사업 전용 포털 업로드 — 계약번호(portalKey)가 아니라 내부관리번호(govKey)가 키다.
// syncPortal과 거의 동일한 구조지만 금액/사업형태 기준 자동분류는 안 한다(이 양식엔 안 맞음) —
// 대신 심의방법 기본값을 서면보고(전자결재)로 고정한다(사용자 요청).
export function syncGovPortal(govRows) {
  const now = new Date().toISOString()
  const byKey = new Map((projects ?? []).filter((p) => p.govKey).map((p) => [p.govKey, p]))
  const seenKeys = new Set()
  let created = 0, updated = 0
  const logs = []

  const nextProjects = [...(projects ?? [])]

  for (const row of govRows) {
    seenKeys.add(row.govKey)
    const existing = byKey.get(row.govKey)
    const govPatch = Object.fromEntries(GOV_FIELDS.map((f) => [f, row[f] ?? null]))

    if (existing) {
      const idx = nextProjects.findIndex((p) => p.id === existing.id)
      const changed = GOV_FIELDS.some((f) => existing[f] !== govPatch[f]) || existing.excluded
      if (changed) {
        nextProjects[idx] = { ...existing, ...govPatch, excluded: false, updatedAt: now }
        updated++
      }
    } else {
      const newRecord = {
        id: nextId++,
        portalKey: null,
        govKey: row.govKey,
        projectType: '국책사업',
        excluded: false,
        isNew: true,
        contractName: row.contractName ?? '', contractMethod: null, appliedBusiness: null, businessType: null, bm: null,
        businessDivision: null,
        // 국책사업은 기본 심의방법을 서면보고(구 "전자결재")로 둔다 — 사용자 요청, 답변 참고.
        pm: row.pm ?? null, pmDeptName: null, note: null, reviewMethod: '서면보고', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
        pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null,
        cftAi: null, cftSwTest: null, cftPurchase: null, cftQuality: null, cftCostAnalysis: null, cftMns: null, cftSystemEng: null, cftBizMgmt: null,
        notice: null, approval: null,
        autoClassification: '서면보고', classificationReason: '국책사업 기본 적용(전자결재)',
        classificationConfirmed: true, isSonchunggeum: false,
        createdAt: now, updatedAt: now,
        ...govPatch,
      }
      nextProjects.push(newRecord)
      byKey.set(row.govKey, newRecord)
      created++
    }
  }

  // govKey 기준 제외 처리 — portalKey 기준 제외 루프와 섞이지 않게 별도로 돈다.
  let excluded = 0
  for (const p of nextProjects) {
    if (p.govKey && !seenKeys.has(p.govKey) && !p.excluded) {
      p.excluded = true
      p.updatedAt = now
      excluded++
    }
  }

  projects = nextProjects
  writeJsonAtomic(PROJECTS_FILE, projects)
  if (created > 0 || updated > 0 || excluded > 0) {
    logHistory([{
      id: `${Date.now()}-govsync`, ts: now, projectId: null, recordName: '(국책사업 동기화)',
      field: '__sync__', from: null, to: `신규 ${created} · 갱신 ${updated} · 제외 ${excluded}`,
    }])
  }
  return { created, updated, excluded, total: govRows.length }
}

// 레거시 업로드(migrateLegacyRows) 직전에 호출 — 잘못 올렸을 때 파일째로 되돌릴 수 있는 마지막 안전망.
export function backupDataFiles() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(DATA_DIR, `backup_${stamp}`)
  fs.mkdirSync(dir, { recursive: true })
  for (const file of [PROJECTS_FILE, HISTORY_FILE, COMMENTS_FILE]) {
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(dir, path.basename(file)))
  }
  return dir
}

// 구 엑셀(안건 관리 시트) 업로드 — 포털 동기화와 정반대 성격: PORTAL_FIELDS는 절대 건드리지 않고
// TEAM_FIELDS만 채운다. row는 lib/legacyParser.js가 만든 형태를 그대로 받는다.
// updateProject/createProject를 행마다 호출하면 그때그때 파일을 쓰게 되는데, 수십 행만 돼도
// 아주 짧은 시간에 projects.json/history.json을 연속으로 rename하다가 Windows에서
// EPERM(파일 잠금 충돌)이 난다 — syncPortal처럼 메모리에서 전부 처리한 뒤 딱 한 번씩만 저장한다.
export function migrateLegacyRows(legacyRows) {
  const now = new Date().toISOString()
  const byKey = new Map((projects ?? []).filter((p) => p.portalKey).map((p) => [p.portalKey, p]))
  const nextProjects = [...(projects ?? [])]
  const logs = []
  let matched = 0, created = 0
  const unrecognizedReviewMethod = []

  for (const row of legacyRows) {
    const existing = row.portalKey ? byKey.get(row.portalKey) : null

    // 심의방법은 그대로 옮기면 안 된다 — 구 엑셀은 대면보고(부문장)/(연구개발본부장) 구분이 생기기
    // 전 값("심의회")을 쓰므로, 위원장(chair) 텍스트로 어느 쪽인지 판단한다. 판단 안 되면 필드 자체를
    // 건드리지 않고(=미지정 유지) 리포트에 플래그만 남긴다.
    let reviewMethod
    if (row.reviewMethod === '심의회') {
      const chair = row.chair ?? ''
      if (chair.includes('부문장')) reviewMethod = FACE_TO_FACE_SONCHUNGGEUM
      else if (chair.includes('대표이사') || chair.includes('본부장')) reviewMethod = FACE_TO_FACE_DEFAULT
      else unrecognizedReviewMethod.push({ contractName: row.contractName, raw: row.reviewMethod, chair: row.chair })
    } else if (LEGACY_REVIEW_METHOD_PASSTHROUGH.has(row.reviewMethod)) {
      reviewMethod = row.reviewMethod
    } else if (row.reviewMethod) {
      unrecognizedReviewMethod.push({ contractName: row.contractName, raw: row.reviewMethod, chair: row.chair })
    }

    const teamPatch = {}
    for (const field of TEAM_FIELDS) {
      if (field === 'reviewMethod') continue
      if (row[field] != null) teamPatch[field] = row[field]
    }
    if (reviewMethod) teamPatch.reviewMethod = reviewMethod

    if (existing) {
      const patch = { ...teamPatch, classificationConfirmed: true }
      const idx = nextProjects.findIndex((p) => p.id === existing.id)
      const entries = Object.entries(patch).filter(([k, v]) => existing[k] !== v)
      for (const [field, value] of entries) {
        logs.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ts: now, projectId: existing.id, recordName: existing.contractName, field, from: existing[field], to: value, actor: null,
        })
      }
      nextProjects[idx] = { ...existing, ...patch, updatedAt: now }
      matched++
    } else {
      const note = row.note ? `[이관-미매칭, 수동확인 필요] ${row.note}` : '[이관-미매칭, 수동확인 필요]'
      const businessType = row.businessType ?? null
      const amount = row.amount ?? null
      const cls = classifyReviewMethod(businessType, amount)
      const rec = {
        id: nextId++,
        portalKey: null, govKey: null, projectType: '사업', excluded: false, isNew: false,
        contractName: row.contractName, deptName: null, bm: null,
        contractOrg: row.contractOrg ?? null, contractMethod: row.contractMethod ?? null,
        appliedBusiness: row.appliedBusiness ?? null, businessType, contractDate: row.contractDate ?? null, dueDate: row.dueDate ?? null, amount,
        businessDivision: '미래전장사업부문',
        pm: null, pmDeptName: null, note: null, reviewMethod: '미지정', chair: null, reviewDate: null, reviewResult: null, reviewContent: null,
        pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null,
        cftAi: null, cftSwTest: null, cftPurchase: null, cftQuality: null, cftCostAnalysis: null, cftMns: null, cftSystemEng: null, cftBizMgmt: null,
        notice: null, approval: null,
        autoClassification: cls.autoClassification, classificationReason: cls.classificationReason,
        isSonchunggeum: false,
        createdAt: now, updatedAt: now,
        ...teamPatch, note, classificationConfirmed: false,
      }
      nextProjects.push(rec)
      logs.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-c`, ts: now, projectId: rec.id, recordName: rec.contractName, field: '__created__', from: null, to: null })
      created++
    }
  }

  projects = nextProjects
  writeJsonAtomic(PROJECTS_FILE, projects)
  logHistory(logs)
  return { matched, created, unrecognizedReviewMethod, total: legacyRows.length }
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
