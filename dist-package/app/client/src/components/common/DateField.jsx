import { useRef } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { formatDate } from '../../lib/format'

// 네이티브 date input을 사용해 브라우저 기본 달력 팝업으로 날짜를 선택/해제한다.
// 네이티브 input은 (브라우저가 그려주는) 달력 아이콘 부분을 정확히 클릭해야만 팝업이 뜨는데,
// 그 아이콘은 input 자체 크기와 무관하게 input의 오른쪽 끝에 고정된 작은 영역이다 — 그래서
// 라벨 전체를 덮도록 늘려놔도 가운데나 왼쪽을 클릭하면 포커스만 잡힐 뿐 팝업은 안 떴다.
// showPicker()를 라벨 클릭 전체에 걸어서 어디를 눌러도 팝업이 뜨도록 한다.
export default function DateField({ value, onChange, placeholder = '미입력' }) {
  const inputRef = useRef(null)
  return (
    <label
      className={`group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-sm hover:bg-paper hover:ring-1 hover:ring-line ${
        value ? 'text-ink' : 'text-slate'
      }`}
      onClick={() => { try { inputRef.current?.showPicker?.() } catch { /* 지원 안 하는 브라우저는 기본 클릭 동작에 맡긴다 */ } }}
    >
      <CalendarDays size={13} className="shrink-0 text-slate" />
      <span className="relative">
        {value ? formatDate(value) : placeholder}
        <input
          ref={inputRef}
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null) }}
          className="ml-0.5 hidden rounded p-0.5 text-slate hover:bg-line hover:text-ink group-hover:inline-flex"
        >
          <X size={11} />
        </button>
      )}
    </label>
  )
}
