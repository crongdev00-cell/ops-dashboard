import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, GanttChartSquare, Building2, ListChecks, Sparkles } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { computeStage } from '../../lib/stage'
import { formatDate } from '../../lib/format'
import DateField from '../common/DateField'
import StatusBadge from '../common/StatusBadge'
import RecordModal from '../common/RecordModal'
import MetaTags from '../common/MetaTags'

const DATE_KEYS = [
  { key: 'pmRequest', label: 'PM요청' },
  { key: 'pmComplete', label: 'PM완료' },
  { key: 'cftRequest', label: 'CFT요청' },
  { key: 'sysManage', label: '체계관리' },
  { key: 'notice', label: '안내' },
  { key: 'approval', label: '결재완료' },
]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function ScheduleView() {
  const [mode, setMode] = useState('timeline')
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-paper p-1" style={{ width: 'fit-content' }}>
        <ModeButton active={mode === 'timeline'} icon={GanttChartSquare} label="타임라인" onClick={() => setMode('timeline')} />
        <ModeButton active={mode === 'calendar'} icon={CalendarDays} label="달력" onClick={() => setMode('calendar')} />
      </div>
      {mode === 'timeline' ? <TimelineMode /> : <CalendarMode />}
    </div>
  )
}

function ModeButton({ active, icon: Icon, label, onClick }) {
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

// 사업포털 전체 데이터(수만 건)를 그대로 그리면 브라우저가 멈춘다 — 이 개수까지만 렌더링한다.
const LIST_CAP = 200

function TimelineMode() {
  const { visibleRecords: records, selectedId, setSelectedId, updateRecord } = useData()
  const withDates = records.filter((r) => DATE_KEYS.some(({ key }) => r[key]))
  const cappedList = records.slice(0, LIST_CAP)
  const cappedTimeline = withDates.slice(0, LIST_CAP)

  if (withDates.length === 0) {
    return <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-slate">진행 날짜가 입력된 안건이 없어 타임라인을 표시할 수 없습니다.</p>
  }

  const allDates = withDates.flatMap((r) => DATE_KEYS.map(({ key }) => r[key]).filter(Boolean))
  const min = allDates.reduce((a, b) => (a < b ? a : b))
  const max = allDates.reduce((a, b) => (a > b ? a : b))
  const span = Math.max(new Date(max) - new Date(min), 86400000)
  const pct = (iso) => ((new Date(iso) - new Date(min)) / span) * 100

  return (
    <div className="grid h-full grid-cols-[minmax(0,300px)_1fr] gap-0 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-y-auto border-r border-line">
        {cappedList.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`block w-full border-b border-line px-4 py-3 text-left ${r.id === selectedId ? 'bg-indigo-soft' : 'hover:bg-paper'}`}
          >
            <p className="flex items-center gap-1 truncate text-sm font-medium text-ink">
              {r.isNew && <Sparkles size={11} className="shrink-0 text-indigo" />}
              {r.contractName}
            </p>
            <div className="mt-1.5"><StatusBadge record={r} size="sm" /></div>
          </button>
        ))}
        {records.length > LIST_CAP && (
          <p className="px-4 py-3 text-[11px] text-slate">{LIST_CAP}건 표시 중 · {records.length - LIST_CAP}건 더 있음 — 검색·필터로 좁혀보세요</p>
        )}
      </div>

      <div className="overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between text-xs text-slate">
          <span>{formatDate(min)}</span>
          <span className="font-medium text-ink">전체 기간 {Math.round(span / 86400000)}일</span>
          <span>{formatDate(max)}</span>
        </div>

        {withDates.length > LIST_CAP && (
          <p className="mb-3 text-[11px] text-slate">{LIST_CAP}건 표시 중 · {withDates.length - LIST_CAP}건 더 있음 — 검색·필터로 좁혀보세요</p>
        )}
        <div className="space-y-4">
          {cappedTimeline.map((r) => {
            const first = DATE_KEYS.map(({ key }) => r[key]).find(Boolean)
            const last = [...DATE_KEYS].reverse().map(({ key }) => r[key]).find(Boolean)
            const stage = computeStage(r)
            const left = pct(first)
            const width = Math.max(pct(last) - left, 1.5)
            const active = r.id === selectedId
            return (
              <div key={r.id} className={`rounded-xl p-2.5 ${active ? 'bg-indigo-soft' : ''}`}>
                <div className="flex items-center gap-3">
                  <p className="w-44 shrink-0 truncate text-sm text-ink" title={r.contractName}>{r.contractName}</p>
                  <div className="relative h-6 flex-1 rounded-full bg-paper">
                    <div className="absolute top-0.5 h-5 rounded-full opacity-90" style={{ left: `${left}%`, width: `${width}%`, background: stage.color }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-slate">{stage.label}</span>
                </div>
                <div className="ml-[188px] mt-1 flex items-center gap-3 text-xs">
                  <span className="text-slate">시작</span>
                  <DateField value={r.pmRequest} onChange={(v) => updateRecord(r.id, { pmRequest: v })} />
                  <span className="text-slate">완료</span>
                  <DateField value={r.approval} onChange={(v) => updateRecord(r.id, { approval: v })} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CalendarMode() {
  const { records: allRecords, visibleRecords: records } = useData()
  const [openId, setOpenId] = useState(null)
  // 신규 필터로 걸러진 records로 찾으면, 모달이 열려 "확인함" 처리되는 순간 그 목록에서
  // 빠져서 모달이 뜨자마자 닫혀버린다 — 전체 목록(allRecords)에서 찾아야 한다.
  const openRecord = allRecords.find((r) => r.id === openId)

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const r of records) {
      for (const { key, label } of DATE_KEYS) {
        const iso = r[key]
        if (!iso) continue
        if (!map.has(iso)) map.set(iso, [])
        map.get(iso).push({ record: r, label })
      }
    }
    return map
  }, [records])

  const earliest = useMemo(() => {
    const all = [...eventsByDay.keys()].sort()
    return all[0] ? new Date(all[0]) : new Date()
  }, [eventsByDay])

  const [cursor, setCursor] = useState(() => new Date(earliest.getFullYear(), earliest.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstWeekday).fill(null), ...Array(daysInMonth).keys()].map((d) => (d === null ? null : d + 1))

  const isoOf = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const selectedEvents = selectedDay ? eventsByDay.get(isoOf(selectedDay)) ?? [] : []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{year}년 {month + 1}월</h3>
          <div className="flex gap-1">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-md p-1.5 text-slate hover:bg-paper hover:text-ink"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-md p-1.5 text-slate hover:bg-paper hover:text-ink"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-slate">
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />
            const iso = isoOf(day)
            const events = eventsByDay.get(iso) ?? []
            const active = selectedDay === day
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`flex min-h-[72px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors ${
                  active ? 'border-indigo bg-indigo-soft' : 'border-line hover:bg-paper'
                }`}
              >
                <span className="text-xs text-slate">{day}</span>
                <div className="flex flex-wrap gap-0.5">
                  {events.slice(0, 4).map((e, idx) => (
                    <span key={idx} className="h-1.5 w-1.5 rounded-full" style={{ background: computeStage(e.record).color }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">{selectedDay ? `${month + 1}월 ${selectedDay}일 일정` : '날짜를 선택하세요'}</h3>
        <div className="space-y-2">
          {selectedEvents.length === 0 && selectedDay && <p className="text-xs text-slate">해당 날짜에 일정이 없습니다.</p>}
          {selectedEvents.map((e, i) => (
            <button key={i} onClick={() => setOpenId(e.record.id)} className="block w-full rounded-xl border border-line bg-paper px-3 py-2 text-left hover:border-indigo">
              <p className="truncate text-sm font-medium text-ink">{e.record.contractName}</p>
              <div className="mt-0.5"><MetaTags dense items={[{ icon: ListChecks, text: e.label }, { icon: Building2, text: e.record.deptName }]} /></div>
            </button>
          ))}
        </div>
      </div>

      {openRecord && <RecordModal record={openRecord} onClose={() => setOpenId(null)} />}
    </div>
  )
}
