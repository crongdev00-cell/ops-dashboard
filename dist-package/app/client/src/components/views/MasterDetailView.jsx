import { useEffect, useMemo, useState } from 'react'
import { Building2, User, Gavel, Coins, Layers, Trash2, Sparkles, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CalendarRange } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import InlineText from '../common/InlineText'
import VerticalStepper from '../common/VerticalStepper'
import CommentsSection from '../common/CommentsSection'
import MetaTags from '../common/MetaTags'
import { REVIEW_METHODS } from '../../lib/stage'
import { CLASSIFY_OPTIONS } from '../../lib/businessDivision'
import { useData } from '../../context/DataContext'

const LIST_PAGE_SIZE = 100

function yearOf(record) {
  return record.contractDate ? new Date(record.contractDate).getFullYear() : '연도미정'
}

export default function MasterDetailView() {
  const { visibleRecords: unsorted, selectedId, setSelectedId, updateRecord, deleteRecord, markSeen } = useData()
  const [sortDir, setSortDir] = useState('desc') // 계약일자 기준, 기본 최신순
  const [groupByYear, setGroupByYear] = useState(false)

  // 계약일자가 없는 레코드는 정렬 방향과 무관하게 항상 맨 뒤로 보낸다.
  const records = useMemo(() => {
    const arr = [...unsorted]
    arr.sort((a, b) => {
      if (!a.contractDate && !b.contractDate) return 0
      if (!a.contractDate) return 1
      if (!b.contractDate) return -1
      return sortDir === 'asc' ? a.contractDate.localeCompare(b.contractDate) : b.contractDate.localeCompare(a.contractDate)
    })
    return arr
  }, [unsorted, sortDir])

  const explicitlySelected = records.find((r) => r.id === selectedId)
  const selected = explicitlySelected ?? records[0]
  const [actionError, setActionError] = useState(null)
  const [listPage, setListPage] = useState(0)

  // 사업포털 전체 데이터(수만 건)를 왼쪽 목록에 그대로 그리면 브라우저가 멈춘다 — 페이지네이션으로 나눠서 렌더링한다.
  useEffect(() => setListPage(0), [records])

  useEffect(() => {
    // 신규 필터가 켜진 상태에서 records[0] 대체 선택까지 seen 처리하면,
    // 확인 → 필터에서 사라짐 → 다음 records[0] 확인... 으로 목록이 연쇄적으로 비어버린다.
    if (explicitlySelected?.isNew) markSeen(explicitlySelected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitlySelected?.id])

  if (!selected) {
    return <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-slate">표시할 안건이 없습니다.</p>
  }

  const update = (patch) => updateRecord(selected.id, patch).catch((err) => setActionError(err.message))
  const remove = async () => {
    if (!confirm('이 안건을 완전히 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteRecord(selected.id)
    } catch (err) {
      setActionError(err.message)
    }
  }
  const restore = () => update({ excluded: false })

  const pageCount = Math.max(1, Math.ceil(records.length / LIST_PAGE_SIZE))
  const safeListPage = Math.min(listPage, pageCount - 1)
  // 연도별 묶음 보기 중엔 페이지네이션을 끄고 전체를 한 번에 그룹 렌더링한다.
  const pagedRecords = groupByYear ? records : records.slice(safeListPage * LIST_PAGE_SIZE, safeListPage * LIST_PAGE_SIZE + LIST_PAGE_SIZE)

  const renderCard = (r) => {
    const active = r.id === selected.id
    return (
      <button
        key={r.id}
        onClick={() => setSelectedId(r.id)}
        className={`block w-full border-b border-line px-4 py-3.5 text-left transition-colors ${active ? 'bg-indigo-soft' : 'hover:bg-paper'}`}
      >
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
          {r.isNew && <Sparkles size={12} className="shrink-0 text-indigo" />}
          {r.contractName}
        </p>
        <div className="mt-1.5"><MetaTags items={[{ icon: Building2, text: r.deptName }, { icon: User, text: r.pm }]} /></div>
        <div className="mt-2"><StatusBadge record={r} size="sm" /></div>
      </button>
    )
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,340px)_1fr] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-col border-r border-line">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate hover:bg-paper"
        >
          계약일자 {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          onClick={() => setGroupByYear((v) => !v)}
          aria-pressed={groupByYear}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${groupByYear ? 'bg-indigo-soft text-indigo' : 'text-slate hover:bg-paper'}`}
        >
          <CalendarRange size={12} /> 연도별
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groupByYear
          ? (() => {
              const rows = []
              let lastYear
              for (const r of pagedRecords) {
                const y = yearOf(r)
                if (y !== lastYear) {
                  rows.push(
                    <div key={`y-${y}`} className="bg-paper px-4 py-1.5 text-xs font-semibold text-slate">
                      {y === '연도미정' ? y : `${y}년`}
                    </div>
                  )
                  lastYear = y
                }
                rows.push(renderCard(r))
              }
              return rows
            })()
          : pagedRecords.map(renderCard)}
      </div>
      {!groupByYear && pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-line px-2 py-2 text-xs text-slate">
          <button
            onClick={() => setListPage((p) => Math.max(0, p - 1))}
            disabled={safeListPage === 0}
            className="rounded-md p-1 hover:bg-paper disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="tabular-nums">{safeListPage + 1} / {pageCount}</span>
          <button
            onClick={() => setListPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safeListPage >= pageCount - 1}
            className="rounded-md p-1 hover:bg-paper disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      </div>

      <div className="overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-paper px-1.5 py-0.5 text-xs text-slate">No.{selected.no ?? selected.id}</span>
              <span className="text-xs text-slate">{selected.appliedBusiness}</span>
            </div>
            <h2 className="mt-1 text-base font-semibold text-ink">
              <InlineText value={selected.contractName} onSave={(v) => update({ contractName: v })} />
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge record={selected} />
            {selected.excluded && (
              <button onClick={restore} title="복원" className="text-slate hover:text-emerald-600"><RotateCcw size={16} /></button>
            )}
            <button onClick={remove} title="완전 삭제" className="text-slate hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>
        )}

        {selected.excluded && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>이 안건은 제외 처리되어 기본 목록에 표시되지 않습니다.</span>
            <button onClick={restore} className="font-medium underline underline-offset-2">복원하기</button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta icon={User} label="BM 이름"><InlineText value={selected.bm} onSave={(v) => update({ bm: v })} /></Meta>
          <Meta icon={Building2} label="BM 부서"><InlineText value={selected.deptName} onSave={(v) => update({ deptName: v })} /></Meta>
          <Meta icon={User} label="PM"><InlineText value={selected.pm} onSave={(v) => update({ pm: v })} /></Meta>
          <Meta icon={Building2} label="PM 부서"><InlineText value={selected.pmDeptName} onSave={(v) => update({ pmDeptName: v })} /></Meta>
          <Meta icon={Gavel} label="심의방법">
            <select
              value={selected.reviewMethod ?? '미지정'}
              onChange={(e) => update({ reviewMethod: e.target.value })}
              className="w-full rounded-md border border-transparent bg-transparent text-sm font-medium text-ink hover:border-line focus:border-indigo focus:outline-none"
            >
              {REVIEW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Meta>
          <Meta icon={Coins} label="계약금액(백만원)">
            <InlineText
              value={String(selected.amount ?? '')}
              format={(v) => Number(v).toLocaleString('ko-KR')}
              onSave={(v) => {
                const n = v.trim() === '' ? 0 : Number(v)
                if (Number.isNaN(n)) return setActionError('계약금액은 숫자만 입력할 수 있습니다.')
                update({ amount: n })
              }}
            />
          </Meta>
          <Meta icon={Layers} label="사업부문">
            <select
              value={selected.businessDivision ?? ''}
              onChange={(e) => update({ businessDivision: e.target.value || null })}
              className="w-full rounded-md border border-transparent bg-transparent text-sm font-medium text-ink hover:border-line focus:border-indigo focus:outline-none"
            >
              <option value="">미지정</option>
              {CLASSIFY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Meta>
        </div>

        <h3 className="mb-4 text-sm font-semibold text-ink">진행 단계</h3>
        <VerticalStepper record={selected} onUpdate={update} />

        <div className="mt-6">
          <p className="mb-1.5 text-xs font-medium text-slate">비고</p>
          <textarea
            value={selected.note ?? ''}
            onChange={(e) => update({ note: e.target.value })}
            rows={2}
            placeholder="비고를 입력하세요"
            className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <CommentsSection recordId={selected.id} />
        </div>
      </div>
    </div>
  )
}

function Meta({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-slate"><Icon size={12} /> {label}</p>
      <div className="mt-1 truncate text-sm font-medium text-ink">{children}</div>
    </div>
  )
}
