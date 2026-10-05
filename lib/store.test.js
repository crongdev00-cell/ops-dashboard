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
