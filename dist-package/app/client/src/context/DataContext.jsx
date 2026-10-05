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
  newOnly: false, showExcluded: false, noPmOnly: false,
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
      setLoadError(`서버에서 데이터를 불러오지 못했습니다: ${err.message} (백엔드가 켜져 있는지 확인하세요)`)
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
      const updated = await api(`/api/projects/${id}`, { method: 'DELETE' })
      setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch (err) {
      throw new Error(`제외 처리 실패: ${err.message}`)
    }
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
      // 스프레드로 통째로 fromCharCode에 넘기면 실제 포털 파일 크기(수백 KB~)에서 콜스택이 넘친다 — FileReader로 안전하게 변환.
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const result = await api('/api/projects/sync', { method: 'POST', body: JSON.stringify({ fileBase64 }) })
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
  const depts = useMemo(() => [...new Set(activeRecords.map((r) => r.deptName).filter(Boolean))], [activeRecords])
  const pms = useMemo(() => [...new Set(activeRecords.map((r) => r.pm).filter(Boolean))], [activeRecords])

  const visibleRecords = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    return records.filter((r) => {
      if (!filters.showExcluded && r.excluded) return false
      if (filters.division === OUR_DIVISION && r.businessDivision !== OUR_DIVISION) return false
      if (filters.division === '그 외 부문' && (r.businessDivision === OUR_DIVISION || r.businessDivision === NOT_APPLICABLE || !r.businessDivision)) return false
      if (filters.division === '미지정' && r.businessDivision) return false
      if (filters.dept !== 'all' && r.deptName !== filters.dept) return false
      if (filters.pm !== 'all' && r.pm !== filters.pm) return false
      if (filters.stage !== 'all' && computeStage(r).code !== filters.stage) return false
      if (filters.newOnly && !r.isNew) return false
      if (filters.noPmOnly && r.pm) return false
      if (q && !r.contractName?.toLowerCase().includes(q)) return false
      if (filters.overdueOnly) {
        const stage = computeStage(r)
        if (!(r.dueDate && r.dueDate < today && stage.code !== 'F' && stage.code !== 'N')) return false
      }
      return true
    })
  }, [records, filters])

  const value = useMemo(
    () => ({
      records, activeRecords, visibleRecords, loading, loadError,
      selectedId, setSelectedId, updateRecord, bulkUpdate, addRecord, deleteRecord, markSeen,
      history, undoHistory, comments, addComment,
      selectedIds, toggleSelect, clearSelection,
      filters, setFilters, depts, pms,
      savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter,
      syncing, syncError, lastSync, syncPortalFile, refreshAll,
    }),
    [records, activeRecords, visibleRecords, loading, loadError, selectedId, history, comments,
      selectedIds, filters, depts, pms, savedFilters, syncing, syncError, lastSync]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
