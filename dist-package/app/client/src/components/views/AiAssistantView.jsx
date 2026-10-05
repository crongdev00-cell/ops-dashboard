import { useState } from 'react'
import { Send, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { askLlm, buildRecordsContext } from '../../lib/llm'

const MODELS = [
  { id: 'gemini', label: 'Gemini', note: '외부 API — 비식별 데이터에만 사용하세요' },
  { id: 'gemma', label: 'Gemma', note: '사내망 — 짧은 단건 질의에 적합' },
  { id: 'exaone', label: 'EXAONE', note: '사내망 — 컨텍스트가 커서 대량 종합 분석에 적합' },
]

const SUGGESTIONS = ['전체 안건 진행 상황을 요약해줘', '병목 위험이 큰 안건 3개만 짚어줘', '부서별로 결재완료 비율을 비교해줘']

export default function AiAssistantView() {
  const { records, visibleRecords } = useData()
  const [model, setModel] = useState('gemini')
  const [input, setInput] = useState('')
  const [thread, setThread] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || loading) return
    setInput('')
    setError(null)
    const nextThread = [...thread, { role: 'user', content: question }]
    setThread(nextThread)
    setLoading(true)
    try {
      const context = buildRecordsContext(visibleRecords.length ? visibleRecords : records)
      const systemPrompt =
        '너는 사내 개발심의회 진행현황 데이터를 분석하는 어시스턴트다. 아래 JSON 안건 목록만 근거로 답하고, ' +
        '추측이 필요하면 추측임을 명시해라. 답변은 한국어로, 간결하게 작성해라.\n\n' +
        `안건 목록(JSON): ${JSON.stringify(context)}`
      const content = await askLlm(model, [
        { role: 'system', content: systemPrompt },
        ...nextThread,
      ])
      setThread((t) => [...t, { role: 'assistant', content }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate">
          <Sparkles size={15} className="text-indigo" />
          현재 필터 기준 {visibleRecords.length}건을 근거로 답합니다
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-paper p-1">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              title={m.note}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                model === m.id ? 'bg-surface text-indigo shadow-sm' : 'text-slate hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4">
        {thread.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles size={28} className="text-indigo" strokeWidth={1.5} />
            <p className="text-sm text-slate">안건 데이터에 대해 자연어로 물어보세요.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink hover:border-indigo">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {thread.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-indigo text-white' : 'bg-paper text-ink'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate">
            <Loader2 size={13} className="animate-spin" /> {MODELS.find((m) => m.id === model)?.label} 응답 대기 중…
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send() }}
        className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate"
        />
        <button type="submit" disabled={loading} className="rounded-lg bg-indigo p-1.5 text-white disabled:opacity-40">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
