import { useState } from 'react'
import { X, History, Undo2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatDate } from '../lib/format'
import { useEscapeKey } from '../lib/useEscapeKey'

const DATE_FIELDS = new Set([
  'pmRequest', 'pmComplete', 'cftRequest',
  'cftAi', 'cftSwTest', 'cftPurchase', 'cftQuality', 'cftCostAnalysis', 'cftMns', 'cftSystemEng', 'cftBizMgmt',
  'notice', 'approval', 'reviewDate', 'contractDate', 'dueDate',
])
const FIELD_LABELS = {
  contractName: '계약(사업)명', deptName: 'BM 부서', bm: 'BM 이름', pm: 'PM', pmDeptName: 'PM 부서',
  reviewMethod: '심의방법', businessDivision: '사업부문', businessType: '사업형태', isSonchunggeum: '손충금 사업',
  amount: '계약금액', note: '비고', appliedBusiness: '적용사업', excluded: '제외 여부',
  pmRequest: 'PM 요청일', pmComplete: 'PM 작성완료일', cftRequest: 'CFT 요청일',
  cftAi: 'CFT AI 검토일', cftSwTest: 'CFT S/W시험 검토일', cftPurchase: 'CFT 개발구매 검토일',
  cftQuality: 'CFT 개발품질 검토일', cftCostAnalysis: 'CFT 원가분석 검토일', cftMns: 'CFT M&S 검토일',
  cftSystemEng: 'CFT 체계공학 검토일', cftBizMgmt: 'CFT 사업관리 검토일',
  notice: '안내일', approval: '결재완료일',
}

function displayValue(field, v) {
  if (v === null || v === undefined || v === '') return '(비어있음)'
  if (field === 'excluded') return v ? '제외됨' : '활성'
  return DATE_FIELDS.has(field) ? formatDate(v) : String(v)
}

export default function ActivityLogPanel({ open, onClose }) {
  const { history, undoHistory } = useData()
  const [undoingId, setUndoingId] = useState(null)
  const [error, setError] = useState(null)
  useEscapeKey(onClose, open)
  if (!open) return null

  const handleUndo = async (id) => {
    setUndoingId(id)
    setError(null)
    try {
      await undoHistory(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div className="h-full w-full max-w-sm overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl animate-slidein" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><History size={16} /> 변경 이력</h2>
          <button onClick={onClose} className="text-slate hover:text-ink"><X size={18} /></button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate">아직 변경 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-paper p-3">
                <p className="truncate text-xs font-medium text-ink">{h.recordName || '(제목 없음)'}</p>
                {h.field === '__created__' ? (
                  <p className="mt-1 text-xs text-slate">안건 생성됨</p>
                ) : h.field === '__sync__' ? (
                  <p className="mt-1 text-xs text-slate">포털 동기화 — {h.to}</p>
                ) : h.field === '__deleted__' ? (
                  <p className="mt-1 text-xs text-red-600">안건 삭제됨</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-slate">
                      <span className="font-medium text-ink">{FIELD_LABELS[h.field] ?? h.field}</span>
                      {' : '}
                      <span className="line-through">{displayValue(h.field, h.from)}</span>
                      {' → '}
                      <span className="text-indigo">{displayValue(h.field, h.to)}</span>
                    </p>
                    <button
                      onClick={() => handleUndo(h.id)}
                      disabled={undoingId === h.id}
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-indigo hover:underline disabled:opacity-50"
                    >
                      <Undo2 size={11} /> {undoingId === h.id ? '되돌리는 중…' : '이 변경 되돌리기'}
                    </button>
                  </>
                )}
                <p className="mt-1 text-[11px] text-slate">{h.ts.toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
