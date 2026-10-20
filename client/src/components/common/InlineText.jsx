import { useEffect, useState } from 'react'

// 클릭하면 텍스트 필드로 바뀌고, Enter/blur 시 저장, Esc 시 취소.
// format: 편집 중이 아닐 때만 적용되는 표시 전용 변환(예: 금액에 천단위 콤마) — 저장되는 값(draft)은 항상 원본 그대로라 파싱이 꼬이지 않는다.
export default function InlineText({ value, onSave, placeholder = '-', className = '', format }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  // Master-Detail처럼 같은 위치의 InlineText가 다른 레코드를 가리키도록 value prop만 바뀌는 경우,
  // 편집 중이 아닐 때는 draft를 최신 값으로 계속 맞춰줘야 이전 레코드의 값을 덮어쓰는 사고를 막는다.
  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
        className={`w-full rounded-md border border-indigo bg-white px-1.5 py-0.5 outline-none ring-2 ring-indigo/20 ${className}`}
      />
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className={`block w-full cursor-text rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-paper hover:ring-1 hover:ring-line ${className}`}
    >
      {value ? (format ? format(value) : value) : <span className="text-slate">{placeholder}</span>}
    </span>
  )
}
