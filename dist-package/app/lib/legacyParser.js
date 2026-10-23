import XLSX from 'xlsx'
import { normalizeDate } from './portalParser.js'

// original_management_data_template.xlsx 전용 파서. 포털 파일과 달리 이 파일은 3행짜리
// 병합 헤더라 헤더 텍스트만으로 열을 안정적으로 찾기 어렵다 — 그래서 "계약번호"(사용자가 직접
// 추가하는 열) 하나만 헤더 텍스트로 찾고, 나머지는 템플릿의 고정 열 위치(0-인덱스)로 읽는다.
// 열 순서가 달라진 실파일이 들어오면 조용히 엉뚱한 값을 읽는 대신 바로 에러를 내도록
// EXPECTED_HEADER_HINTS로 핵심 열 몇 개의 헤더 텍스트를 검증한다.
const COLUMN_INDEX = {
  contractName: 2,
  appliedBusiness: 3, contractOrg: 4, contractMethod: 5, businessType: 6,
  contractDate: 9, dueDate: 10, amount: 12,
  pmDeptName: 15, pm: 16,
  note: 20, // 특기사항
  reviewMethod: 22, chair: 23, reviewDate: 24, reviewResult: 25,
  reviewContent: 30, // 검토 내용
  pmRequest: 32, pmDue: 33, pmComplete: 34,
  cftRequest: 36,
  cftAi: 37, cftSwTest: 38, cftPurchase: 39, cftQuality: 40,
  cftCostAnalysis: 41, cftMns: 42, cftSystemEng: 43, cftBizMgmt: 44,
  notice: 45, approval: 46,
}
// 연구기획 검토 결과 그룹의 나머지 참고 항목(매출원가율/위험실무위/변동) — 전용 필드가 없어
// note에 라벨만 붙여 그대로 보존한다.
const NOTE_EXTRA_COLUMNS = [
  { idx: 27, label: '매출원가율(%)' },
  { idx: 28, label: '위험실무위' },
  { idx: 29, label: '변동' },
]
const EXPECTED_HEADER_HINTS = {
  2: '계약(사업)명', 22: '심의방법', 32: '요청', 37: 'AI', 45: '안내',
}
const DATE_FIELDS = new Set([
  'contractDate', 'dueDate', 'reviewDate',
  'pmRequest', 'pmDue', 'pmComplete', 'cftRequest',
  'cftAi', 'cftSwTest', 'cftPurchase', 'cftQuality', 'cftCostAnalysis', 'cftMns', 'cftSystemEng', 'cftBizMgmt',
  'notice', 'approval',
])

function cleanText(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === '-' ? null : s
}

function headerCellText(headerRows, col) {
  return headerRows.map((row) => row[col]).filter((v) => v !== null && v !== undefined).join('')
}

export function parseLegacyBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
  if (rows.length < 4) {
    throw new Error('구 엑셀 형식을 인식하지 못했습니다 (3행짜리 헤더 + 데이터 행이 필요합니다).')
  }

  const headerRows = rows.slice(0, 3)
  for (const [idx, hint] of Object.entries(EXPECTED_HEADER_HINTS)) {
    if (!headerCellText(headerRows, Number(idx)).includes(hint)) {
      throw new Error(`구 엑셀 형식이 예상과 다릅니다 (${idx}번째 열에서 "${hint}"를 찾지 못했습니다) — 템플릿 구조를 확인해주세요.`)
    }
  }

  // 사용자가 직접 추가한 "계약번호" 열은 위치가 고정돼 있지 않으니 헤더 텍스트로 찾는다.
  // "내부관리번호" 열은 국책사업 행(계약번호가 없음)을 구분하기 위한 선택 열 — 없어도 에러 안 냄.
  let contractKeyIdx = -1
  let govKeyIdx = -1
  for (let c = 0; c < Math.max(...headerRows.map((r) => r.length)); c++) {
    const text = headerCellText(headerRows, c)
    if (contractKeyIdx === -1 && text.includes('계약번호')) contractKeyIdx = c
    if (govKeyIdx === -1 && text.includes('내부관리번호')) govKeyIdx = c
  }
  if (contractKeyIdx === -1) {
    throw new Error('"계약번호" 열을 찾지 못했습니다. 구 엑셀에 계약번호 열을 추가한 뒤 업로드해주세요.')
  }

  const records = []
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((v) => v === null || v === '')) continue
    const contractName = cleanText(row[COLUMN_INDEX.contractName])
    if (!contractName) continue // 빈 행

    const portalKey = cleanText(row[contractKeyIdx])
    const govKey = portalKey ? null : (govKeyIdx === -1 ? null : cleanText(row[govKeyIdx]))
    const rec = { portalKey, govKey, projectType: govKey ? '국책사업' : '사업', contractName }
    for (const [field, idx] of Object.entries(COLUMN_INDEX)) {
      if (field === 'contractName') continue
      const raw = row[idx]
      if (DATE_FIELDS.has(field)) rec[field] = normalizeDate(raw)
      else if (field === 'amount') {
        // 구 엑셀 헤더가 이미 "계약금액(백만원)"이므로 포털 파서처럼 100만으로 나누면 안 된다.
        const n = raw === null || raw === '' ? null : Number(raw)
        rec[field] = n === null || Number.isNaN(n) ? null : Math.round(n)
      } else {
        rec[field] = cleanText(raw)
      }
    }

    const noteParts = []
    if (rec.note) noteParts.push(`[특기사항] ${rec.note}`)
    for (const { idx, label } of NOTE_EXTRA_COLUMNS) {
      const raw = row[idx]
      const v = typeof raw === 'number' ? String(Math.round(raw * 1000) / 1000) : cleanText(raw)
      if (v) noteParts.push(`[${label}] ${v}`)
    }
    rec.note = noteParts.length ? noteParts.join('\n') : null

    records.push(rec)
  }
  return records
}
