import * as XLSX from 'xlsx'
import { computeStage } from './stage.js'

const HEADERS = {
  no: 'No.', contractName: '계약(사업)명', businessDivision: '사업부문', deptName: '부서', pm: 'PM', appliedBusiness: '적용사업',
  amount: '계약금액(백만원)', dueDate: '완료기한', reviewMethod: '심의방법', stage: '진행상태',
  pmRequest: 'PM요청', pmComplete: 'PM작성완료', cftRequest: 'CFT요청',
  sysManage: '체계관리', notice: '안내', approval: '결재완료', note: '비고', excluded: '제외됨',
}

export function exportRecordsToExcel(records, filename = '개발심의회_현황.xlsx') {
  const rows = records.map((r) => ({
    [HEADERS.no]: r.no,
    [HEADERS.contractName]: r.contractName,
    [HEADERS.businessDivision]: r.businessDivision,
    [HEADERS.deptName]: r.deptName,
    [HEADERS.pm]: r.pm,
    [HEADERS.appliedBusiness]: r.appliedBusiness,
    [HEADERS.amount]: r.amount,
    [HEADERS.dueDate]: r.dueDate,
    [HEADERS.reviewMethod]: r.reviewMethod,
    [HEADERS.stage]: computeStage(r).label,
    [HEADERS.pmRequest]: r.pmRequest,
    [HEADERS.pmComplete]: r.pmComplete,
    [HEADERS.cftRequest]: r.cftRequest,
    [HEADERS.sysManage]: r.sysManage,
    [HEADERS.notice]: r.notice,
    [HEADERS.approval]: r.approval,
    [HEADERS.note]: r.note,
    [HEADERS.excluded]: r.excluded ? 'Y' : 'N',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '현황')
  XLSX.writeFile(wb, filename)
}
