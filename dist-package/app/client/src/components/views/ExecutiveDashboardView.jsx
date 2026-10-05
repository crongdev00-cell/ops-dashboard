import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Building2, User } from 'lucide-react'
import { STAGES, computeStage } from '../../lib/stage'
import { useData } from '../../context/DataContext'
import StatusBadge from '../common/StatusBadge'
import InlineText from '../common/InlineText'
import RecordModal from '../common/RecordModal'
import MetaTags from '../common/MetaTags'

const STEP_KEYS = ['pmRequest', 'pmComplete', 'cftRequest', 'sysManage', 'notice', 'approval']

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
    .filter((s) => s.value > 0)

  const today = new Date()
  const bottlenecks = records
    .filter((r) => { const st = computeStage(r); return st.code !== 'N' && st.code !== 'F' })
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
      <div className="grid grid-cols-3 gap-4">
        <Stat label="전체 안건" value={`${records.length}건`} />
        <Stat label="결재완료" value={`${records.filter((r) => computeStage(r).code === 'F').length}건`} />
        <Stat label="병목 안건" value={`${bottlenecks.length}건`} accent={bottlenecks.length > 0} />
      </div>

      <Card title="진행 상태별 분포">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={stageCounts} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={2}>
              {stageCounts.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-2">
          {stageCounts.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name} {s.value}
            </span>
          ))}
        </div>
      </Card>

      {bottlenecks.length > 0 && (
        <Card title="병목 안건 경고 (14일 이상 정체)">
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
