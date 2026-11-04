import { computeStage, logicalDate } from './stage.js'

export async function askLlm(model, messages) {
  let res
  try {
    res = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages }),
    })
  } catch {
    // fetch 자체가 실패하는 건 서버 응답이 아니라 백엔드에 연결조차 안 됐다는 뜻이다.
    throw new Error('백엔드 서버에 연결할 수 없습니다. `npm run dev`(또는 `npm run server`)로 백엔드가 켜져 있는지 확인하세요.')
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다 (HTTP ${res.status}).`)
  }
  if (!res.ok) throw new Error(data.error || 'LLM 호출 실패')
  return data.content
}

export function buildRecordsContext(records) {
  return records.map((r) => ({
    id: r.id, no: r.no, name: r.contractName, dept: r.deptName, pm: r.pm,
    businessDivision: r.businessDivision, isNew: r.isNew, excluded: r.excluded,
    amount: r.amount, reviewMethod: r.reviewMethod, stage: computeStage(r).label, dueDate: r.dueDate,
    // 완료보고 레코드는 이 날짜들이 review 필드가 아니라 comp* 필드에 들어있다(stage.js 참고) —
    // logicalDate가 레코드 종류에 맞는 필드를 골라 AI에게 정확한 날짜를 전달한다.
    pmRequest: logicalDate(r, 'pmRequest'), pmComplete: logicalDate(r, 'pmComplete'), cftRequest: logicalDate(r, 'cftRequest'),
    cftAi: r.cftAi, cftSwTest: r.cftSwTest, cftPurchase: r.cftPurchase, cftQuality: logicalDate(r, 'cftQuality'),
    cftCostAnalysis: logicalDate(r, 'cftCostAnalysis'), cftMns: r.cftMns, cftSystemEng: r.cftSystemEng, cftBizMgmt: r.cftBizMgmt,
    notice: logicalDate(r, 'notice'), approval: logicalDate(r, 'approval'),
  }))
}
