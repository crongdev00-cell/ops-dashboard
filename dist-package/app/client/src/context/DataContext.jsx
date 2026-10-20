import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { computeStage } from '../lib/stage'
import { OUR_DIVISION, NOT_APPLICABLE } from '../lib/businessDivision'

const DataContext = createContext(null)
const SAVED_FILTERS_KEY = 'ops-dashboard:savedFilters'

function loadSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? '[]')
  } catch {
    return []
  }
}

const EMPTY_FILTERS = {
  dept: 'all', pm: 'all', stage: 'all', query: '', overdueOnly: false,
  division: OUR_DIVISION, // '미래전장사업부문' | '그 외 부문' | '미지정' | 'all'
  newOnly: false, showExcluded: false, noPmOnly: false, cftOverdueOnly: false, needsClassificationOnly: false,
}

// 부문 탭 하나의 판정 로직 — visibleRecords 필터링과 부서/PM 드롭다운 선택지 산출, 양쪽에서 똑같이 쓴다.
function matchesDivision(record, division) {
  if (division === OUR_DIVISION) return record.businessDivision === OUR_DIVISION
  if (division === '그 외 부문') return !!record.businessDivision && record.businessDivision !== OUR_DIVISION && record.businessDivision !== NOT_APPLICABLE
  if (division === '미지정') return !record.businessDivision
  return true // 'all'
}

// 포털 동기화가 1차 추천 분류는 해줬지만 담당자가 아직 "확정"을 안 누른 건 — 수기 등록 안건은
// 애초에 autoClassification이 없어서(확정 대상 아님) 여기 안 걸린다.
export function needsClassification(record) {
  return !!record.portalKey && !record.classificationConfirmed
}

// CFT(유관부서) 검토 요청 후 이 기간이 지나도 완료가 안 되면 지연으로 본다 (2주 목표).
export const CFT_SLA_DAYS = 14
export function isCftOverdue(record, todayIso = new Date().toISOString().slice(0, 10)) {
  // 심의방법을 나중에 "미실시"/"대상아님"으로 바꿔도 예전에 찍힌 cftRequest 날짜는 그대로 남는다 —
  // 더 이상 심의 대상이 아닌데 옛 날짜 때문에 CFT 지연으로 계속 잡히면 안 된다.
  const stageCode = computeStage(record).code
  if (stageCode === 'N' || stageCode === 'NA' || stageCode === 'U') return false
  if (!record.cftRequest || record.sysManage) return false
  const days = Math.round((new Date(todayIso) - new Date(record.cftRequest)) / 86400000)
  return days >= CFT_SLA_DAYS
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `요청 실패: ${path}`)
  return data
}

export function DataProvider({ children }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [history, setHistory] = useState([])
  const [comments, setComments] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [filters, setFiltersState] = useState(EMPTY_FILTERS)
  const [savedFilters, setSavedFilters] = useState(loadSavedFilters)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  // 같은 레코드에 연속으로 PUT을 보낼 때, 먼저 보낸 요청의 응답이 나중에 도착해서
  // 더 최근 수정을 덮어쓰는 걸 막기 위한 레코드별 버전 카운터.
  const patchVersionRef = useRef(new Map())

  useEffect(() => {
    try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(savedFilters)) } catch { /* private mode 등 무시 */ }
  }, [savedFilters])

  const refreshAll = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [projectsRes, historyRes, commentsRes] = await Promise.all([
        api('/api/projects'), api('/api/history'), api('/api/comments'),
      ])
      setRecords(projectsRes.records)
      setHistory(historyRes.history.map((h) => ({ ...h, ts: new Date(h.ts) })).reverse())
      setComments(commentsRes.comments.map((c) => ({ ...c, ts: new Date(c.ts) })))
      setSelectedId((prev) => prev ?? projectsRes.records[0]?.id)
    } catch (err) {
      setLoadError(`서버에서 데이터를 불러오지 못했습니다: ${err.message} (F5로 새로고침 해주세요)`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshAll() }, [])

  const setFilters = (updater) => {
    setFiltersState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
    setSelectedIds(new Set())
  }

  const refreshHistory = async () => {
    const historyRes = await api('/api/history')
    setHistory(historyRes.history.map((h) => ({ ...h, ts: new Date(h.ts) })).reverse())
  }

  const updateRecord = async (id, patch) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))) // 낙관적 업데이트
    const myVersion = (patchVersionRef.current.get(id) ?? 0) + 1
    patchVersionRef.current.set(id, myVersion)
    try {
      const updated = await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
      // 이 요청을 보낸 뒤 같은 레코드에 더 최신 수정이 이미 발생했다면, 이 응답은 낡은 것이므로 버린다
      // (안 그러면 늦게 도착한 옛 응답이 방금 한 최신 수정을 덮어쓸 수 있다).
      if (patchVersionRef.current.get(id) === myVersion) {
        setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)))
      }
      await refreshHistory()
    } catch (err) {
      setLoadError(`저장 실패: ${err.message}`)
      refreshAll()
      throw err
    }
  }

  // 여러 건을 한 번에 바꿀 때 Promise.allSettled로 병렬 처리하고, 실패한 것만 모아서 하나의 에러로 보고한다
  // (요청마다 따로 에러 처리를 하면 서로 경쟁하면서 일부 실패가 조용히 묻힐 수 있다).
  const bulkUpdate = async (ids, patch) => {
    const results = await Promise.allSettled(ids.map((id) => updateRecord(id, patch)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) throw new Error(`${failed}/${ids.length}건 저장 실패`)
  }

  const addRecord = async (data) => {
    try {
      const created = await api('/api/projects', { method: 'POST', body: JSON.stringify(data) })
      setRecords((prev) => [...prev, created])
      setSelectedId(created.id)
      await refreshHistory()
      return created
    } catch (err) {
      throw new Error(`안건 추가 실패: ${err.message}`)
    }
  }

  const deleteRecord = async (id) => {
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' })
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      throw new Error(`삭제 실패: ${err.message}`)
    }
  }

  const bulkDelete = async (ids) => {
    const results = await Promise.allSettled(ids.map((id) => deleteRecord(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) throw new Error(`${failed}/${ids.length}건 삭제 실패`)
  }

  const markSeen = (id) => updateRecord(id, { isNew: false }).catch((err) => console.error('[markSeen] failed', err)) // 부수효과성 업데이트라 화면엔 에러를 띄우지 않지만, 콘솔엔 남긴다

  const undoHistory = async (historyId) => {
    try {
      const updated = await api(`/api/history/${historyId}/undo`, { method: 'POST' })
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      await refreshHistory()
    } catch (err) {
      throw new Error(`되돌리기 실패: ${err.message}`)
    }
  }

  const addComment = async (projectId, author, text) => {
    try {
      const created = await api('/api/comments', { method: 'POST', body: JSON.stringify({ projectId, author, text }) })
      setComments((prev) => [...prev, { ...created, ts: new Date(created.ts) }])
    } catch (err) {
      throw new Error(`댓글 저장 실패: ${err.message}`)
    }
  }

  const syncPortalFile = async (file) => {
    setSyncing(true)
    setSyncError(null)
    try {
      // base64로 감싸서 JSON으로 보내면 파일 크기가 1.3배로 불어나고, 원본·base64 문자열·디코딩
      // 버퍼가 동시에 메모리에 떠서 실제 사업포털 규모(수만 건)의 큰 엑셀에서 서버가 멈추거나
      // 죽는 원인이 됐다 — 파일을 그대로(바이너리) 보낸다.
      const result = await api('/api/projects/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
      setRecords(result.records)
      setLastSync({ ...result.summary, at: new Date(), fileName: file.name })
      return result.summary
    } catch (err) {
      setSyncError(`포털 동기화 실패: ${err.message}`)
      throw err
    } finally {
      setSyncing(false)
    }
  }

  const saveCurrentFilter = (name) => setSavedFilters((prev) => [...prev, { id: `${Date.now()}`, name, filters }])
  const applySavedFilter = (id) => {
    const found = savedFilters.find((f) => f.id === id)
    if (found) setFilters(found.filters)
  }
  const deleteSavedFilter = (id) => setSavedFilters((prev) => prev.filter((f) => f.id !== id))

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const activeRecords = useMemo(() => records.filter((r) => !r.excluded), [records])

  // 부서 탭(미래전장사업부문/그 외 부문/미지정/전체)만 반영한 레코드 — 부서·PM 드롭다운의
  // 선택지 범위를 정하는 데 쓴다. dept/pm/stage 등 자기 자신 아래 필터는 반영하지 않는다 —
  // 그렇지 않으면 부서를 하나 고르는 순간 PM 드롭다운에서 다른 부서 소속 PM들이 사라지는
  // 식으로 서로를 계속 좁혀버려서 필터를 풀 방법이 없어진다.
  const divisionScopedRecords = useMemo(() => {
    const base = filters.showExcluded ? records : activeRecords
    return base.filter((r) => matchesDivision(r, filters.division))
  }, [records, activeRecords, filters.showExcluded, filters.division])

  const depts = useMemo(() => [...new Set(divisionScopedRecords.map((r) => r.deptName).filter(Boolean))], [divisionScopedRecords])
  const pms = useMemo(() => [...new Set(divisionScopedRecords.map((r) => r.pm).filter(Boolean))], [divisionScopedRecords])

  const visibleRecords = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    return records.filter((r) => {
      if (!filters.showExcluded && r.excluded) return false
      if (!matchesDivision(r, filters.division)) return false
      if (filters.dept !== 'all' && r.deptName !== filters.dept) return false
      if (filters.pm !== 'all' && r.pm !== filters.pm) return false
      if (filters.stage !== 'all' && computeStage(r).code !== filters.stage) return false
      if (filters.newOnly && !r.isNew) return false
      if (filters.noPmOnly && r.pm) return false
      if (q && !r.contractName?.toLowerCase().includes(q)) return false
      if (filters.overdueOnly) {
        const stage = computeStage(r)
        if (!(r.dueDate && r.dueDate < today && stage.code !== 'F' && stage.code !== 'N' && stage.code !== 'NA' && stage.code !== 'U')) return false
      }
      if (filters.cftOverdueOnly && !isCftOverdue(r, today)) return false
      if (filters.needsClassificationOnly && !needsClassification(r)) return false
      return true
    })
  }, [records, filters])

  const value = useMemo(
    () => ({
      records, activeRecords, divisionScopedRecords, visibleRecords, loading, loadError,
      selectedId, setSelectedId, updateRecord, bulkUpdate, bulkDelete, addRecord, deleteRecord, markSeen,
      history, undoHistory, comments, addComment,
      selectedIds, toggleSelect, clearSelection,
      filters, setFilters, depts, pms,
      savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter,
      syncing, syncError, lastSync, syncPortalFile, refreshAll,
    }),
    [records, activeRecords, divisionScopedRecords, visibleRecords, loading, loadError, selectedId, history, comments,
      selectedIds, filters, depts, pms, savedFilters, syncing, syncError, lastSync]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
