import { useState } from 'react'
import { User, CalendarDays, LayoutGrid, Rows3, AlertTriangle, Layers, Grid3x3, Sparkles } from 'lucide-react'
import { STAGES, STAGE_GROUPS, computeStage, stageProgressPct } from '../../lib/stage'
import { formatDate, daysBetween, todayIso } from '../../lib/format'
import { useData } from '../../context/DataContext'
import RecordModal from '../common/RecordModal'
import StatusBadge from '../common/StatusBadge'

const AVATAR_PALETTE = ['#4f5dff', '#16a34a', '#f5a524', '#e11d48', '#0891b2', '#7c3aed', '#0d9488', '#c2410c']
function avatarColor(name) {
  if (!name) return '#94a3b8'
  const sum = [...name].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

const GROUP_COLORS = { notStarted: '#9ca3af', pmWriting: '#60a5fa', cftReview: '#f5a524', noticeApproval: '#22c55e', na: '#cbd5e1' }

// 사업포털 전체 데이터(수만 건)를 한 컬럼에 그대로 렌더링하면 브라우저가 멈춘다 —
// 컬럼당 이 개수만 그리고, 나머지는 검색/필터로 좁혀서 보도록 안내한다.
const CARD_CAP = 150

export default function KanbanBoardView() {
  const { records: allRecords, visibleRecords: records } = useData()
  const [openId, setOpenId] = useState(null)
  const [orientation, setOrientation] = useState('horizontal')
  const [granularity, setGranularity] = useState('detail')
  // 신규 필터로 걸러진 records로 찾으면, 모달이 열려 "확인함" 처리되는 순간 그 목록에서
  // 빠져서 모달이 뜨자마자 닫혀버린다 — 전체 목록(allRecords)에서 찾아야 한다.
  const openRecord = allRecords.find((r) => r.id === openId)

  const columns = (granularity === 'detail'
    ? Object.values(STAGES).map((stage) => ({
        stage,
        items: records.filter((r) => computeStage(r).code === stage.code),
      }))
    : STAGE_GROUPS.map((group) => ({
        stage: { code: group.key, label: group.label, color: GROUP_COLORS[group.key] },
        items: records.filter((r) => group.codes.includes(computeStage(r).code)),
      }))
  ).map((col) => ({ ...col, total: col.items.length, items: col.items.slice(0, CARD_CAP) }))

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-paper p-1" style={{ width: 'fit-content' }}>
          <OrientationButton active={orientation === 'horizontal'} icon={LayoutGrid} label="가로형" onClick={() => setOrientation('horizontal')} />
          <OrientationButton active={orientation === 'vertical'} icon={Rows3} label="세로형" onClick={() => setOrientation('vertical')} />
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-paper p-1" style={{ width: 'fit-content' }}>
          <OrientationButton active={granularity === 'detail'} icon={Grid3x3} label="세부단계" onClick={() => setGranularity('detail')} />
          <OrientationButton active={granularity === 'group'} icon={Layers} label="상위단계" onClick={() => setGranularity('group')} />
        </div>
      </div>

      {orientation === 'horizontal' ? (
        <HorizontalBoard columns={columns} onOpen={setOpenId} showSubStage={granularity === 'group'} />
      ) : (
        <VerticalBoard columns={columns} onOpen={setOpenId} showSubStage={granularity === 'group'} />
      )}

      {openRecord && <RecordModal record={openRecord} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function OrientationButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-surface text-indigo shadow-sm' : 'text-slate hover:text-ink'
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  )
}

function HorizontalBoard({ columns, onOpen, showSubStage }) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      {columns.map(({ stage, items, total }) => (
        <div key={stage.code} className="flex w-[264px] shrink-0 flex-col rounded-2xl bg-paper">
          <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-3">
            <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
            <h3 className="text-sm font-semibold text-ink">{stage.label}</h3>
            <span className="ml-auto text-xs text-slate">{total}</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-3.5">
            {items.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="w-full rounded-xl border border-line bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="flex items-start gap-1 text-sm font-medium leading-snug text-ink line-clamp-2">
                  {r.isNew && <Sparkles size={12} className="mt-0.5 shrink-0 text-indigo" />}
                  {r.contractName}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {showSubStage && <StatusBadge record={r} size="sm" />}
                  <p className="text-xs text-slate">{r.deptName || '미지정'}</p>
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate">
                  <span className="inline-flex items-center gap-1 rounded-md bg-paper px-1.5 py-0.5"><User size={11} /> {r.pm || '미지정'}</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-paper px-1.5 py-0.5"><CalendarDays size={11} /> {formatDate(r.pmRequest)}</span>
                </div>
              </button>
            ))}
            {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate">없음</p>}
            {total > items.length && (
              <p className="px-1 py-2 text-center text-[11px] text-slate">
                {items.length}건 표시 중 · {total - items.length}건 더 있음 — 검색·필터로 좁혀보세요
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function VerticalBoard({ columns, onOpen, showSubStage }) {
  const today = todayIso()

  return (
    <div className="flex-1 space-y-3 overflow-y-auto">
      {columns.map(({ stage, items, total }) => (
        <div key={stage.code} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div
            className="flex items-center gap-2.5 border-b border-line px-4 py-3"
            style={{ background: `color-mix(in srgb, ${stage.color} 8%, var(--color-surface))` }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
            <h3 className="text-sm font-semibold text-ink">{stage.label}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${stage.color} 18%, white)`, color: stage.color }}
            >
              {total}건
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-4 text-xs text-slate">없음</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-slate">
                  <th className="w-1 px-0 py-2" />
                  <th className="px-3 py-2 font-medium">안건명</th>
                  {showSubStage && <th className="px-3 py-2 font-medium">세부단계</th>}
                  <th className="px-3 py-2 font-medium">부서</th>
                  <th className="px-3 py-2 font-medium">담당자</th>
                  <th className="px-3 py-2 font-medium">진행률</th>
                  <th className="px-3 py-2 font-medium">완료기한</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const pct = stageProgressPct(r)
                  const overdueDays = r.dueDate ? daysBetween(r.dueDate, today) : null
                  const isOverdue = overdueDays !== null && overdueDays > 0 && stage.code !== 'F'
                  return (
                    <tr key={r.id} onClick={() => onOpen(r.id)} className="group cursor-pointer border-t border-line hover:bg-paper">
                      <td className="p-0">
                        <div className="h-full w-1" style={{ background: stage.color, opacity: 0.5 }} />
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2.5 font-medium text-ink">
                        {r.isNew && <Sparkles size={11} className="mr-1 inline shrink-0 text-indigo" />}
                        {r.contractName}
                      </td>
                      {showSubStage && <td className="px-3 py-2.5"><StatusBadge record={r} size="sm" /></td>}
                      <td className="px-3 py-2.5 text-slate">{r.deptName || '미지정'}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                            style={{ background: avatarColor(r.pm) }}
                          >
                            {r.pm ? r.pm[0] : <User size={10} />}
                          </span>
                          <span className="text-slate">{r.pm || '미지정'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="h-1.5 flex-1 rounded-full bg-line overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: stage.color }} />
                          </div>
                          <span className="text-xs tabular-nums text-slate w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertTriangle size={11} /> {overdueDays}일 초과
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate">
                            <CalendarDays size={11} /> {formatDate(r.dueDate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {total > items.length && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-slate">
              {items.length}건 표시 중 · {total - items.length}건 더 있음 — 검색·필터로 좁혀보세요
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
