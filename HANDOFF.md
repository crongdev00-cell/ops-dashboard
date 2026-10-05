# HANDOFF — 개발심의회 대시보드 (컴퓨터 A → B 이전)

이 문서는 실제 Claude Code 대화 이전(.session-transfer/claude/)을 보조하는 자료입니다.
대화 자체가 작업 맥락의 원본이고, 이 문서는 "둘러보기용 요약"입니다.

## 저장소

- GitHub: https://github.com/crongdev00-cell/ops-dashboard (비공개)
- 기본 브랜치: `main`
- 커밋 작성자(이 프로젝트 로컬 설정, 전역 설정과 별개): `Erica <crong.dev00@gmail.com>`

## 개발 환경 (B에서 필요한 것)

- Node.js (이 프로젝트는 서버 루트 `package.json` + `client/package.json` 두 개로 구성된 모노레포 구조)
- Git, GitHub CLI(`gh`) — B에서 `gh auth login`으로 로그인 필요 (A와 B는 서로 다른 GitHub 세션)
- Claude Code CLI — 버전은 A 기준 `2.1.289`. B에서 버전이 다르면 세션 재개가 안 될 수 있음, `claude doctor`로 확인

## 설치 및 실행

```bash
git clone https://github.com/crongdev00-cell/ops-dashboard.git
cd ops-dashboard
npm install
npm --prefix client install
cp .env.example .env   # 필요하면 실제 LLM API 키 채워넣기 (레포에는 포함 안 됨)
npm run dev             # 서버(4000) + 클라이언트(vite dev) 동시 실행
```

`data/projects.json`은 저장소에 예시 안건 20건이 포함된 채로 커밋되어 있습니다(미실시~결재완료
전 단계 포함). 완전히 빈 상태로 시작하려면 `data/projects.json`, `data/history.json`,
`data/comments.json` 세 파일을 지우세요 — 서버가 다시 자동으로 채워넣지 않습니다(의도적 동작).

## 목표

사내 R&D 개발심의회 안건 승인 워크플로를 추적하는 내부 대시보드. 사업포털 엑셀을 동기화해
안건을 받아오고, PM 배정·심의방법·진행 단계 같은 팀 데이터는 앱에서 직접 관리. 별도 DB 없이
`data/*.json` 세 파일이 유일한 저장소.

## 핵심 결정 사항

- **데이터 저장**: JSON 파일 직접 읽기/쓰기(원자적 쓰기: `.tmp`로 먼저 쓰고 rename). DB 없음.
- **포털 동기화는 팀 입력값을 절대 덮어쓰지 않음**: `PORTAL_FIELDS`만 갱신, `TEAM_FIELDS`(PM·심의방법·비고 등)는 보존. `lib/store.js`의 `syncPortal()` 참고.
- **포털 업로드는 raw 바이너리 전송** (base64+JSON 방식에서 전환): base64로 감싸면 용량 1.3배 증가 + 메모리에 사본 3벌이 떠서, 실제 사내 대용량 포털 엑셀(수만 건)에서 서버가 멈추던 원인이었음. `express.raw({ type: '*/*', limit: '80mb' })`로 받음 (`server.js` `/api/projects/sync`). 60,000행/34MB 파일로 재현·검증 완료.
- **표 보기(그리드)는 행 클릭 → 상세 팝업** 방식 (셀 인라인 편집 제거). `RecordModal`이 모든 필드 편집을 담당.
- **신규/필터링된 목록에서 모달을 열 때는 항상 전체 레코드(`records`)에서 찾아야 함**, 필터링된 `visibleRecords`에서 찾으면 모달이 열리자마자 닫히는 버그 재발 (markSeen이 필터 목록에서 레코드를 제거하기 때문). 이미 4개 뷰에서 이 패턴으로 수정됨 — 새 뷰 추가 시 주의.
- **대용량 데이터 렌더링**: 표 보기 페이지네이션(100건/페이지), 칸반·일정은 컬럼당 150~200건 상한 + "더 있음" 안내.
- **배포용 포터블 패키지**(`dist-package/`): npm/Node 설치 없는 환경에서 테스트할 수 있도록 portable `node.exe` 동봉 + `run.bat`. `ops-dashboard-test-package-v0.03.zip`까지 만들어짐(저장소에는 zip 자체는 커밋 안 함, `dist-package/` 소스만 커밋). 버전은 `dist-package/VERSION.txt` + `CHANGELOG.txt`로 관리.

## 진행 상황 (A에서 끝난 지점)

- 전체 기능 구현 완료, 백엔드 테스트 11개 통과(`npm test`).
- 매뉴얼 3종(`manual/manual.md`, `manual/manual_offline.html`, 웹 아티팩트) — fresh-eyes 리뷰 반영해서 중복 제거·간결화 완료.
- 포털 동기화 대용량 버그(raw 업로드로 전환) 수정 및 60,000행 실측 검증 완료.
- "Y열" 같은 내부 스프레드시트 용어가 사용자 화면에 노출되던 것 수정.
- 서버 로드 실패 메시지에 "F5로 새로고침 해주세요" 추가.
- **방금 이 세션에서**: Git 저장소 생성, GitHub 비공개 저장소 연결·푸시, 세션 이전 스크립트 작성.

## 다음 작업 (사용자가 직접 언급했던 미해결 항목)

1. 사용자가 실제 사내 포털 대용량 엑셀을 업로드했을 때 "계약명이 안 맞는다"는 에러를 봤다고
   보고했으나, 코드 전체 검색으로는 해당 검증 로직을 찾지 못함 — **정확한 에러 문구를
   재현해서 확인 필요** (raw 업로드 전환이 부수적으로 해결했을 가능성은 있지만 미확인).
2. 사내 LLM(Gemma/EXAONE) 연결은 `.env`에 실제 API 키/주소가 채워진 상태에서 사용자가
   직접 재테스트해야 함 — 이 환경에서는 외부 네트워크 접근이 없어 검증 불가.
3. 테스트 패키지(`dist-package/`)의 zip은 버전이 오를 때마다 로컬에서 재생성해야 함
   (리포지토리에는 zip 자체를 커밋하지 않음 — `.gitignore`의 `*.zip` 규칙).

## 주의할 파일/구조

- `dist-package/app/`는 프로젝트 루트 소스의 **복사본**입니다(포터블 배포용). 루트에서
  `server.js`/`client/`를 고치면 `dist-package/app/`에도 동기화해야 테스트 패키지가 최신
  상태를 반영합니다(지금까지는 수동으로 `cp`).
- `.env`는 저장소에 없습니다(`.gitignore`). `.env.example`을 복사해서 쓰세요.
