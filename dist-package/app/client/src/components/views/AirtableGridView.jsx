import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, Download, Sparkles } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../lib/format'
import BulkToolbar from '../common/BulkToolbar'
import RecordModal from '../common/RecordModal'
import { stageProgressPct, computeStage } from '../../lib/stage'
import { useData } from '../../context/DataContext'
import { exportRecordsToExcel } from '../../lib/exportExcel'

const PAGE_SIZE = 100

const ALL_COLS = [
  { key: 'no', label: 'No.' },
  { key: 'contractName', label: '계약(사업)명' },
  { key: 'bm', label: 'BM 이름' },
  { key: 'deptName', label: 'BM 부서' },
  { key: 'pm', label: 'PM' },
  { key: 'pmDeptName', label: 'PM 부서' },
  { key: 'reviewMethod', label: '심의방법' },
  { key: 'stage', label: '상태' },
  { key: 'progress', label: '진행률' },
  { key: 'amount', label: '계약금액(백만원)' },
  { key: 'pmRequest', label: 'PM요청' },
  { key: 'approval', label: '결재완료' },
]

export default function AirtableGridView() {
  const { records: allRecords, visibleRecords: records, selectedIds, toggleSelect } = useData()
  const [sort, setSort] = useState({ key: 'no', dir: 'asc' })
  const [visibleCols, setVisibleCols] = useState(new Set(ALL_COLS.map((c) => c.key)))
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => setPage(0), [records])

  const doExport = () => {
    try {
      exportRecordsToExcel(records)
      setExportError(null)
    } catch (err) {
      setExportError('엑셀 내보내기에 실패했습니다: ' + err.message)
    }
  }

  const sorted = useMemo(() => {
    const arr = [...records]
    arr.sort((a, b) => {
      let av, bv
      if (sort.key === 'stage') { av = computeStage(a).label; bv = computeStage(b).label }
      else if (sort.key === 'progress') { av = stageProgressPct(a); bv = stageProgressPct(b) }
      else { av = a[sort.key] ?? ''; bv = b[sort.key] ?? '' }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [records, sort])

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const cols = ALL_COLS.filter((c) => visibleCols.has(c.key))
  const allChecked = records.length > 0 && records.every((r) => selectedIds.has(r.id))

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  // 신규 필터가 켜진 상태에서 필터링된 목록(records)으로 상세를 찾으면, 모달이 열려서
  // "확인함" 처리되는 순간 그 목록에서 사라져 모달이 뜨자마자 닫혀버린다 — 전체 목록에서 찾아야 한다.
  const detailRecord = allRecords.find((r) => r.id === detailId)

  return (
    <div>
      <BulkToolbar />

      <div className="mb-3 flex items-center justify-end gap-2">
        <div className="relative">
          <button
            onClick={() => setColMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-slate hover:bg-paper"
          >
            <SlidersHorizontal size={13} /> 컬럼
          </button>
          {colMenuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-line bg-surface p-2 shadow-lg">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-ink hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => setVisibleCols((prev) => {
                      const next = new Set(prev)
                      next.has(c.key) ? next.delete(c.key) : next.add(c.key)
                      return next
                    })}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={doExport}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-slate hover:bg-paper"
        >
          <Download size={13} /> 내보내기
        </button>
      </div>

      {exportError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{exportError}</div>
      )}

      <div className="overflow-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs text-slate">
              <th className="w-9 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => records.forEach((r) => { if (allChecked || !selectedIds.has(r.id)) toggleSelect(r.id) })}
                />
              </th>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-4 py-2.5 font-medium">
                  <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-ink">
                    {c.label}
                    {sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const pct = stageProgressPct(r)
              const stage = computeStage(r)
              return (
                <tr
                  key={r.id}
                  onClick={() => setDetailId(r.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper/60 ${selectedIds.has(r.id) ? 'bg-indigo-soft/50' : ''}`}
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  </td>
                  {visibleCols.has('no') && <td className="px-4 py-2 text-slate">{r.no}</td>}
                  {visibleCols.has('contractName') && (
                    <td className="max-w-[240px] truncate px-4 py-2 font-medium text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        {r.isNew && <Sparkles size={12} className="shrink-0 text-indigo" />}
                        {r.contractName}
                      </span>
                    </td>
                  )}
                  {visibleCols.has('bm') && <td className="px-4 py-2 text-slate">{r.bm || '미지정'}</td>}
                  {visibleCols.has('deptName') && <td className="px-4 py-2 text-slate">{r.deptName || '미지정'}</td>}
                  {visibleCols.has('pm') && <td className="px-4 py-2 text-slate">{r.pm || '미지정'}</td>}
                  {visibleCols.has('pmDeptName') && <td className="px-4 py-2 text-slate">{r.pmDeptName || '미지정'}</td>}
                  {visibleCols.has('reviewMethod') && <td className="px-4 py-2 text-slate">{r.reviewMethod ?? '미지정'}</td>}
                  {visibleCols.has('stage') && <td className="px-4 py-2"><StatusBadge record={r} size="sm" /></td>}
                  {visibleCols.has('progress') && (
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-[110px]">
                        <div className="h-1.5 flex-1 rounded-full bg-line overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: stage.color }} />
                        </div>
                        <span className="text-xs tabular-nums text-slate w-9 text-right">{pct}%</span>
                      </div>
                    </td>
                  )}
                  {visibleCols.has('amount') && <td className="px-4 py-2 text-right text-slate tabular-nums">{r.amount != null ? Number(r.amount).toLocaleString('ko-KR') : '-'}</td>}
                  {visibleCols.has('pmRequest') && <td className="px-4 py-2 text-slate">{formatDate(r.pmRequest)}</td>}
                  {visibleCols.has('approval') && <td className="px-4 py-2 text-slate">{formatDate(r.approval)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 hover:bg-paper disabled:opacity-40"
          >
            <ChevronLeft size={13} /> 이전
          </button>
          <span className="tabular-nums">
            {safePage * PAGE_SIZE + 1}–{Math.min(sorted.length, (safePage + 1) * PAGE_SIZE)} / {sorted.length}건
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 hover:bg-paper disabled:opacity-40"
          >
            다음 <ChevronRight size={13} />
          </button>
        </div>
      )}

      {detailRecord && <RecordModal record={detailRecord} onClose={() => setDetailId(null)} />}
    </div>
  )
}
