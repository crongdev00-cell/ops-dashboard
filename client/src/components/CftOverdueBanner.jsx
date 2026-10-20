import { useState } from 'react'
import { Clock, X } from 'lucide-react'
import { useData, isCftOverdue, CFT_SLA_DAYS } from '../context/DataContext'

export default function CftOverdueBanner({ onViewCftOverdue }) {
  const { activeRecords: records } = useData()
  const [dismissed, setDismissed] = useState(false)

  const overdue = records.filter((r) => isCftOverdue(r))

  if (dismissed || overdue.length === 0) return null

  return (
    <div className="flex items-center gap-3 border-b border-sky-200 bg-sky-50 px-6 py-2 text-sm text-sky-800">
      <Clock size={15} className="shrink-0" />
      <span>
        CFT(유관부서) 검토 요청 후 {CFT_SLA_DAYS}일이 지났는데 아직 완료되지 않은 안건이 <strong>{overdue.length}건</strong> 있습니다.
      </span>
      <button onClick={onViewCftOverdue} className="ml-1 underline underline-offset-2 hover:text-sky-950">
        전체 확인하기
      </button>
      <button onClick={() => setDismissed(true)} className="ml-auto text-sky-600 hover:text-sky-900"><X size={14} /></button>
    </div>
  )
}
