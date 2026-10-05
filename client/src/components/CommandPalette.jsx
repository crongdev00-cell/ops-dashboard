import { useEffect, useRef, useState } from 'react'
import { Search, CornerDownLeft, Building2, User } from 'lucide-react'
import { useData } from '../context/DataContext'
import StatusBadge from './common/StatusBadge'
import MetaTags from './common/MetaTags'

export default function CommandPalette({ open, onClose, onJump }) {
  const { activeRecords: records } = useData()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const results = (q
    ? records.filter((r) => [r.contractName, r.deptName, r.pm].some((v) => v?.toLowerCase().includes(q)))
    : records
  ).slice(0, 8)

  const jump = (record) => { onJump(record.id); onClose() }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 pt-[14vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="text-slate" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              if (e.key === 'Enter' && results[active]) jump(results[active])
              if (e.key === 'Escape') onClose()
            }}
            placeholder="안건명, 부서, PM으로 검색…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-slate">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate">결과가 없습니다.</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => jump(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-indigo-soft' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{r.contractName}</p>
                <div className="mt-0.5"><MetaTags dense items={[{ icon: Building2, text: r.deptName }, { icon: User, text: r.pm }]} /></div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge record={r} size="sm" />
                {i === active && <CornerDownLeft size={13} className="text-slate" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
