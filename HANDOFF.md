# HANDOFF — 개발심의회/완료보고 대시보드 (다른 Claude 세션으로 이어하기)

이 문서는 GitHub 저장소를 클론해서 새 Claude 세션(다른 컴퓨터/다른 채팅)에서 작업을 이어갈 때
필요한 맥락을 정리한 것입니다. 최신 작업 시점: v0.31 (완료보고 모듈 추가 커밋 `ef3b6ce`까지).

## 저장소

- GitHub: https://github.com/crongdev00-cell/ops-dashboard (비공개)
- 기본 브랜치: `main`
- 최신 커밋: `ef3b6ce 완료보고(개발완료보고) 모듈 추가`

## 개발 환경 / 설치

```bash
git clone https://github.com/crongdev00-cell/ops-dashboard.git
cd ops-dashboard
npm install
npm --prefix client install
cp .env.example .env   # 필요하면 실제 LLM API 키 채워넣기 (레포에는 포함 안 됨)
npm run dev             # 서버(4000) + 클라이언트(vite dev) 동시 실행
npm test                # 서버/파서 단위 테스트
```

`data/projects.json`에 실데이터가 들어 있습니다(현재 29건). **절대 임의로 지우거나 테스트용으로
건드리지 마세요** — 테스트할 때는 `OPS_DATA_DIR` 환경변수로 스크래치 디렉터리를 가리켜서 서버를
띄우는 방식을 써야 합니다(아래 "테스트 방법" 참고).

## 전체 구조 한눈에

- Node/Express 서버(`server.js`) + React/Vite 클라이언트(`client/`), DB 없이 `data/*.json` 세 파일이
  유일한 저장소(`lib/store.js`가 원자적 쓰기로 관리).
- `dist-package/`는 npm/Node 설치 없이 테스트할 수 있는 **포터블 배포 사본**입니다. 루트의
  `server.js`/`lib/`/`client/`를 고치면 `dist-package/app/` 동일 경로에도 반드시 동기화하고
  `npm run build`로 재빌드해야 패키지가 최신 상태를 반영합니다(수동 동기화, 자동화 없음).
  버전은 `dist-package/VERSION.txt` + `CHANGELOG.txt`로 관리. 배포용 zip(`release/*.zip`)은
  저장소에 커밋하지 않습니다(`.gitignore`).
- 두 개의 top-level 모듈이 있습니다: **개발심의회**(review, 기존 워크플로)와 **완료보고**
  (completion, v0.31에서 추가). 둘 다 같은 5개 뷰(현황요약/표보기/칸반보드/목록·상세보기/일정)를
  공유하며, 모든 레코드는 `category: 'review' | 'completion'` 필드로 구분됩니다(기존 레코드는
  필드가 없으므로 항상 `(record.category ?? 'review')`로 폴백 — 전체 마이그레이션은 하지 않음).

## 핵심 아키텍처 결정

- **카테고리 기반 모듈 분리, 저장 시 마이그레이션 없음**: `DataContext.jsx`의 `moduleRecords`가
  현재 `module` state + 오늘 날짜만으로 매 렌더 시점마다 동적으로 소속을 계산합니다.
  - 개발심의회(review) 쪽 레코드 중 **최종납기(dueDate)가 오늘을 지나면 그 레코드는 개발심의회
    목록에서 빠지고 완료보고 쪽에만 보입니다**(배타적 이동, 중복 표시 아님). 별도 배치/마이그레이션
    없이 매일 날짜 비교만으로 재계산되므로, 날짜가 바뀌면(혹은 dueDate를 수정하면) 다음 조회 시
    자동으로 다시 분류됩니다.
  - `isOverdueIntoCompletion(record, todayIso)` 헬퍼가 그 판정 로직 전체입니다
    (`client/src/context/DataContext.jsx`).
- **완료보고 레코드의 진행 단계는 역산하지 않고 그대로 저장**: 개발심의회는 CFT 8개 부서 날짜를
  기반으로 `computeStage()`가 단계를 역산하지만, 완료보고 엑셀 템플릿은 검토 항목 개수가 다르고
  (개발품질/원가분석 2개뿐) 이미 "진행 단계" 문자열을 직접 제공하므로 `stageOverride` 필드에
  그 값을 그대로 저장합니다. `computeStage()`는 `category==='completion'`이면 맨 앞에서
  `STAGES[record.stageOverride] ?? STAGES.U`를 리턴하고 끝 — 이 한 줄 덕분에 표보기/칸반/일정/
  현황요약 뷰를 전부 수정 없이 재사용할 수 있었습니다(`client/src/lib/stage.js`).
- **완료보고 업로드는 매번 전부 신규 생성(upsert 없음)**: 완료보고는 포털 동기화 대상이 아니라
  가끔 엑셀을 수동 업로드해서 안건을 만드는 용도라서, 재업로드 시 중복 매칭 로직이 없습니다
  (`lib/store.js`의 `importCompletionReport()`). 개발심의회 포털 동기화(`syncGovPortal`)와는
  다른 패턴이니 혼동하지 마세요.
- **완료보고 업로드 cutoff 규칙**: `original_complete_report_data_template.xlsx` 형식으로 업로드할
  때, 납기일자가 **2025-12-29 이전**인 행은 엑셀에 적힌 진행 단계 값과 무관하게 전부 "미실시"로
  강제 분류됩니다(`lib/completionReportParser.js`의 `UNMANAGED_CUTOFF_DATE`).
- **포털 동기화는 팀 입력값을 절대 덮어쓰지 않음**: `PORTAL_FIELDS`만 갱신, `TEAM_FIELDS`
  (PM·심의방법·비고 등)는 보존 (`lib/store.js`의 `syncGovPortal()`).
- **대용량 업로드는 raw 바이너리 전송**(`express.raw({ type: '*/*', limit: '80mb' })`) — base64
  왕복 시 메모리 사본이 여러 벌 떠서 수만 행 엑셀에서 서버가 멈추던 문제의 수정.
- **표 보기(그리드)는 행 클릭 → 상세 팝업** 방식, 셀 인라인 편집 없음. `RecordModal`이 모든 필드
  편집을 담당.
- **모달을 열 때는 항상 전체 레코드(`records`)에서 찾을 것** — 필터링된 `visibleRecords`에서
  찾으면 모달이 열리자마자 닫히는 버그가 재발합니다(markSeen이 필터 목록에서 레코드를 제거하기
  때문). 새 뷰를 추가할 때 주의.
- **완료보고 레코드는 `businessDivision`이 항상 null**이라, division 필터(`matchesDivision`)를
  그대로 적용하면 전부 걸러집니다. `DataContext.jsx`의 `divisionScopedRecords`/`visibleRecords`는
  `module === 'completion'`일 때 division 필터를 건너뛰도록 분기되어 있고, `FilterBar.jsx`도
  해당 모듈에서는 division 탭 UI 자체를 숨깁니다. 비슷한 "review 전용" 필드를 다룰 때 이 패턴을
  참고하세요.

## 테스트 방법 (실데이터 보호 필수)

실제 `data/projects.json`을 건드리지 않으려면 반드시 스크래치 디렉터리를 쓰세요:

```bash
# 예시 (bash)
export OPS_DATA_DIR=/tmp/ops-scratch-test
mkdir -p "$OPS_DATA_DIR"
node server.js   # 이 환경변수를 보는 포트에서 기동, 실데이터와 분리됨
```

테스트 후에는 스크래치 디렉터리 삭제 + 띄워놓은 `node` 프로세스 종료, 그리고 실데이터 레코드 수가
변하지 않았는지(`data/projects.json` 건수) 확인하는 습관을 유지했습니다.

## dist-package(배포 zip) 만들 때 체크리스트

과거에 "검증 완료"라고 했다가 실제로는 제대로 안 열리는 패키지를 전달한 사고가 있었어서, 아래
순서를 반드시 지킵니다:
1. 루트 변경사항을 `dist-package/app/...` 동일 경로에 동기화.
2. `client/`와 `dist-package/app/client/` 둘 다 `npm run build`.
3. `dist-package/VERSION.txt`, `CHANGELOG.txt` 갱신.
4. zip 생성 후 `unzip -l | grep -c "app/node_modules/"`로 파일 개수가 기존 정상 zip과 같은지 확인
   (현재 기준값: 873).
5. zip을 **새 디렉터리에 다시 풀어서** 동봉된 `node.exe`로 실제 기동 → 브라우저로 접속해 데이터가
   보이는지 확인 전에는 "완료"라고 말하지 않습니다.

## 진행 상황 (이 시점까지 끝난 것)

- 개발심의회(review) 모듈: 전체 기능 구현 완료, 포털 동기화, 레거시 엑셀 업로드, CFT 8부서 추적,
  CRUD, 필터/뷰 5종, 대용량 처리 전부 완료.
- 완료보고(completion) 모듈(v0.31): 업로드 파서/엔드포인트, 모듈 토글 UI, 배타적 이동 규칙,
  cutoff 규칙, 전체 CRUD, 더미데이터, 단위테스트, 실제 브라우저 QA(아래 "알려진 이슈/의도적으로
  보류한 것" 참고) 완료. `npm test` 전체 통과.
- dist-package v0.31 zip 빌드·검증 완료.

## 의도적으로 보류한 항목 (사용자가 직접 "괜찮다"고 확인한 것 — 재작업 불필요)

- 계약금액에 음수 입력을 막는 검증은 추가하지 않음.
- 완료보고 안건을 수동으로 추가할 때(`AddRecordModal`) 심의방법(reviewMethod)을 입력받지 않고
  "미지정"으로 두는 것으로 확정.

## 다음 작업이 있다면 참고할 것

- 특별히 남겨진 미해결 TODO는 없습니다. 추가 기능/버그 리포트는 사용자에게 직접 확인 필요.
- `.env`는 저장소에 없습니다(`.gitignore`). `.env.example`을 복사해서 사내 LLM(Gemma/EXAONE) API
  키/주소를 채워넣고 재테스트해야 합니다 — 외부 네트워크가 막힌 환경에서는 검증 불가.
