import XLSX from 'xlsx'
import { normalizeDate } from './portalParser.js'

// 완료보고(개발완료보고) 전용 업로드 양식. 3행 병합 헤더 + 고정 열 인덱스로 읽는다
// (govPortalParser.js와 같은 전략). 열 순서는 sample-data/original_complete_report_data_template.xlsx 기준.
const COLUMN_INDEX = {
  stageLabel: 0,       // 진행 단계(텍스트) — PM작성중/작성완료/CFT검토중/안내완료/결재완료/미실시
  contractName: 2,
  appliedBusiness: 3,
  contractOrg: 4,
  contractMethod: 5,
  businessType: 6,
  projectStage: 7,      // "사업단계" — 완료보고 전용 값셋(국책사업 govStage와는 다른 개념)
  contractDate: 9,
  dueDate: 10,
  amount: 13,           // 당사 투자 금액 — 원 단위로 들어와서 백만원으로 변환
  labName: 15,
  pm: 16,
  deptName: 17,
  bm: 18,
  reviewMethod: 22,
  pmRequest: 32,
  pmDue: 33,
  pmComplete: 34,
  cftRequest: 36,
  cftQuality: 37,
  cftCostAnalysis: 38,
  notice: 39,
  approval: 40,
}

const DATE_FIELDS = new Set(['contractDate', 'dueDate', 'pmRequest', 'pmDue', 'pmComplete', 'cftRequest', 'cftQuality', 'cftCostAnalysis', 'notice', 'approval'])

// 완료보고 엑셀의 "진행 단계" 라벨은 우리 STAGES 라벨과 1:1 매칭된다(D/NA/CANCEL은 이 템플릿에 없음).
const STAGE_LABEL_TO_CODE = {
  'PM작성중': 'A',
  '작성완료': 'B',
  'CFT검토중': 'C',
  '안내완료': 'E',
  '결재완료': 'F',
  '미실시': 'N',
}

// 이 날짜 이전에 납기가 지난 완료보고 건은 이미 끝난 지 오래라 더는 관리할 필요가 없다 —
// 업로드된 진행 단계 값과 무관하게 전부 미실시로 강제한다(사용자 요청).
export const UNMANAGED_CUTOFF_DATE = '2025-12-29'

function cleanText(v) {
  if (v === null || v === undefined || v === '') return null
  return String(v).trim()
}

export function parseCompletionBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  const titleRow = rows[1]
  if (!titleRow || cleanText(titleRow[0]) !== '개발완료보고') {
    throw new Error('완료보고 양식을 인식하지 못했습니다 ("개발완료보고" 제목 위치가 예상과 다름)')
  }

  const records = []
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const contractName = cleanText(row[COLUMN_INDEX.contractName])
    if (!contractName) continue

    const rec = { contractName }
    for (const [field, idx] of Object.entries(COLUMN_INDEX)) {
      if (field === 'contractName' || field === 'stageLabel') continue
      const raw = row[idx]
      if (DATE_FIELDS.has(field)) rec[field] = normalizeDate(raw)
      else if (field === 'amount') {
        const n = raw === null || raw === '' ? null : Number(raw) / 1_000_000
        rec[field] = n === null || Number.isNaN(n) ? null : Math.round(n)
      } else rec[field] = cleanText(raw)
    }

    const stageLabel = cleanText(row[COLUMN_INDEX.stageLabel])
    const mappedCode = stageLabel ? STAGE_LABEL_TO_CODE[stageLabel] : undefined
    rec.stageOverride = (rec.dueDate && rec.dueDate < UNMANAGED_CUTOFF_DATE) ? 'N' : (mappedCode ?? 'U')

    records.push(rec)
  }
  return records
}
