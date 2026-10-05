import { X } from 'lucide-react'
import { REVIEW_METHODS } from '../../lib/stage'
import { CLASSIFY_OPTIONS } from '../../lib/businessDivision'
import { useData } from '../../context/DataContext'

export default function BulkToolbar() {
  const { selectedIds, clearSelection, bulkUpdate, pms } = useData()
  const count = selectedIds.size
  if (count === 0) return null

  const ids = [...selectedIds]

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo bg-indigo-soft px-3.5 py-2 text-sm">
      <span className="font-medium text-indigo">{count}건 선택됨</span>

      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) { bulkUpdate(ids, { pm: e.target.value }); e.target.value = '' } }}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs outline-none"
      >
        <option value="" disabled>PM 일괄 재배정…</option>
        {pms.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) { bulkUpdate(ids, { reviewMethod: e.target.value }); e.target.value = '' } }}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs outline-none"
      >
        <option value="" disabled>심의방법 일괄 변경…</option>
        {REVIEW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) { bulkUpdate(ids, { businessDivision: e.target.value }); e.target.value = '' } }}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs outline-none"
      >
        <option value="" disabled>사업부문 일괄 지정…</option>
        {CLASSIFY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <button onClick={clearSelection} className="ml-auto flex items-center gap-1 text-xs text-indigo hover:underline">
        <X size={12} /> 선택 해제
      </button>
    </div>
  )
}
