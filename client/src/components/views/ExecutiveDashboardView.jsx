import { useState } from 'react'
import { AlertTriangle, Building2, User } from 'lucide-react'
import { STAGES, computeStage } from '../../lib/stage'
import { useData, needsClassification } from '../../context/DataContext'
import StatusBadge from '../common/StatusBadge'
import InlineText from '../common/InlineText'
import RecordModal from '../common/RecordModal'
import MetaTags from '../common/MetaTags'

const STEP_KEYS = [
  'pmRequest', 'pmComplete', 'cftRequest',
  'cftAi', 'cftSwTest', 'cftPurchase', 'cftQuality', 'cftCostAnalysis', 'cftMns', 'cftSystemEng', 'cftBizMgmt',
  'notice', 'approval',
]

function lastTouched(r) {
  const dates = STEP_KEYS.map((k) => r[k]).filter(Boolean)
  return dates.length ? dates.sort().at(-1) : null
}

export default function ExecutiveDashboardView() {
  const { records: allRecords, visibleRecords: records, updateRecord } = useData()
  const [openId, setOpenId] = useState(null)
  // 신규 필터로 걸러진 records로 찾으면, 모달이 열려 "확인함" 처리되는 순간 그 목록에서
  // 빠져서 모달이 뜨자마자 닫혀버린다 — 전체 목록(allRecords)에서 찾아야 한다.
  const openRecord = allRecords.find((r) => r.id === openId)

  const stageCounts = Object.values(STAGES)
    .map((s) => ({ name: s.label, value: records.filter((r) => computeStage(r).code === s.code).length, color: s.color }))

  const today = new Date()
  const bottlenecks = records
    .filter((r) => { const st = computeStage(r); return st.code !== 'N' && st.code !== 'F' && st.code !== 'NA' && st.code !== 'U' })
    .map((r) => {
      const last = lastTouched(r)
      const days = last ? Math.round((today - new Date(last)) / 86400000) : null
      return { r, days }
    })
    .filter((x) => x.days === null || x.days >= 14)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999))
    .slice(0, 5)

  const recent = [...records].sort((a, b) => (b.contractDate ?? '').localeCompare(a.contractDate ?? '')).slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="전체 안건" value={`${records.length}건`} />
        <Stat label="결재완료" value={`${records.filter((r) => computeStage(r).code === 'F').length}건`} />
        <Stat label="정체 안건" value={`${bottlenecks.length}건`} accent={bottlenecks.length > 0} />
        <Stat
          label="심의 대상 확정 필요"
          value={`${records.filter(needsClassification).length}건`}
          accent={records.filter(needsClassification).length > 0}
        />
      </div>

      <Card title="진행 단계별 현황">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stageCounts.map((s) => (
            <div key={s.name} className="rounded-xl bg-paper px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs text-slate">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <p className="mt-1 text-xl font-semibold text-ink">{s.value}<span className="ml-0.5 text-xs font-normal text-slate">건</span></p>
            </div>
          ))}
        </div>
      </Card>

      {bottlenecks.length > 0 && (
        <Card title="정체 안건 경고 (14일 이상 제자리)">
          <div className="space-y-2">
            {bottlenecks.map(({ r, days }) => (
              <button key={r.id} onClick={() => setOpenId(r.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-left hover:bg-amber-100">
                <span className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                  <span className="truncate text-sm text-ink">{r.contractName}</span>
                </span>
                <span className="shrink-0 text-xs text-amber-700">{days ? `${days}일 정체` : '진행 이력 없음'}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card title="최신 안건 (클릭하여 편집)">
        <div className="divide-y divide-line">
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  <InlineText value={r.contractName} onSave={(v) => updateRecord(r.id, { contractName: v })} />
                </p>
                <div className="mt-1">
                  <MetaTags items={[{ icon: Building2, text: r.deptName }, { icon: User, text: r.pm }]} />
                </div>
              </div>
              <button onClick={() => setOpenId(r.id)}><StatusBadge record={r} /></button>
            </div>
          ))}
        </div>
      </Card>

      {openRecord && <RecordModal record={openRecord} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-slate">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-amber-600' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  )
}
