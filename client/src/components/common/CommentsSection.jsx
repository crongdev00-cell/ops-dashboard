import { useMemo, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { useData } from '../../context/DataContext'

const AUTHOR_KEY = 'ops-dashboard:commentAuthor'

function renderWithMentions(text) {
  return text.split(/(@[^\s@]+)/g).map((chunk, i) =>
    chunk.startsWith('@')
      ? <span key={i} className="rounded bg-indigo-soft px-1 py-0.5 font-medium text-indigo">{chunk}</span>
      : <span key={i}>{chunk}</span>
  )
}

// 실제 알림/계정 시스템 없이 "댓글에 @이름을 적으면 하이라이트된다" 정도의 예시 구현.
export default function CommentsSection({ recordId }) {
  const { comments, addComment } = useData()
  const [author, setAuthor] = useState(() => { try { return localStorage.getItem(AUTHOR_KEY) ?? '' } catch { return '' } })
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  const thread = useMemo(
    () => comments.filter((c) => c.projectId === recordId).sort((a, b) => a.ts - b.ts),
    [comments, recordId]
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim() || posting) return
    try { localStorage.setItem(AUTHOR_KEY, author) } catch { /* ignore */ }
    setPosting(true)
    setError(null)
    try {
      await addComment(recordId, author, text)
      setText('') // 성공했을 때만 입력창을 비운다 — 실패 시 입력한 내용을 잃으면 안 된다.
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <MessageSquare size={14} /> 댓글 {thread.length > 0 && `(${thread.length})`}
      </h3>

      {thread.length > 0 && (
        <ul className="mb-3 space-y-2.5">
          {thread.map((c) => (
            <li key={c.id} className="rounded-xl bg-paper px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-ink">{c.author}</span>
                <span className="text-[11px] text-slate">{c.ts.toLocaleString('ko-KR')}</span>
              </div>
              <p className="mt-1 text-sm text-ink">{renderWithMentions(c.text)}</p>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <form onSubmit={submit} className="space-y-1.5">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="이름"
          className="w-28 rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-indigo"
        />
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요 (@이름으로 멘션)"
            className="flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-indigo"
          />
          <button type="submit" className="rounded-md bg-indigo p-1.5 text-white disabled:opacity-40" disabled={!text.trim() || posting}>
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
