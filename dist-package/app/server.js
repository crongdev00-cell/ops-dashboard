import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { parsePortalBuffer } from './lib/portalParser.js'
import { parseGovBuffer } from './lib/govPortalParser.js'
import { parseLegacyBuffer } from './lib/legacyParser.js'
import { parseCompletionBuffer } from './lib/completionReportParser.js'
import * as store from './lib/store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// data/projects.json이 아예 없으면(지워졌으면) 진짜로 빈 상태로 시작한다 — 더미데이터로
// 자동 채워넣지 않는다. 예시 데이터 20건을 다시 보고 싶으면 data/projects.json 자체를
// (client/src/lib/dummyData.js 기반으로) 다시 만들어 넣어야 한다.
if (!store.isSeeded()) {
  store.seedProjects([])
  console.log('data/projects.json이 없어 빈 상태로 시작합니다.')
}

// 사내 서버마다 "기본 주소"만 주거나 이미 완전한 OpenAI 호환 엔드포인트를 주기도 한다.
// 둘 다 안전하게 처리해서 /v1/chat/completions가 빠지거나 두 번 붙는 걸 막는다.
function joinChatUrl(base) {
  const value = String(base || '').trim().replace(/\/+$/, '')
  if (!value) return null
  if (/\/(?:v1\/)?chat\/completions$/i.test(value)) return value
  if (/\/v1$/i.test(value)) return `${value}/chat/completions`
  return `${value}/v1/chat/completions`
}

// 세 모델 모두 OpenAI 호환 /v1/chat/completions 형식으로 호출한다.
const MODEL_CONFIGS = {
  gemini: {
    label: 'Gemini (외부 · 비식별 데이터 전용)',
    url: process.env.GEMINI_API_URL,
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  },
  gemma: {
    label: 'Gemma (사내)',
    url: process.env.GEMMA_API_URL || joinChatUrl(process.env.GEMMA_API_BASE_URL),
    key: process.env.GEMMA_API_KEY,
    model: process.env.GEMMA_MODEL,
    maxTokens: Number(process.env.GEMMA_MAX_TOKENS) || undefined,
  },
  qwen: {
    label: 'Qwen (사내)',
    url: process.env.QWEN_API_URL || joinChatUrl(process.env.QWEN_API_BASE_URL),
    key: process.env.QWEN_API_KEY,
    model: process.env.QWEN_MODEL,
    maxTokens: Number(process.env.QWEN_MAX_TOKENS) || undefined,
    thinking: String(process.env.QWEN_THINKING).toLowerCase() === 'true',
  },
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/llm/models', (req, res) => {
  res.json(
    Object.entries(MODEL_CONFIGS).map(([id, c]) => ({
      id,
      label: c.label,
      configured: Boolean(c.url && c.model && c.key),
    }))
  )
})

app.post('/api/llm/chat', async (req, res) => {
  const { model, messages } = req.body ?? {}
  const config = MODEL_CONFIGS[model]
  if (!config) return res.status(400).json({ error: `알 수 없는 모델: ${model}` })
  if (!config.url || !config.model) return res.status(400).json({ error: `${config.label} 설정이 비어 있습니다 (.env 확인).` })
  if (!config.key) return res.status(400).json({ error: `${config.label} API 키가 설정되지 않았습니다.` })

  try {
    const upstream = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0,
        // .env의 GEMMA_MAX_TOKENS(100000) 등은 모델의 "컨텍스트 한도" 참고용 값이지,
        // 매 요청에 그대로 보낼 값이 아니다 — 사내 vLLM/TGI류 게이트웨이는 비현실적으로 큰
        // max_tokens를 그대로 받으면 400/500으로 거부하는 경우가 많다 (계측기 프로젝트에서 확인된 패턴).
        max_tokens: Math.min(config.maxTokens || 4096, 4096),
        ...(config.thinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
      }),
      signal: AbortSignal.timeout(60_000), // 사내 게이트웨이가 응답 없이 멈추면 무한 대기하지 않도록
    })
    const rawText = await upstream.text()
    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      // 사내망에서 흔한 경우: 주소가 틀렸거나 인증 게이트웨이가 끼어들어 JSON 대신 HTML/텍스트 응답이 온다.
      // 원인 모를 "Unexpected token" 대신, 실제로 뭐가 왔는지 앞부분을 보여줘야 진단이 된다.
      const snippet = rawText.slice(0, 300).replace(/\s+/g, ' ').trim()
      return res.status(502).json({
        error: `${config.label} 서버가 JSON이 아닌 응답을 반환했습니다 (HTTP ${upstream.status}). URL·인증정보를 확인하세요. 응답 앞부분: ${snippet || '(빈 응답)'}`,
      })
    }
    if (!upstream.ok) {
      // data.error.message가 없는 서버도 많다 — 그럴 땐 실제로 뭐가 왔는지 그대로 보여줘야 원인을 알 수 있다.
      const detail = data?.error?.message || JSON.stringify(data).slice(0, 300)
      return res.status(upstream.status).json({ error: `${config.label} 호출 실패 (HTTP ${upstream.status}): ${detail}` })
    }
    const content = data?.choices?.[0]?.message?.content ?? ''
    res.json({ content })
  } catch (err) {
    const message = err.name === 'TimeoutError' ? '응답 시간(60초)을 초과했습니다.' : err.message
    res.status(500).json({ error: `${config.label} 연결 실패: ${message}` })
  }
})

// ── 안건(project) CRUD ─────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  res.json({ records: store.getProjects() })
})

app.post('/api/projects', (req, res) => {
  try {
    const rec = store.createProject(req.body ?? {})
    res.status(201).json(rec)
  } catch (err) {
    res.status(500).json({ error: `안건 생성 실패: ${err.message}` })
  }
})

app.put('/api/projects/:id', (req, res) => {
  try {
    const updated = store.updateProject(req.params.id, req.body ?? {})
    if (!updated) return res.status(404).json({ error: '안건을 찾을 수 없습니다.' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: `안건 수정 실패: ${err.message}` })
  }
})

app.delete('/api/projects/:id', (req, res) => {
  try {
    const updated = store.deleteProject(req.params.id)
    if (!updated) return res.status(404).json({ error: '안건을 찾을 수 없습니다.' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: `안건 삭제 실패: ${err.message}` })
  }
})

// ── 사업포털 동기화 ─────────────────────────────────────────────
// base64로 JSON에 실어 보내면(예전 방식) 파일 크기가 1.3배로 불어나고, 원본 버퍼·base64
// 문자열·디코딩된 버퍼까지 메모리에 동시에 떠 있게 된다 — 실제 사업포털처럼 큰 엑셀(수만 건)에서
// 이게 서버가 응답 없이 멈추거나(대용량 처리 중 다운) 죽는 원인이 됐다. 파일을 그대로(바이너리)
// 받으면 이런 불필요한 배증이 없다.
app.post('/api/projects/sync', express.raw({ type: '*/*', limit: '80mb' }), (req, res) => {
  const buffer = req.body
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return res.status(400).json({ error: '파일 데이터가 없습니다.' })
  try {
    const portalRows = parsePortalBuffer(buffer)
    const summary = store.syncPortal(portalRows)
    res.json({ summary, records: store.getProjects() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── 국책사업 전용 포털 업로드 ───────────────────────────────────
// 계약번호가 아니라 내부관리번호(govKey)가 키인 별도 양식. GOV_FIELDS만 갱신.
app.post('/api/projects/sync-gov', express.raw({ type: '*/*', limit: '80mb' }), (req, res) => {
  const buffer = req.body
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return res.status(400).json({ error: '파일 데이터가 없습니다.' })
  try {
    const govRows = parseGovBuffer(buffer)
    const summary = store.syncGovPortal(govRows)
    res.json({ summary, records: store.getProjects() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── 구 엑셀(안건 관리 시트) 업로드 ───────────────────────────────
// 포털 동기화와 반대 방향: TEAM_FIELDS만 채우고 PORTAL_FIELDS는 절대 건드리지 않는다.
// 실데이터 업로드라 매번 시작 전에 자동 백업을 떠둔다(사용자가 따로 신경 안 써도 되게).
app.post('/api/projects/migrate-legacy', express.raw({ type: '*/*', limit: '80mb' }), (req, res) => {
  const buffer = req.body
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return res.status(400).json({ error: '파일 데이터가 없습니다.' })
  try {
    const legacyRows = parseLegacyBuffer(buffer)
    const backupDir = store.backupDataFiles()
    const summary = store.migrateLegacyRows(legacyRows)
    res.json({ summary, backupDir, records: store.getProjects() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── 완료보고 업로드 ──────────────────────────────────────────────
// 고유 키가 없는 양식이라 매번 전부 신규 생성한다(매칭/갱신 없음, 사용자 확인).
app.post('/api/projects/import-completion', express.raw({ type: '*/*', limit: '80mb' }), (req, res) => {
  const buffer = req.body
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return res.status(400).json({ error: '파일 데이터가 없습니다.' })
  try {
    const rows = parseCompletionBuffer(buffer)
    const summary = store.importCompletionReport(rows)
    res.json({ summary, records: store.getProjects() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── 변경 이력 / 되돌리기 ────────────────────────────────────────
app.get('/api/history', (req, res) => res.json({ history: store.getHistory() }))

app.post('/api/history/:id/undo', (req, res) => {
  try {
    const updated = store.undoHistoryEntry(req.params.id)
    if (!updated) return res.status(404).json({ error: '되돌릴 수 없는 항목입니다.' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: `되돌리기 실패: ${err.message}` })
  }
})

// ── 댓글 ───────────────────────────────────────────────────────
app.get('/api/comments', (req, res) => res.json({ comments: store.getComments() }))

app.post('/api/comments', (req, res) => {
  const { projectId, author, text } = req.body ?? {}
  if (!projectId || !text?.trim()) return res.status(400).json({ error: 'projectId와 text가 필요합니다.' })
  try {
    res.status(201).json(store.addComment(projectId, author, text))
  } catch (err) {
    res.status(500).json({ error: `댓글 저장 실패: ${err.message}` })
  }
})

// 위 라우트들에서 놓친 예외(예: express.json()이 깨진 JSON 본문을 만났을 때)가
// 기본 Express 에러 페이지(HTML)로 새서 클라이언트 JSON 파싱을 깨지 않도록 하는 안전망.
app.use((err, req, res, _next) => {
  console.error('[server] 처리되지 않은 오류:', err)
  res.status(500).json({ error: `서버 오류: ${err.message}` })
})

// client/dist가 빌드되어 있으면(운영 배포) 정적 파일도 이 서버가 같이 서빙한다.
// 폐쇄망에서는 이 방식이면 Vite/Node 개발 도구 없이 Node + 빌드 산출물만으로 실행 가능하다.
const CLIENT_DIST = path.join(__dirname, 'client', 'dist')
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST))
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')))
}

const PORT = process.env.PORT || 4000
// 127.0.0.1(자기 자신)로만 열어야 Windows 방화벽이 "네트워크 접근 허용" 경고를 띄우지 않는다 —
// 외부 PC에서 접속할 필요 없는 로컬 테스트용 배포이므로 모든 인터페이스에 열 이유가 없다.
app.listen(PORT, '127.0.0.1', () => console.log(`서버 실행 중 → http://localhost:${PORT}`))
