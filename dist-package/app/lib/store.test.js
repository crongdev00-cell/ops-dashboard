import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'

// store.js keeps module-level state loaded at import time from OPS_DATA_DIR,
// so each test gets its own temp dir + a fresh import (cache-busted via query string).
async function freshStore(seedFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-store-test-'))
  process.env.OPS_DATA_DIR = dir
  if (seedFile) fs.writeFileSync(path.join(dir, 'projects.json'), seedFile)
  const store = await import(`./store.js?t=${Date.now()}-${Math.random()}`)
  return { store, dir }
}

test('portal sync creates new records for unseen portalKeys', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const result = store.syncPortal([
    { portalKey: 'KT-1', contractName: '사업A', contractOrg: null, contractMethod: null, appliedBusiness: null, businessType: null, deptName: null, bm: null, contractDate: null, dueDate: null, amount: 100 },
  ])
  assert.equal(result.created, 1)
  assert.equal(result.updated, 0)
  assert.equal(result.excluded, 0)
  const projects = store.getProjects()
  assert.equal(projects.length, 1)
  assert.equal(projects[0].isNew, true)
  assert.equal(projects[0].businessDivision, null)
})

test('portal sync preserves team fields on update, only overwrites portal fields', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A', amount: 100 }])
  const [rec] = store.getProjects()
  store.updateProject(rec.id, { pm: '김도현', businessDivision: '미래전장사업부문', note: '진행중' })

  const result = store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A (이름 변경)', amount: 200 }])
  assert.equal(result.updated, 1)
  const [updated] = store.getProjects()
  assert.equal(updated.contractName, '사업A (이름 변경)')
  assert.equal(updated.amount, 200)
  assert.equal(updated.pm, '김도현', '팀이 입력한 PM은 포털 동기화로 지워지면 안 된다')
  assert.equal(updated.businessDivision, '미래전장사업부문', '사업부문 분류는 포털 동기화로 지워지면 안 된다')
  assert.equal(updated.note, '진행중')
})

test('portal sync merges duplicate portalKeys within the same upload instead of creating two records', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const result = store.syncPortal([
    { portalKey: 'KT-DUP', contractName: '1차값', amount: 100 },
    { portalKey: 'KT-DUP', contractName: '2차값(최신)', amount: 200 },
  ])
  const projects = store.getProjects()
  assert.equal(projects.length, 1, '같은 업로드 안의 중복 계약번호는 레코드 하나로 병합되어야 한다')
  assert.equal(projects[0].contractName, '2차값(최신)')
  assert.equal(result.created, 1)
  assert.equal(result.updated, 1)
})

test('portal sync soft-deletes (excludes) records whose portalKey disappears', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A' }, { portalKey: 'KT-2', contractName: '사업B' }])
  const result = store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A' }])
  assert.equal(result.excluded, 1)
  const projects = store.getProjects()
  const removed = projects.find((p) => p.portalKey === 'KT-2')
  assert.equal(removed.excluded, true, '포털에서 사라진 항목은 완전 삭제가 아니라 excluded 처리되어야 한다')
  assert.equal(projects.length, 2, '레코드 자체는 남아있어야 한다 (복원 가능해야 하므로)')
})

test('manually created records (no portalKey) are never touched by portal sync exclusion', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.createProject({ contractName: '수동 등록 안건' })
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A' }])
  const manual = store.getProjects().find((p) => p.contractName === '수동 등록 안건')
  assert.equal(manual.excluded, false)
})

test('portal sync 1차 자동판정: 신규 레코드에 autoClassification/classificationReason을 채우고 미확정 상태로 둔다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '무기체계 사업', businessType: '연구개발(무기체계)', amount: 30_000 }])
  const [rec] = store.getProjects()
  assert.equal(rec.autoClassification, '대면보고(연구개발본부장)')
  assert.match(rec.classificationReason, /무기체계/)
  assert.equal(rec.classificationConfirmed, false)
  assert.equal(rec.isSonchunggeum, false)
})

test('portal sync 재동기화 시 손충금 체크·확정 여부(팀 입력)는 유지되고, 자동판정 추천만 최신 금액으로 갱신된다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A', businessType: '연구개발(민수)', amount: 100 }])
  const [rec] = store.getProjects()
  assert.equal(rec.autoClassification, '서면보고')
  store.updateProject(rec.id, { isSonchunggeum: true, classificationConfirmed: true, reviewMethod: '대면보고(부문장)' })

  // 포털에서 금액이 무기체계 기준을 넘도록 갱신됨
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A', businessType: '연구개발(무기체계)', amount: 30_000 }])
  const [updated] = store.getProjects()
  assert.equal(updated.autoClassification, '대면보고(연구개발본부장)', '추천값은 최신 포털 데이터 기준으로 다시 계산되어야 한다')
  assert.equal(updated.isSonchunggeum, true, '팀이 체크한 손충금 여부는 재동기화로 사라지면 안 된다')
  assert.equal(updated.classificationConfirmed, true, '이미 확정한 건 재동기화로 다시 미확정 처리되면 안 된다')
  assert.equal(updated.reviewMethod, '대면보고(부문장)', '담당자가 확정한 심의방법(손충금 → 부문장)은 재동기화로 바뀌면 안 된다')
})

test('수기로 만든 안건은 자동판정 대상이 아니므로 처음부터 확정된 것으로 취급한다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '수동 등록 안건' })
  assert.equal(rec.classificationConfirmed, true)
  assert.equal(rec.autoClassification, null)
})

test('수기로 만든 안건이라도 사업형태+금액을 지정하면 생성 시점에 분류가 계산되고 확정 필요 상태가 된다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '무기체계 수동 등록', businessType: '연구개발(무기체계)', amount: 30_000 })
  assert.equal(rec.autoClassification, '대면보고(연구개발본부장)')
  assert.equal(rec.classificationConfirmed, false)
})

test('updateProject로 사업형태를 바꾸면 추천 분류가 재계산되고 확정 상태가 풀린다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '수동 등록 안건' })
  store.updateProject(rec.id, { classificationConfirmed: true }) // 사전 조건: 이미 확정된 상태였다고 가정
  const updated = store.updateProject(rec.id, { businessType: '연구개발(무기체계)', amount: 30_000 })
  assert.equal(updated.autoClassification, '대면보고(연구개발본부장)')
  assert.equal(updated.classificationConfirmed, false, '분류 근거가 바뀌었으니 다시 확정 필요 상태가 되어야 한다')
})

test('updateProject로 금액만 바꿔도 분류가 재계산된다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '핵심기술 수동 등록', businessType: '연구개발(핵심기술)', amount: 100 })
  assert.equal(rec.autoClassification, '서면보고')
  const updated = store.updateProject(rec.id, { amount: 15_000 })
  assert.equal(updated.autoClassification, '대면보고(연구개발본부장)')
  assert.equal(updated.classificationReason, '핵심기술 150억원 이상')
})

test('수기로 만든 안건의 심의방법 기본값은 미지정이다 (미실시 아님)', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '기본값 테스트' })
  assert.equal(rec.reviewMethod, '미지정')
})

test('portal sync로 새로 생기는 레코드도 심의방법 기본값이 미지정이다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A', businessType: null, amount: null }])
  const [rec] = store.getProjects()
  assert.equal(rec.reviewMethod, '미지정')
})

test('pmDeptName은 팀 입력 필드라 포털 재동기화로도 유지된다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A', deptName: '구매전략팀' }])
  const [rec] = store.getProjects()
  store.updateProject(rec.id, { pmDeptName: '전장시스템1팀' })

  store.syncPortal([{ portalKey: 'KT-1', contractName: '사업A(수정)', deptName: '전장시스템2팀' }])
  const [updated] = store.getProjects()
  assert.equal(updated.pmDeptName, '전장시스템1팀', '팀이 지정한 PM 부서는 재동기화로 사라지면 안 된다')
  assert.equal(updated.deptName, '전장시스템2팀', 'BM 부서(포털 항목)는 재동기화로 갱신되어야 한다')
})

test('migrateLegacyRows: 계약번호가 일치하면 TEAM_FIELDS만 패치하고 PORTAL_FIELDS는 건드리지 않는다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([{ portalKey: 'KT-1', contractName: '포털 사업명', businessType: '민수', amount: 100 }])
  const summary = store.migrateLegacyRows([
    { portalKey: 'KT-1', contractName: '구엑셀 사업명(무시됨)', pm: '김이관', pmDeptName: '이관연구소', reviewMethod: '서면보고' },
  ])
  assert.equal(summary.matched, 1)
  assert.equal(summary.created, 0)
  const [rec] = store.getProjects()
  assert.equal(rec.contractName, '포털 사업명', 'PORTAL_FIELD인 계약명은 레거시 업로드로 바뀌면 안 된다')
  assert.equal(rec.pm, '김이관')
  assert.equal(rec.reviewMethod, '서면보고', '이미 신규 스키마 값인 심의방법은 그대로 받아들여야 한다 (확인필요로 플래그하면 안 됨)')
  assert.equal(rec.classificationConfirmed, true)
})

test('migrateLegacyRows: "심의회"는 위원장으로 대면보고 종류를 구분하고, 구분 안 되면 심의방법을 건드리지 않고 플래그만 남긴다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncPortal([
    { portalKey: 'KT-A', contractName: 'A' },
    { portalKey: 'KT-B', contractName: 'B' },
  ])
  const summary = store.migrateLegacyRows([
    { portalKey: 'KT-A', contractName: 'A', reviewMethod: '심의회', chair: '부문장' },
    { portalKey: 'KT-B', contractName: 'B', reviewMethod: '심의회', chair: '팀장' },
  ])
  const recA = store.getProjects().find((p) => p.portalKey === 'KT-A')
  const recB = store.getProjects().find((p) => p.portalKey === 'KT-B')
  assert.equal(recA.reviewMethod, '대면보고(부문장)')
  assert.equal(recB.reviewMethod, '미지정', '판단 안 되는 위원장이면 심의방법을 건드리지 않아야 한다')
  assert.equal(summary.unrecognizedReviewMethod.length, 1)
  assert.equal(summary.unrecognizedReviewMethod[0].contractName, 'B')
})

test('migrateLegacyRows: 계약번호가 없거나 매칭 안 되면 새 안건으로 생성하고 확정 필요 상태로 둔다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const summary = store.migrateLegacyRows([
    { portalKey: null, contractName: '옛날 사업', pm: '박이관', note: '비고 있음' },
  ])
  assert.equal(summary.created, 1)
  const [rec] = store.getProjects()
  assert.equal(rec.portalKey, null)
  assert.equal(rec.pm, '박이관')
  assert.equal(rec.classificationConfirmed, false)
  assert.ok(rec.note.startsWith('[이관-미매칭, 수동확인 필요]'))
})

test('deleteProject는 완전 삭제이며 복원할 방법이 없다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '삭제 테스트' })
  const result = store.deleteProject(rec.id)
  assert.equal(result.deleted, true)
  assert.equal(store.getProject(rec.id), undefined)
  assert.equal(store.getProjects().length, 0)
})

test('corrupt projects.json throws on load instead of silently reseeding', async () => {
  await assert.rejects(() => freshStore('{this is not valid json'), /손상/)
})

test('undoHistoryEntry reverts a field to its previous value', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const rec = store.createProject({ contractName: '테스트', pm: null })
  store.updateProject(rec.id, { pm: '김도현' })
  const history = store.getHistory()
  const entry = history.find((h) => h.field === 'pm')
  store.undoHistoryEntry(entry.id)
  assert.equal(store.getProject(rec.id).pm, null)
})
test('syncGovPortal: 새 govKey는 국책사업 레코드로 생성하고, 기본 심의방법은 서면보고(전자결재)다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  const result = store.syncGovPortal([
    { govKey: 'GOV-1', contractName: '국책사업A', contractOrg: '전담기관', deptName: '부서', bm: '김국책', amount: 1250, govFundAmount: 1000, privateCashAmount: 200, privateInKindAmount: 50, privateTotalAmount: 250, pm: '이피엠' },
  ])
  assert.equal(result.created, 1)
  const [rec] = store.getProjects()
  assert.equal(rec.projectType, '국책사업')
  assert.equal(rec.govKey, 'GOV-1')
  assert.equal(rec.portalKey, null)
  assert.equal(rec.amount, 1250)
  assert.equal(rec.deptName, '부서', 'BM 부서')
  assert.equal(rec.bm, '김국책', 'BM 담당자')
  assert.equal(rec.reviewMethod, '서면보고')
  assert.equal(rec.classificationConfirmed, true)
})

test('syncGovPortal: 기존 govKey는 GOV_FIELDS만 갱신하고 팀 입력 필드는 건드리지 않는다', async () => {
  const { store } = await freshStore()
  store.seedProjects([])
  store.syncGovPortal([{ govKey: 'GOV-1', contractName: '국책사업A', bm: '김국책', amount: 1000 }])
  const [rec] = store.getProjects()
  store.updateProject(rec.id, { pm: '김팀장' })
  const result = store.syncGovPortal([{ govKey: 'GOV-1', contractName: '국책사업A', bm: '이국책', amount: 2000 }])
  assert.equal(result.updated, 1)
  assert.equal(result.created, 0)
  const updated = store.getProject(rec.id)
  assert.equal(updated.amount, 2000)
  assert.equal(updated.bm, '이국책', 'bm도 GOV_FIELDS라 재동기화로 갱신되어야 한다')
  assert.equal(updated.pm, '김팀장', 'pm은 팀 입력 필드라 재동기화로 유지되어야 한다')
})
