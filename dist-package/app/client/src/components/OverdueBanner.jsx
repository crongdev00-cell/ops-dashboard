import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { computeStage } from '../lib/stage'
import { useData } from '../context/DataContext'

export default function OverdueBanner({ onViewOverdue }) {
  const { activeRecords: records } = useData()
  const [dismissed, setDismissed] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const overdue = records.filter((r) => {
    const stage = computeStage(r)
    return r.dueDate && r.dueDate < today && stage.code !== 'F' && stage.code !== 'N'
  })

  if (dismissed || overdue.length === 0) return null

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">
      <AlertTriangle size={15} className="shrink-0" />
      <span>
        완료기한이 지난 안건 <strong>{overdue.length}건</strong>이 아직 결재완료되지 않았습니다.
      </span>
      <button onClick={onViewOverdue} className="ml-1 underline underline-offset-2 hover:text-amber-950">
        전체 확인하기
      </button>
      <button onClick={() => setDismissed(true)} className="ml-auto text-amber-600 hover:text-amber-900"><X size={14} /></button>
    </div>
  )
}
