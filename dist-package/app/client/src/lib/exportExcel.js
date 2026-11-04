import * as XLSX from 'xlsx'
import { computeStage, logicalDate } from './stage.js'

const HEADERS = {
  no: 'No.', contractName: '계약(사업)명', businessDivision: '사업부문', deptName: 'BM 부서', bm: 'BM 이름',
  pm: 'PM', pmDeptName: 'PM 부서', appliedBusiness: '적용사업',
  amount: '계약금액(백만원)', dueDate: '완료기한', reviewMethod: '심의방법', stage: '진행상태',
  pmRequest: 'PM요청', pmComplete: 'PM작성완료', cftRequest: 'CFT요청',
  cftAi: 'CFT-AI', cftSwTest: 'CFT-S/W시험', cftPurchase: 'CFT-개발구매', cftQuality: 'CFT-개발품질',
  cftCostAnalysis: 'CFT-원가분석', cftMns: 'CFT-M&S', cftSystemEng: 'CFT-체계공학', cftBizMgmt: 'CFT-사업관리',
  notice: '안내', approval: '결재완료', note: '비고', excluded: '제외됨',
}

export function exportRecordsToExcel(records, filename = '개발심의회_현황.xlsx') {
  const rows = records.map((r) => ({
    [HEADERS.no]: r.no,
    [HEADERS.contractName]: r.contractName,
    [HEADERS.businessDivision]: r.businessDivision,
    [HEADERS.deptName]: r.deptName,
    [HEADERS.bm]: r.bm,
    [HEADERS.pm]: r.pm,
    [HEADERS.pmDeptName]: r.pmDeptName,
    [HEADERS.appliedBusiness]: r.appliedBusiness,
    [HEADERS.amount]: r.amount,
    [HEADERS.dueDate]: r.dueDate,
    [HEADERS.reviewMethod]: r.reviewMethod,
    [HEADERS.stage]: computeStage(r).label,
    // 완료보고 레코드는 이 날짜들이 review 필드가 아니라 comp* 필드에 들어있다(stage.js 참고) —
    // logicalDate가 레코드 종류에 맞는 필드를 골라 읽는다. CFT 8부서 중 완료보고에 없는 6개는
    // 완료보고 레코드에서 항상 비어있는 게 맞다(해당 개념 자체가 없음).
    [HEADERS.pmRequest]: logicalDate(r, 'pmRequest'),
    [HEADERS.pmComplete]: logicalDate(r, 'pmComplete'),
    [HEADERS.cftRequest]: logicalDate(r, 'cftRequest'),
    [HEADERS.cftAi]: r.cftAi,
    [HEADERS.cftSwTest]: r.cftSwTest,
    [HEADERS.cftPurchase]: r.cftPurchase,
    [HEADERS.cftQuality]: logicalDate(r, 'cftQuality'),
    [HEADERS.cftCostAnalysis]: logicalDate(r, 'cftCostAnalysis'),
    [HEADERS.cftMns]: r.cftMns,
    [HEADERS.cftSystemEng]: r.cftSystemEng,
    [HEADERS.cftBizMgmt]: r.cftBizMgmt,
    [HEADERS.notice]: logicalDate(r, 'notice'),
    [HEADERS.approval]: logicalDate(r, 'approval'),
    [HEADERS.note]: r.note,
    [HEADERS.excluded]: r.excluded ? 'Y' : 'N',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '현황')
  XLSX.writeFile(wb, filename)
}
