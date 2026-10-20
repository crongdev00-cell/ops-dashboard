// 프론트엔드 내부 더미 데이터 20건 — R&D 개발심의회 안건 시나리오.
// 날짜는 ISO 문자열(YYYY-MM-DD) 또는 null. C열 상태는 저장하지 않고 stage.js에서 실시간 계산한다.
//
// 날짜는 절대 달력 날짜가 아니라 "오늘로부터 n일 전/후"로 생성한다. 절대 날짜로 박아두면
// 시간이 지날수록(혹은 실행 시점의 시스템 날짜가 달라질수록) 모든 진행 중 안건이 똑같이
// "몇 달째 방치된 것"처럼 보여서 정체/완료기한 초과 같은 기능의 변별력이 사라지기 때문이다.
const MS_DAY = 86400000
const daysAgo = (n) => new Date(Date.now() - n * MS_DAY).toISOString().slice(0, 10)
const daysFromNow = (n) => daysAgo(-n)

let seq = 1
const rec = (o) => ({ id: seq++, no: seq - 1, ...o })

export function createDummyData() {
  return [
    // ── 미실시 (3건) ──────────────────────────────────────────────
    rec({
      contractName: '전고체 배터리 선행 연구기획', appliedBusiness: '청상어', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: '연구기획팀', pmDeptName: '연구기획팀', pm: '김도현', bm: '이현우',
      labName: '에너지연구소', amount: 3200, contractDate: daysAgo(200), dueDate: daysFromNow(160),
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '연구소 내부 검토 단계, 심의 일정 미확정',
    }),
    rec({
      contractName: '차량용 반도체 신뢰성 시험 체계', appliedBusiness: '천궁', contractOrg: '외부수탁',
      contractMethod: '일반경쟁계약', businessType: '수탁연구', deptName: '신뢰성시험팀', pmDeptName: '신뢰성시험팀', pm: '한소희', bm: '오태양',
      labName: '신뢰성연구소', amount: 1800, contractDate: daysAgo(160), dueDate: daysFromNow(220),
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '예산 확정 대기 중',
    }),
    rec({
      contractName: '스마트 팩토리 계측 데이터 플랫폼', appliedBusiness: 'TACM', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '구매전략팀', pmDeptName: '체계개발팀', pm: '배지훈', bm: '박준혁',
      labName: '생산기술연구소', amount: 150, contractDate: daysAgo(90), dueDate: daysFromNow(60),
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '타 부서 협의 진행 중 (소규모 파일럿)',
    }),

    // ── Auto: 심의 승인됐지만 PM 요청 전 (2건) ───────────────────────
    rec({
      contractName: '고전압 배터리 계측기 정밀도 개선', appliedBusiness: '비궁', contractOrg: 'ㄱ계측기술원',
      contractMethod: '일반확정계약', businessType: '민수', deptName: '전장시스템1팀', pmDeptName: '전장시스템1팀', pm: '이서연', bm: '최유나',
      labName: '에너지연구소', amount: 2100, contractDate: daysAgo(60), dueDate: daysFromNow(120),
      reviewMethod: '서면보고', chair: '본부장', reviewDate: daysAgo(12), reviewResult: '조건부승인',
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: 'PM 배정 완료, 착수 준비 중',
    }),
    rec({
      contractName: 'V2X 통신 모듈 개발기획', appliedBusiness: '신궁', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: '전장시스템2팀', pmDeptName: '전장시스템2팀', pm: '정민석', bm: '한소희',
      labName: '통신연구소', amount: 1650, contractDate: daysAgo(200), dueDate: daysFromNow(90),
      reviewMethod: '대면보고(부문장)', chair: '부문장', reviewDate: daysAgo(150), reviewResult: '승인',
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '승인된 지 오래됐는데 PM 요청이 안 걸림, 확인 필요',
    }),

    // ── PM작성중 (3건: 최근 착수 / 정체 / 경계값) ─────────────────────
    rec({
      contractName: '차세대 ADAS 센서퓨전 알고리즘 개발', appliedBusiness: '현궁', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: 'SW플랫폼팀', pmDeptName: 'AI융합연구소', pm: '최유나', bm: '김도현',
      labName: 'AI연구소', amount: 4200, contractDate: daysAgo(40), dueDate: daysFromNow(150),
      reviewMethod: '대면보고(연구개발본부장)', chair: '대표이사', reviewDate: daysAgo(20), reviewResult: '승인',
      pmRequest: daysAgo(5), pmDue: daysFromNow(9), pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: 'PM 작성 진행 중 (착수 5일차, 정상 진행)',
    }),
    rec({
      contractName: '전동화 파워트레인 효율 개선', appliedBusiness: '홍상어', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '전장시스템1팀', pmDeptName: '전장시스템1팀', pm: '박준혁', bm: '이서연',
      labName: '파워트레인연구소', amount: 2750, contractDate: daysAgo(90), dueDate: daysAgo(20),
      reviewMethod: '서면보고', chair: '1본부장', reviewDate: daysAgo(70), reviewResult: '승인',
      pmRequest: daysAgo(45), pmDue: daysAgo(32), pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: 'PM 작성 45일째 정체, 완료기한도 이미 지남',
    }),
    rec({
      contractName: '라이다 센서 국산화 기술 검토', appliedBusiness: '해성', contractOrg: 'ㄴ광학연구원',
      contractMethod: '일반경쟁계약', businessType: '수탁연구', deptName: 'AI융합연구소', pmDeptName: 'AI융합연구소', pm: '오태양', bm: '정민석',
      labName: '광학연구소', amount: 3800, contractDate: daysAgo(60), dueDate: daysFromNow(200),
      reviewMethod: '대면보고(부문장)', chair: '부문장', reviewDate: daysAgo(40), reviewResult: '승인',
      pmRequest: daysAgo(9), pmDue: daysFromNow(5), pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '해외 협력사 협의 병행 (정체 임계값 근처)',
    }),

    // ── 작성완료 (2건: 정체 / 최근) ────────────────────────────────
    rec({
      contractName: '전기차 열관리 시스템 개발심의', appliedBusiness: '비룡', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '전장시스템2팀', pmDeptName: '전장시스템1팀', pm: '김도현', bm: '배지훈',
      labName: '열관리연구소', amount: 1980, contractDate: daysAgo(100), dueDate: daysAgo(40),
      reviewMethod: '서면보고', chair: '2본부장', reviewDate: daysAgo(80), reviewResult: '승인',
      pmRequest: daysAgo(35), pmDue: daysAgo(20), pmComplete: daysAgo(22), cftRequest: null, sysManage: null, notice: null, approval: null,
      note: 'PM 작성 완료, CFT 요청 대기 (22일째)',
    }),
    rec({
      contractName: '차량용 디스플레이 신뢰성 평가', appliedBusiness: '천룡', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '신뢰성시험팀', pmDeptName: '신뢰성시험팀', pm: '이서연', bm: '한소희',
      labName: '신뢰성연구소', amount: 1120, contractDate: daysAgo(50), dueDate: daysFromNow(180),
      reviewMethod: '대면보고(연구개발본부장)', chair: '본부장', reviewDate: daysAgo(30), reviewResult: '승인',
      pmRequest: daysAgo(10), pmDue: daysFromNow(4), pmComplete: daysAgo(4), cftRequest: null, sysManage: null, notice: null, approval: null,
      note: null,
    }),

    // ── CFT검토중 (2건: 정체 / 최근) ───────────────────────────────
    rec({
      contractName: 'AI 기반 품질검사 자동화 및 스마트 공정 이상탐지 통합 심의 (1단계 파일럿)',
      appliedBusiness: '흑표', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: 'AI융합연구소', pmDeptName: 'AI융합연구소', pm: '최유나', bm: '오태양',
      labName: 'AI연구소', amount: 2600, contractDate: daysAgo(110), dueDate: daysAgo(15),
      reviewMethod: '서면보고', chair: '부문장', reviewDate: daysAgo(90), reviewResult: '승인',
      pmRequest: daysAgo(45), pmDue: daysAgo(30), pmComplete: daysAgo(35), cftRequest: daysAgo(28), sysManage: null, notice: null, approval: null,
      note: 'CFT 검토 28일째 정체 (긴 안건명 UI 확인용)',
    }),
    rec({
      contractName: '무선 BMS 통신 프로토콜 검증', appliedBusiness: '레드백', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '전장시스템1팀', pmDeptName: '전장시스템2팀', pm: '정민석', bm: '박준혁',
      labName: '에너지연구소', amount: 1450, contractDate: daysAgo(60), dueDate: daysFromNow(210),
      reviewMethod: '대면보고(연구개발본부장)', chair: '대표이사', reviewDate: daysAgo(40), reviewResult: '승인',
      pmRequest: daysAgo(20), pmDue: daysAgo(6), pmComplete: daysAgo(12), cftRequest: daysAgo(6), sysManage: null, notice: null, approval: null,
      note: null,
    }),

    // ── 검토완료 (2건: 심각 정체 / 최근) ─────────────────────────────
    rec({
      contractName: '전장 부품 공급망 리스크 분석', appliedBusiness: '울산급', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '구매전략팀', pmDeptName: '구매전략팀', pm: '배지훈', bm: '최유나',
      labName: '경영연구소', amount: 780, contractDate: daysAgo(130), dueDate: daysAgo(60),
      reviewMethod: '서면보고', chair: '1본부장', reviewDate: daysAgo(110), reviewResult: '승인',
      pmRequest: daysAgo(70), pmDue: daysAgo(56), pmComplete: daysAgo(60), cftRequest: daysAgo(55), sysManage: daysAgo(50), notice: null, approval: null,
      note: '체계관리 검토 50일째로 가장 오래 정체된 안건',
    }),
    rec({
      contractName: '자율주행 HW 레퍼런스 보드 기획', appliedBusiness: '세종대왕급', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: 'SW플랫폼팀', pmDeptName: 'SW플랫폼팀', pm: '한소희', bm: '김도현',
      labName: 'AI연구소', amount: 3500, contractDate: daysAgo(70), dueDate: daysFromNow(140),
      reviewMethod: '대면보고(부문장)', chair: '부문장', reviewDate: daysAgo(50), reviewResult: '승인',
      pmRequest: daysAgo(25), pmDue: daysAgo(11), pmComplete: daysAgo(20), cftRequest: daysAgo(15), sysManage: daysAgo(9), notice: null, approval: null,
      note: null,
    }),

    // ── 안내완료 (2건: 정체 / 아슬아슬하게 지연) ───────────────────────
    rec({
      contractName: '배터리 셀 열폭주 방지 연구', appliedBusiness: '장보고-III', contractOrg: 'ㄷ화학연구소',
      contractMethod: '일반경쟁계약', businessType: '수탁연구', deptName: '품질보증팀', pmDeptName: '신뢰성시험팀', pm: '오태양', bm: '이서연',
      labName: '에너지연구소', amount: 2900, contractDate: daysAgo(90), dueDate: daysAgo(10),
      reviewMethod: '서면보고', chair: '2본부장', reviewDate: daysAgo(70), reviewResult: '승인',
      pmRequest: daysAgo(40), pmDue: daysAgo(26), pmComplete: daysAgo(35), cftRequest: daysAgo(30), sysManage: daysAgo(25), notice: daysAgo(18), approval: null,
      note: '안내 완료, 결재 대기 18일째',
    }),
    rec({
      contractName: '차세대 인포테인먼트 UX 플랫폼', appliedBusiness: 'K9', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: 'SW플랫폼팀', pmDeptName: 'SW플랫폼팀', pm: '박준혁', bm: '정민석',
      labName: 'UX연구소', amount: 2200, contractDate: daysAgo(60), dueDate: daysAgo(5),
      reviewMethod: '대면보고(연구개발본부장)', chair: '본부장', reviewDate: daysAgo(45), reviewResult: '승인',
      pmRequest: daysAgo(25), pmDue: daysAgo(11), pmComplete: daysAgo(20), cftRequest: daysAgo(15), sysManage: daysAgo(10), notice: daysAgo(3), approval: null,
      note: '거의 다 왔는데 완료기한을 5일 넘김',
    }),

    // ── 결재완료 (4건: 완료된 지 다양한 기간) ─────────────────────────
    rec({
      contractName: '전장 SW 플랫폼 표준화 1단계', appliedBusiness: 'K2', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '선행연구', deptName: '전장시스템2팀', pmDeptName: '전장시스템2팀', pm: '최유나', bm: '한소희',
      labName: '통신연구소', amount: 3100, contractDate: daysAgo(165), dueDate: daysAgo(90),
      reviewMethod: '서면보고', chair: '부문장', reviewDate: daysAgo(158), reviewResult: '승인',
      pmRequest: daysAgo(150), pmDue: daysAgo(136), pmComplete: daysAgo(140), cftRequest: daysAgo(132), sysManage: daysAgo(124), notice: daysAgo(118), approval: daysAgo(110),
      note: '결재 완료, 사후관리 단계',
    }),
    rec({
      contractName: '계측기 관리 효율화 시스템 구축', appliedBusiness: '천무', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '구매전략팀', pmDeptName: '체계개발팀', pm: '김도현', bm: '오태양',
      labName: '생산기술연구소', amount: 1350, contractDate: daysAgo(245), dueDate: daysAgo(170),
      reviewMethod: '대면보고(연구개발본부장)', chair: '대표이사', reviewDate: daysAgo(238), reviewResult: '승인',
      pmRequest: daysAgo(230), pmDue: daysAgo(216), pmComplete: daysAgo(220), cftRequest: daysAgo(212), sysManage: daysAgo(204), notice: daysAgo(196), approval: daysAgo(190),
      note: null,
    }),
    rec({
      contractName: '신뢰성 시험 자동화 장비 도입', appliedBusiness: '백두', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '신뢰성시험팀', pmDeptName: '신뢰성시험팀', pm: '이서연', bm: '배지훈',
      labName: '신뢰성연구소', amount: 12000, contractDate: daysAgo(315), dueDate: daysAgo(240),
      reviewMethod: '서면보고', chair: '1본부장', reviewDate: daysAgo(308), reviewResult: '승인',
      pmRequest: daysAgo(300), pmDue: daysAgo(286), pmComplete: daysAgo(290), cftRequest: daysAgo(282), sysManage: daysAgo(274), notice: daysAgo(266), approval: daysAgo(260),
      note: '결재 완료 (대형 장비 CAPEX)',
    }),
    rec({
      contractName: '연구노트 전자화 시스템 고도화', appliedBusiness: '금강', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '민수', deptName: '연구기획팀', pmDeptName: '연구기획팀', pm: '정민석', bm: '최유나',
      labName: '경영연구소', amount: 890, contractDate: daysAgo(375), dueDate: daysAgo(300),
      reviewMethod: '대면보고(부문장)', chair: '부문장', reviewDate: daysAgo(368), reviewResult: '승인',
      pmRequest: daysAgo(360), pmDue: daysAgo(346), pmComplete: daysAgo(350), cftRequest: daysAgo(342), sysManage: daysAgo(334), notice: daysAgo(326), approval: daysAgo(320),
      note: '결재 완료',
    }),

    // ── 포털 동기화 예시 (5건) — 실제로는 portalKey가 있고, 1차 분류(추천 분류)가 자동으로
    // 채워진 채 들어온다. 위 20건은 전부 수기 등록 스타일이라 portalKey가 없고 1차 분류 UI 자체가
    // 안 뜨는데, 그것만으로는 방금 추가한 "1차 분류" 기능을 데모에서 전혀 확인할 수 없어서
    // 포털에서 막 동기화된 상태를 흉내 낸 예시를 별도로 추가한다. 분류 기준은 lib/classify.js와
    // 반드시 같은 값으로 맞춰야 한다(무기체계 300억원↑/핵심기술 150억원↑ → 대면보고(연구개발본부장), 그 외 서면보고).
    rec({
      contractName: '차세대 유도무기 요격체계 선행연구', appliedBusiness: '천궁-II 수출', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '연구개발(무기체계)', deptName: '체계개발팀', pmDeptName: '구매전략팀', pm: null, bm: '정하늘',
      labName: '체계연구소', amount: 32_000, contractDate: daysAgo(5), dueDate: daysFromNow(360),
      portalKey: 'KT-DEMO-021', isNew: true, businessDivision: null,
      autoClassification: '대면보고(연구개발본부장)', classificationReason: '무기체계 300억원 이상', classificationConfirmed: false, isSonchunggeum: false,
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '방금 포털 동기화로 들어온 예시 — 1차 분류(추천 분류) 확정 전 상태',
    }),
    rec({
      contractName: '차세대 전자광학 센서 핵심기술 연구', appliedBusiness: '해룡', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '연구개발(핵심기술)', deptName: '핵심기술팀', pmDeptName: '핵심기술팀', pm: null, bm: '서지우',
      labName: '광학연구소', amount: 16_000, contractDate: daysAgo(3), dueDate: daysFromNow(300),
      portalKey: 'KT-DEMO-022', isNew: true, businessDivision: null,
      autoClassification: '대면보고(연구개발본부장)', classificationReason: '핵심기술 150억원 이상', classificationConfirmed: false, isSonchunggeum: false,
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: null,
    }),
    rec({
      contractName: '스마트 물류관리 시스템 고도화', appliedBusiness: '무인수상정', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '연구개발(민수)', deptName: 'SW플랫폼팀', pmDeptName: 'SW플랫폼팀', pm: null, bm: '한여름',
      labName: 'SW연구소', amount: 450, contractDate: daysAgo(4), dueDate: daysFromNow(200),
      portalKey: 'KT-DEMO-023', isNew: true, businessDivision: null,
      autoClassification: '서면보고', classificationReason: '기준 금액 미만 (서면보고 기본 적용)', classificationConfirmed: false, isSonchunggeum: false,
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: null,
    }),
    rec({
      contractName: '계측장비 정기 정비 용역', appliedBusiness: '대포병탐지레이더', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '운영유지(정비/수리부속)', deptName: '구매전략팀', pmDeptName: '체계개발팀', pm: null, bm: '윤가을',
      labName: null, amount: 60, contractDate: daysAgo(2), dueDate: daysFromNow(90),
      portalKey: 'KT-DEMO-024', isNew: true, businessDivision: null,
      autoClassification: '서면보고', classificationReason: '기준 금액 미만 (서면보고 기본 적용)', classificationConfirmed: false, isSonchunggeum: false,
      reviewMethod: '미실시', chair: null, reviewDate: null, reviewResult: null,
      pmRequest: null, pmDue: null, pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '사업형태가 "운영유지(정비/수리부속)"라 미실시 참고 문구가 같이 뜨는 예시',
    }),
    rec({
      contractName: '국방 통신체계 긴급 보강사업', appliedBusiness: '홍상어-II', contractOrg: '자체연구',
      contractMethod: '수의계약', businessType: '연구개발(무기체계)', deptName: '전장시스템1팀', pmDeptName: '전장시스템1팀', pm: '이도윤', bm: '강바다',
      labName: '통신연구소', amount: 31_000, contractDate: daysAgo(20), dueDate: daysFromNow(340),
      portalKey: 'KT-DEMO-025', isNew: false, businessDivision: '미래전장사업부문',
      autoClassification: '대면보고(연구개발본부장)', classificationReason: '무기체계 300억원 이상', classificationConfirmed: true, isSonchunggeum: true,
      reviewMethod: '대면보고(부문장)', chair: '부문장', reviewDate: daysAgo(15), reviewResult: '승인',
      pmRequest: daysAgo(10), pmDue: daysFromNow(4), pmComplete: null, cftRequest: null, sysManage: null, notice: null, approval: null,
      note: '손충금 체크 후 이미 확정까지 끝낸 예시 — "확정됨" 배지 상태',
    }),
  ]
}
