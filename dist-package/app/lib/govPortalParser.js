import XLSX from 'xlsx'
import { normalizeDate } from './portalParser.js'

// 국책사업 전용 포털 양식. 3행 병합 헤더라 텍스트 탐색이 불안정하므로 고정 열 인덱스로 읽는다
// (legacyParser.js와 같은 전략). 열 순서는 gov_project_sample_template.xlsx 기준.
const COLUMN_INDEX = {
  govStage: 0,       // 관리단계
  govStatus: 1,       // 상태
  contractName: 2,    // 협약명
  settlementType: 4,  // 정산종류 (사업단계=idx3은 자동분류에 안 쓰므로 매핑 생략)
  govKey: 5,          // 내부관리번호 — 키
  contractDate: 6,    // 협약일
  dueDate: 7,         // 완료일
  contractOrg: 8,     // 전담기관
  participationType: 9, // 주관/참여
  govFundAmount: 10,
  privateCashAmount: 11,
  privateInKindAmount: 12,
  privateTotalAmount: 13,
  amount: 14,          // 사업비 합계 — 대표 금액으로 재사용
  deptName: 15,        // 담당부서 = BM 부서 (일반 사업의 deptName과 같은 의미)
  bm: 16,               // 담당자 = BM 담당자 (일반 사업의 bm과 같은 의미)
  pm: 17,
}

const AMOUNT_FIELDS = new Set(['govFundAmount', 'privateCashAmount', 'privateInKindAmount', 'privateTotalAmount', 'amount'])
const DATE_FIELDS = new Set(['contractDate', 'dueDate'])

function cleanText(v) {
  if (v === null || v === undefined || v === '') return null
  return String(v).trim()
}

export function parseGovBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  const headerRow = rows[0]
  if (!headerRow || cleanText(headerRow[COLUMN_INDEX.govKey]) !== '내부관리번호') {
    throw new Error('국책사업 양식을 인식하지 못했습니다 ("내부관리번호" 열 위치가 예상과 다름)')
  }

  const records = []
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const govKey = cleanText(row[COLUMN_INDEX.govKey])
    if (!govKey) continue
    const rec = { govKey }
    for (const [field, idx] of Object.entries(COLUMN_INDEX)) {
      if (field === 'govKey') continue
      const raw = row[idx]
      if (DATE_FIELDS.has(field)) rec[field] = normalizeDate(raw)
      else if (AMOUNT_FIELDS.has(field)) {
        // 국책사업 포털 양식의 금액은 원 단위 — portalParser.js와 동일하게 백만원으로 변환한다
        // (버그 수정: 이 변환이 빠져있어서 국책사업 계약금액이 원 단위로 저장되고 있었음).
        const n = raw === null || raw === '' ? null : Number(raw) / 1_000_000
        rec[field] = n === null || Number.isNaN(n) ? null : Math.round(n)
      } else rec[field] = cleanText(raw)
    }
    records.push(rec)
  }
  return records
}
