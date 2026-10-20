import { useEffect, useState } from 'react'
import { History, Plus, Loader2 } from 'lucide-react'
import Sidebar, { VIEWS, AI_VIEW } from './components/Sidebar'
import CommandPalette from './components/CommandPalette'
import FilterBar from './components/FilterBar'
import OverdueBanner from './components/OverdueBanner'
import CftOverdueBanner from './components/CftOverdueBanner'
import ActivityLogPanel from './components/ActivityLogPanel'
import PortalSyncButton from './components/PortalSyncButton'
import FlashButton from './components/common/FlashButton'
import AddRecordModal from './components/AddRecordModal'
import RecordModal from './components/common/RecordModal'
import ExecutiveDashboardView from './components/views/ExecutiveDashboardView'
import AirtableGridView from './components/views/AirtableGridView'
import KanbanBoardView from './components/views/KanbanBoardView'
import MasterDetailView from './components/views/MasterDetailView'
import ScheduleView from './components/views/ScheduleView'
import AiAssistantView from './components/views/AiAssistantView'
import { DataProvider, useData } from './context/DataContext'

const VIEW_COMPONENTS = {
  executive: ExecutiveDashboardView,
  grid: AirtableGridView,
  kanban: KanbanBoardView,
  masterDetail: MasterDetailView,
  schedule: ScheduleView,
  ai: AiAssistantView,
}

function Shell() {
  const [view, setView] = useState('executive')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const { activeRecords, records, loading, loadError, setSelectedId, history, setFilters, lastSync, refreshAll } = useData()
  const ActiveView = VIEW_COMPONENTS[view]
  const title = [...VIEWS, AI_VIEW].find((v) => v.key === view)?.label ?? ''
  const detailRecord = records.find((r) => r.id === detailId)

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 포털 동기화로 신규 항목이 생기면, 사용자가 놓치지 않도록 "신규만" 필터를 자동으로 켜고 표 보기로 이동.
  // 신규 항목은 사업부문이 아직 미지정이라, 부문 탭이 "미래전장사업부문"에 남아있으면
  // newOnly와 서로 상쇄되어 아무것도 안 보이는 모순이 생긴다 — 부문 탭도 "전체"로 같이 바꿔준다.
  useEffect(() => {
    if (lastSync && lastSync.created > 0) {
      setFilters((f) => ({ ...f, newOnly: true, division: 'all' }))
      setView('grid')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSync])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-slate">
        <Loader2 size={16} className="animate-spin" /> 데이터 불러오는 중…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm text-red-700">
        {loadError}
        <button onClick={refreshAll} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-50">다시 시도</button>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar view={view} onChange={setView} count={activeRecords.length} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">{title}</h1>
            <p className="mt-0.5 text-xs text-slate">모든 필드는 클릭해서 바로 수정할 수 있습니다 · 날짜는 클릭하면 달력이 열립니다</p>
          </div>
          <div className="flex items-center gap-2">
            <FlashButton onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40">
              <Plus size={13} /> 안건 추가
            </FlashButton>
            <PortalSyncButton />
            <FlashButton onClick={() => setLogOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40">
              <History size={13} /> 변경 이력{history.length > 0 && ` (${history.length})`}
            </FlashButton>
            <FlashButton onClick={() => setPaletteOpen(true)} className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40">
              안건 검색
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </FlashButton>
          </div>
        </header>

        {/* 배너의 건수는 부문 탭과 무관하게 전체 기준으로 센다 — "전체 확인하기"를 눌렀을 때도
            division을 'all'로 같이 바꿔야, 지금 다른 부문 탭이 선택되어 있어서 그중 일부가
            가려지는 바람에 "전체"라는 말과 실제로 보이는 건수가 안 맞는 모순을 막을 수 있다. */}
        <OverdueBanner onViewOverdue={() => { setFilters((f) => ({ ...f, overdueOnly: true, division: 'all' })); setView('grid') }} />
        <CftOverdueBanner onViewCftOverdue={() => { setFilters((f) => ({ ...f, cftOverdueOnly: true, division: 'all' })); setView('grid') }} />
        {view !== 'ai' && <FilterBar />}

        <main className="min-h-0 flex-1 overflow-auto p-6">
          <ActiveView />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJump={(id) => { setSelectedId(id); setView('masterDetail') }}
      />
      <ActivityLogPanel open={logOpen} onClose={() => setLogOpen(false)} />
      {addOpen && <AddRecordModal onClose={() => setAddOpen(false)} onCreated={(rec) => setDetailId(rec.id)} />}
      {detailRecord && <RecordModal record={detailRecord} onClose={() => setDetailId(null)} />}
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
