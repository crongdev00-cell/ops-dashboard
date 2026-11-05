import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, Download, Sparkles, CalendarRange } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../lib/format'
import BulkToolbar from '../common/BulkToolbar'
import RecordModal from '../common/RecordModal'
import { stageProgressPct, computeStage, logicalDate } from '../../lib/stage'
import { useData } from '../../context/DataContext'
import { exportRecordsToExcel } from '../../lib/exportExcel'
import { compareRecords, buildYearGroups } from '../../lib/recordSort'

const PAGE_SIZE = 100

const ALL_COLS = [
  { key: 'no', label: 'No.', defaultWidth: 50 },
  { key: 'contractName', label: '계약(사업)명', defaultWidth: 240 },
  { key: 'bm', label: 'BM 이름', defaultWidth: 100 },
  { key: 'deptName', label: 'BM 부서', defaultWidth: 110 },
  { key: 'pm', label: 'PM', defaultWidth: 90 },
  { key: 'pmDeptName', label: 'PM 부서', defaultWidth: 110 },
  { key: 'reviewMethod', label: '심의방법', defaultWidth: 100 },
  { key: 'stage', label: '상태', defaultWidth: 110 },
  { key: 'progress', label: '진행률', defaultWidth: 130 },
  { key: 'amount', label: '계약금액(백만원)', defaultWidth: 130 },
  { key: 'contractDate', label: '계약일자', defaultWidth: 110 },
  { key: 'dueDate', label: '최종납기', defaultWidth: 110 },
  { key: 'pmRequest', label: 'PM요청', defaultWidth: 110 },
  { key: 'approval', label: '결재완료', defaultWidth: 110 },
]

const MIN_COL_WIDTH = 50

// 캔버스 텍스트 측정으로 "더블클릭 자동맞춤" 폭을 구한다 — 라이브러리 없이 네이티브 API로 충분.
let measureCanvas = null
function measureTextWidth(text) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  return ctx.measureText(text ?? '').width
}

function loadStoredState(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function saveStoredState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage 사용 불가(사생활보호 모드 등) 시 조용히 무시 — 기능 저하 없이 세션 내에서만 동작.
  }
}

export default function AirtableGridView() {
  const { records: allRecords, visibleRecords: records, selectedIds, toggleSelect, module } = useData()
  const colsKey = `ops-dashboard:gridCols:${module}`
  const widthsKey = `ops-dashboard:colWidths:${module}`

  const [sort, setSort] = useState({ key: 'contractDate', dir: 'desc' })
  const [visibleCols, setVisibleCols] = useState(() => new Set(loadStoredState(colsKey, ALL_COLS.map((c) => c.key))))
  const [colWidths, setColWidths] = useState(() => {
    const stored = loadStoredState(widthsKey, {})
    return Object.fromEntries(ALL_COLS.map((c) => [c.key, stored[c.key] ?? c.defaultWidth]))
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState(null)
  const [groupByYear, setGroupByYear] = useState(false)

  useEffect(() => setPage(0), [records])
  useEffect(() => saveStoredState(colsKey, [...visibleCols]), [visibleCols, colsKey])
  useEffect(() => saveStoredState(widthsKey, colWidths), [colWidths, widthsKey])

  const resetColWidths = () => setColWidths(Object.fromEntries(ALL_COLS.map((c) => [c.key, c.defaultWidth])))

  const autoFitCol = (key) => {
    const label = ALL_COLS.find((c) => c.key === key)?.label ?? ''
    let max = measureTextWidth(label) + 24 // 정렬 아이콘 여유
    for (const r of records) {
      const text = cellText(r, key)
      const w = measureTextWidth(text)
      if (w > max) max = w
    }
    setColWidths((prev) => ({ ...prev, [key]: Math.max(MIN_COL_WIDTH, Math.round(max + 32)) }))
  }

  const startResize = (e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[key]
    const onMove = (ev) => {
      const next = Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX))
      setColWidths((prev) => ({ ...prev, [key]: next }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const doExport = () => {
    try {
      exportRecordsToExcel(records)
      setExportError(null)
    } catch (err) {
      setExportError('엑셀 내보내기에 실패했습니다: ' + err.message)
    }
  }

  const sorted = useMemo(() => [...records].sort((a, b) => compareRecords(a, b, sort)), [records, sort])

  // 연도별 묶음 보기 — 연도로 먼저 묶고 버킷 안에서 현재 정렬 기준을 적용한다.
  const groupedRows = useMemo(() => buildYearGroups(records, (a, b) => compareRecords(a, b, sort)), [records, sort])

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const cols = ALL_COLS.filter((c) => visibleCols.has(c.key))
  const allChecked = records.length > 0 && records.every((r) => selectedIds.has(r.id))

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  // 연도별 묶음 보기 중엔 페이지네이션을 끄고 전체를 한 번에 그룹 렌더링한다.
  const paged = groupByYear ? sorted : sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  // 신규 필터가 켜진 상태에서 필터링된 목록(records)으로 상세를 찾으면, 모달이 열려서
  // "확인함" 처리되는 순간 그 목록에서 사라져 모달이 뜨자마자 닫혀버린다 — 전체 목록에서 찾아야 한다.
  const detailRecord = allRecords.find((r) => r.id === detailId)

  const cellText = (r, key) => {
    switch (key) {
      case 'no': return String(r.no ?? '')
      case 'contractName': return r.contractName ?? ''
      case 'bm': return r.bm || '미지정'
      case 'deptName': return r.deptName || '미지정'
      case 'pm': return r.pm || '미지정'
      case 'pmDeptName': return r.pmDeptName || '미지정'
      case 'reviewMethod': return r.reviewMethod ?? '미지정'
      case 'stage': return computeStage(r).label ?? ''
      case 'progress': return `${stageProgressPct(r)}%`
      case 'amount': return r.amount != null ? Number(r.amount).toLocaleString('ko-KR') : '-'
      case 'contractDate': return formatDate(r.contractDate)
      case 'dueDate': return formatDate(r.dueDate)
      case 'pmRequest': return formatDate(logicalDate(r, 'pmRequest'))
      case 'approval': return formatDate(logicalDate(r, 'approval'))
      default: return ''
    }
  }

  const renderRow = (r) => {
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
        {visibleCols.has('no') && <td className="truncate px-4 py-2 text-slate">{r.no}</td>}
        {visibleCols.has('contractName') && (
          <td className="truncate px-4 py-2 font-medium text-ink" title={r.contractName}>
            <span className="inline-flex items-center gap-1.5">
              {r.isNew && <Sparkles size={12} className="shrink-0 text-indigo" />}
              {r.projectType === '국책사업' && (
                <span className="shrink-0 rounded bg-indigo-soft px-1.5 py-0.5 text-[10px] font-normal text-indigo">국책사업</span>
              )}
              {r.contractName}
            </span>
          </td>
        )}
        {visibleCols.has('bm') && <td className="truncate px-4 py-2 text-slate" title={r.bm || '미지정'}>{r.bm || '미지정'}</td>}
        {visibleCols.has('deptName') && <td className="truncate px-4 py-2 text-slate" title={r.deptName || '미지정'}>{r.deptName || '미지정'}</td>}
        {visibleCols.has('pm') && <td className="truncate px-4 py-2 text-slate" title={r.pm || '미지정'}>{r.pm || '미지정'}</td>}
        {visibleCols.has('pmDeptName') && <td className="truncate px-4 py-2 text-slate" title={r.pmDeptName || '미지정'}>{r.pmDeptName || '미지정'}</td>}
        {visibleCols.has('reviewMethod') && <td className="truncate px-4 py-2 text-slate" title={r.reviewMethod ?? '미지정'}>{r.reviewMethod ?? '미지정'}</td>}
        {visibleCols.has('stage') && <td className="overflow-hidden px-4 py-2"><StatusBadge record={r} size="sm" /></td>}
        {visibleCols.has('progress') && (
          <td className="overflow-hidden px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-line overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: stage.color }} />
              </div>
              <span className="text-xs tabular-nums text-slate w-9 text-right">{pct}%</span>
            </div>
          </td>
        )}
        {visibleCols.has('amount') && <td className="truncate px-4 py-2 text-right text-slate tabular-nums">{r.amount != null ? Number(r.amount).toLocaleString('ko-KR') : '-'}</td>}
        {visibleCols.has('contractDate') && <td className="truncate px-4 py-2 text-slate">{formatDate(r.contractDate)}</td>}
        {visibleCols.has('dueDate') && <td className="truncate px-4 py-2 text-slate">{formatDate(r.dueDate)}</td>}
        {visibleCols.has('pmRequest') && <td className="truncate px-4 py-2 text-slate">{formatDate(logicalDate(r, 'pmRequest'))}</td>}
        {visibleCols.has('approval') && <td className="truncate px-4 py-2 text-slate">{formatDate(logicalDate(r, 'approval'))}</td>}
      </tr>
    )
  }

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
              <button
                onClick={resetColWidths}
                className="mt-1 w-full rounded px-1.5 py-1 text-left text-xs text-slate hover:bg-paper"
              >
                열 너비 초기화
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setGroupByYear((v) => !v)}
          aria-pressed={groupByYear}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${groupByYear ? 'border-indigo bg-indigo-soft text-indigo' : 'border-line bg-surface text-slate hover:bg-paper'}`}
        >
          <CalendarRange size={13} /> 연도별 묶음
        </button>
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
        <table className="w-full min-w-[1100px] border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {cols.map((c) => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs text-slate">
              <th className="px-4 py-2.5" title="더블클릭: 전체 열 자동맞춤" onDoubleClick={() => cols.forEach((c) => autoFitCol(c.key))}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => records.forEach((r) => { if (allChecked || !selectedIds.has(r.id)) toggleSelect(r.id) })}
                />
              </th>
              {cols.map((c) => (
                <th key={c.key} className="relative whitespace-nowrap px-4 py-2.5 font-medium">
                  <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 truncate hover:text-ink">
                    {c.label}
                    {sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </button>
                  <span
                    onMouseDown={(e) => startResize(e, c.key)}
                    onDoubleClick={(e) => { e.stopPropagation(); autoFitCol(c.key) }}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-indigo-soft"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupByYear
              ? groupedRows.map((item, i) => (item.type === 'header'
                ? (
                  <tr key={`y-${item.year}-${i}`} className="bg-paper">
                    <td colSpan={cols.length + 1} className="px-4 py-1.5 text-xs font-semibold text-slate">
                      {item.year === '연도미정' ? item.year : `${item.year}년`}
                    </td>
                  </tr>
                )
                : renderRow(item.record)))
              : paged.map(renderRow)}
          </tbody>
        </table>
      </div>

      {!groupByYear && sorted.length > PAGE_SIZE && (
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
