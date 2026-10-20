import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { REVIEW_METHODS } from '../../lib/stage'
import { CLASSIFY_OPTIONS } from '../../lib/businessDivision'
import { useData } from '../../context/DataContext'

export default function BulkToolbar() {
  const { selectedIds, clearSelection, bulkUpdate, bulkDelete, pms } = useData()
  const [deleteError, setDeleteError] = useState(null)
  const count = selectedIds.size
  if (count === 0) return null

  const ids = [...selectedIds]

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${ids.length}건을 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      await bulkDelete(ids)
      setDeleteError(null)
      clearSelection()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  return (
    <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo bg-indigo-soft px-3.5 py-2 text-sm shadow-sm">
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

      <button onClick={handleBulkDelete} className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50">
        <Trash2 size={12} /> 선택 삭제
      </button>

      {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}

      <button onClick={clearSelection} className="ml-auto flex items-center gap-1 text-xs text-indigo hover:underline">
        <X size={12} /> 선택 해제
      </button>
    </div>
  )
}
