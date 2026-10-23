// C열(진행 상태) 자동 계산 로직 — Y열과 AI~AW 날짜 필드로부터 실시간 파생.
export const STAGES = {
  U: { code: 'U', label: '미지정', color: '#d1d5db' },
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

// "서면보고"/"대면보고"는 원래 '전자결재'/'심의회'였으나, 사용자가 헷갈린다고 해서 통일한 용어.
// 대면보고는 결재권자가 둘로 갈린다 — 손충금 사업이면 부문장, 그 외(무기체계/핵심기술 금액 기준 충족)는 연구개발본부장.
export const FACE_TO_FACE_SONCHUNGGEUM = '대면보고(부문장)'
export const FACE_TO_FACE_DEFAULT = '대면보고(연구개발본부장)'
export const REVIEW_METHODS = ['미지정', '미실시', '서면보고', FACE_TO_FACE_SONCHUNGGEUM, FACE_TO_FACE_DEFAULT, '대상아님']
const FACE_TO_FACE_METHODS = new Set([FACE_TO_FACE_SONCHUNGGEUM, FACE_TO_FACE_DEFAULT])

// 레거시 업로드에서 애초에 검토 대상이 아닌 CFT 부서("-" 표시)를 나타내는 값 — 날짜 없음(미입력)과
// 구분해야 CFT 게이트가 영원히 막히지 않는다. lib/legacyParser.js의 NOT_APPLICABLE과 같은 문자열이어야
// 한다(의도적 중복, 서버/클라 분리).
export const NOT_APPLICABLE = '해당없음'

// [유관부서(CFT)] 검토현황 — 8개 부서가 전부 완료(날짜 또는 해당없음)돼야 다음 단계(검토완료)로 넘어간다.
export const CFT_DEPT_FIELDS = [
  { key: 'cftAi', label: 'AI' },
  { key: 'cftSwTest', label: 'S/W 시험' },
  { key: 'cftPurchase', label: '개발 구매' },
  { key: 'cftQuality', label: '개발 품질' },
  { key: 'cftCostAnalysis', label: '원가 분석' },
  { key: 'cftMns', label: 'M&S' },
  { key: 'cftSystemEng', label: '체계공학' },
  { key: 'cftBizMgmt', label: '사업관리' },
]

export const STEP_SEQUENCE = [
  { key: 'pmRequest', stage: 'A', label: 'PM 요청' },
  { key: 'pmComplete', stage: 'B', label: 'PM 작성완료' },
  { key: 'cftRequest', stage: 'C', label: 'CFT 검토 요청' },
  { key: 'cftDepts', stage: 'D', label: '[유관부서(CFT)] 부서별 검토', keys: CFT_DEPT_FIELDS },
  { key: 'notice', stage: 'E', label: '안내' },
  { key: 'approval', stage: 'F', label: '결재완료' },
]

// 8(+대상아님)개 세부 단계를 원본 스프레드시트의 병합 헤더 기준 상위 3그룹으로 묶는다.
// 미지정/미실시/대상아님은 이 3그룹(AI~AW 진행 과정) 밖의 별도 상태라 그룹에 포함하지 않는다.
export const STAGE_GROUPS = [
  { key: 'unset', label: '미지정', codes: ['U'] },
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
  if (y === '미실시') return STAGES.N

  if (y === '서면보고' || FACE_TO_FACE_METHODS.has(y)) {
    if (!hasDate(record.pmRequest)) return STAGES.AUTO
    if (!hasDate(record.pmComplete)) return STAGES.A
    if (!hasDate(record.cftRequest)) return STAGES.B
    if (!CFT_DEPT_FIELDS.every((f) => hasDate(record[f.key]))) return STAGES.C
    if (!hasDate(record.notice)) return STAGES.D
    if (!hasDate(record.approval)) return STAGES.E
    return STAGES.F
  }
  // '미지정'이거나 빈 값, 또는 알 수 없는 값 — 아직 아무도 심의방법을 정하지 않은 상태.
  return STAGES.U
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
