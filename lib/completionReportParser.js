import XLSX from 'xlsx'
import { normalizeDate } from './portalParser.js'

// 완료보고(개발완료보고) 전용 업로드 양식. 3행 병합 헤더 + 고정 열 인덱스로 읽는다
// (govPortalParser.js와 같은 전략). 열 순서는 sample-data/original_complete_report_data_template.xlsx 기준.
// 진행 단계는 텍스트 라벨(0번 열)을 쓰지 않고 날짜 필드로 역산한다(client/src/lib/stage.js의
// computeCompletionDerivedStage 참고) — comp* 이름은 개발심의회 레코드가 완료보고로 넘어왔을 때
// pmRequest 등 기존 필드와 겹치지 않도록 일부러 분리한 이름이다.
const COLUMN_INDEX = {
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
  compPmRequest: 32,
  compPmDue: 33,
  compPmComplete: 34,
  compCftRequest: 36,
  compCftQuality: 37,
  compCftCostAnalysis: 38,
  compNotice: 39,
  compApproval: 40,
}

const DATE_FIELDS = new Set(['contractDate', 'dueDate', 'compPmRequest', 'compPmDue', 'compPmComplete', 'compCftRequest', 'compCftQuality', 'compCftCostAnalysis', 'compNotice', 'compApproval'])

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
      if (field === 'contractName') continue
      const raw = row[idx]
      if (DATE_FIELDS.has(field)) rec[field] = normalizeDate(raw)
      else if (field === 'amount') {
        const n = raw === null || raw === '' ? null : Number(raw) / 1_000_000
        rec[field] = n === null || Number.isNaN(n) ? null : Math.round(n)
      } else rec[field] = cleanText(raw)
    }

    records.push(rec)
  }
  return records
}
