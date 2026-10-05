import { CalendarDays, X } from 'lucide-react'
import { formatDate } from '../../lib/format'

// 네이티브 date input을 사용해 브라우저 기본 달력 팝업으로 날짜를 선택/해제한다.
export default function DateField({ value, onChange, placeholder = '미입력' }) {
  return (
    <label
      className={`group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-sm hover:bg-paper hover:ring-1 hover:ring-line ${
        value ? 'text-ink' : 'text-slate'
      }`}
    >
      <CalendarDays size={13} className="shrink-0 text-slate" />
      <span className="relative">
        {value ? formatDate(value) : placeholder}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onChange(null) }}
          className="ml-0.5 hidden rounded p-0.5 text-slate hover:bg-line hover:text-ink group-hover:inline-flex"
        >
          <X size={11} />
        </button>
      )}
    </label>
  )
}
