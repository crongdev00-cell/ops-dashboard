// C열(진행 상태) 자동 계산 로직 — Y열과 AI~AW 날짜 필드로부터 실시간 파생.
export const STAGES = {
  N: { code: 'N', label: '미실시', color: '#9ca3af' },
  NA: { code: 'NA', label: '대상아님', color: '#cbd5e1' },
  AUTO: { code: 'Auto', label: 'PM요청 대기', color: '#a78bfa' },
  A: { code: 'A', label: 'PM작성중', color: '#60a5fa' },
  B: { code: 'B', label: '작성완료', color: '#38bdf8' },
  C: { code: 'C', label: 'CFT검토중', color: '#f5a524' },
  D: { code: 'D', label: '검토완료', color: '#34d399' },
  E: { code: 'E', label: '안내완료', color: '#22c55e' },
  F: { code: 'F', label: '결재완료', color: '#16a34a' },
}

export const REVIEW_METHODS = ['미실시', '전자결재', '심의회', '대상아님']

export const STEP_SEQUENCE = [
  { key: 'pmRequest', stage: 'A', label: 'PM 요청' },
  { key: 'pmComplete', stage: 'B', label: 'PM 작성완료' },
  { key: 'cftRequest', stage: 'C', label: 'CFT 검토 요청' },
  { key: 'sysManage', stage: 'D', label: '체계관리 검토' },
  { key: 'notice', stage: 'E', label: '안내' },
  { key: 'approval', stage: 'F', label: '결재완료' },
]

// 8(+대상아님)개 세부 단계를 원본 스프레드시트의 병합 헤더 기준 상위 3그룹으로 묶는다.
// 미실시/대상아님은 이 3그룹(AI~AW 진행 과정) 밖의 별도 상태라 그룹에 포함하지 않는다.
export const STAGE_GROUPS = [
  { key: 'notStarted', label: '미실시', codes: ['N'] },
  { key: 'pmWriting', label: '[PM] 작성 현황', codes: ['Auto', 'A', 'B'] },
  { key: 'cftReview', label: '[유관부서(CFT)] 검토 현황', codes: ['C', 'D'] },
  { key: 'noticeApproval', label: '안내 & 결재', codes: ['E', 'F'] },
  { key: 'na', label: '대상아님', codes: ['NA'] },
]

const hasDate = (v) => !!v

export function computeStage(record) {
  const y = (record.reviewMethod ?? '').trim()
  if (y === '대상아님') return STAGES.NA
  if (y === '미실시' || y === '') return STAGES.N

  if (y === '전자결재' || y === '심의회') {
    if (!hasDate(record.pmRequest)) return STAGES.AUTO
    if (!hasDate(record.pmComplete)) return STAGES.A
    if (!hasDate(record.cftRequest)) return STAGES.B
    if (!hasDate(record.sysManage)) return STAGES.C
    if (!hasDate(record.notice)) return STAGES.D
    if (!hasDate(record.approval)) return STAGES.E
    return STAGES.F
  }
  return STAGES.N
}

const ORDER = ['A', 'B', 'C', 'D', 'E', 'F']
export const TOTAL_STEPS = ORDER.length

// 0~6, 전체 6단계 중 도달한 위치.
export function stageProgress(record) {
  const stage = computeStage(record)
  const idx = ORDER.indexOf(stage.code)
  return idx === -1 ? 0 : idx + 1
}

export function stageProgressPct(record) {
  return Math.round((stageProgress(record) / TOTAL_STEPS) * 100)
}
