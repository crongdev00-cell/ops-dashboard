import XLSX from 'xlsx'

// 사업포털 다운로드 파일 전용 파서. 범용 열 추정이 아니라, 포털 양식의 실제 헤더 텍스트로
// 정확히 매칭한다 — 이 파일은 매번 같은 시스템(포털)에서 나오므로 헤더 이름이 안정적이다.
const HEADER_MAP = {
  계약번호: 'portalKey',
  '계약(사업)명': 'contractName',
  계약기관: 'contractOrg',
  계약방법: 'contractMethod',
  적용사업: 'appliedBusiness',
  사업형태: 'businessType',
  담당부서: 'deptName',
  '담당자(정)': 'bm',
  최초계약일자: 'contractDate',
  최종납기: 'dueDate',
  계약금액: 'amount',
}

function excelSerialToIso(n) {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000))
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

export function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') return excelSerialToIso(value)
  const d = new Date(value)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

export function parsePortalBuffer(buffer) {
  const head = buffer.subarray(0, 3)
  const hasUtf8Bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, ...(hasUtf8Bom ? {} : { codepage: 65001 }) })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const range = XLSX.utils.decode_range(ws['!ref'])
  const fullRange = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e })
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false, range: fullRange })

  const headerRowIndex = rows.findIndex((row) => row.includes('계약번호'))
  if (headerRowIndex === -1) {
    throw new Error('포털 파일 형식을 인식하지 못했습니다 ("계약번호" 헤더를 찾을 수 없음)')
  }
  const headerRow = rows[headerRowIndex]
  const colIndex = {}
  for (const [header, field] of Object.entries(HEADER_MAP)) {
    const idx = headerRow.indexOf(header)
    if (idx !== -1) colIndex[field] = idx
  }
  if (colIndex.portalKey === undefined || colIndex.contractName === undefined) {
    throw new Error('포털 파일에서 계약번호/계약(사업)명 열을 찾지 못했습니다.')
  }

  const records = []
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const portalKey = row[colIndex.portalKey]
    if (!portalKey) continue
    const rec = { portalKey: String(portalKey) }
    for (const field of Object.values(HEADER_MAP)) {
      if (field === 'portalKey') continue
      const idx = colIndex[field]
      const raw = idx === undefined ? null : row[idx]
      if (field === 'contractDate' || field === 'dueDate') rec[field] = normalizeDate(raw)
      else if (field === 'amount') {
        const n = raw === null ? null : Number(raw) / 1_000_000
        rec[field] = n === null || Number.isNaN(n) ? null : Math.round(n)
      }
      else rec[field] = raw === null || raw === '' ? null : String(raw).trim()
    }
    records.push(rec)
  }
  return records
}
