import {
  LayoutGrid, Table2, Kanban, GanttChartSquare, CircleDot,
  PanelsTopLeft, Sparkles,
} from 'lucide-react'

export const VIEWS = [
  { key: 'executive', label: '현황 요약', icon: LayoutGrid },
  { key: 'grid', label: '표 보기', icon: Table2 },
  { key: 'kanban', label: '칸반 보드', icon: Kanban },
  { key: 'masterDetail', label: '목록·상세 보기', icon: PanelsTopLeft },
  { key: 'schedule', label: '일정', icon: GanttChartSquare },
]

export const AI_VIEW = { key: 'ai', label: 'AI 어시스턴트', icon: Sparkles }

export default function Sidebar({ view, onChange, count }) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo text-white">
          <CircleDot size={15} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">개발심의회</p>
          <p className="text-[11px] text-slate">대시보드</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <NavButton key={key} active={view === key} icon={Icon} label={label} onClick={() => onChange(key)} />
        ))}

        <div className="my-3 border-t border-line" />
        <NavButton active={view === AI_VIEW.key} icon={AI_VIEW.icon} label={AI_VIEW.label} onClick={() => onChange(AI_VIEW.key)} />
      </nav>

      <div className="border-t border-line px-5 py-4 text-xs text-slate">
        전체 안건 <span className="font-semibold text-ink">{count}</span>건
      </div>
    </aside>
  )
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-indigo-soft text-indigo font-medium' : 'text-slate hover:bg-paper hover:text-ink'
      }`}
    >
      <Icon size={17} strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  )
}
