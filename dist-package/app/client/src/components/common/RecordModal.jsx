import { useEffect, useState } from 'react'
import { X, Trash2, Sparkles, RotateCcw } from 'lucide-react'
import StatusBadge from './StatusBadge'
import InlineText from './InlineText'
import VerticalStepper from './VerticalStepper'
import CommentsSection from './CommentsSection'
import { REVIEW_METHODS } from '../../lib/stage'
import { CLASSIFY_OPTIONS } from '../../lib/businessDivision'
import { useData } from '../../context/DataContext'
import { useEscapeKey } from '../../lib/useEscapeKey'

export default function RecordModal({ record, onClose }) {
  const { updateRecord, deleteRecord, markSeen } = useData()
  const [actionError, setActionError] = useState(null)
  useEscapeKey(onClose)

  useEffect(() => {
    if (record?.isNew) markSeen(record.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id])

  if (!record) return null
  const update = (patch) => updateRecord(record.id, patch).catch((err) => setActionError(err.message))
  const remove = async () => {
    if (!confirm('이 안건을 제외 처리할까요? (완전 삭제가 아니라 목록에서만 숨겨지며, 언제든 복원할 수 있습니다)')) return
    try {
      await deleteRecord(record.id)
      onClose() // 성공했을 때만 닫는다 — 실패했는데 닫히면 사용자는 제외된 줄 착각하게 된다.
    } catch (err) {
      setActionError(err.message)
    }
  }
  const restore = () => update({ excluded: false })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate">No. {record.no ?? record.id}</p>
              {record.isNew && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-soft px-1.5 py-0.5 text-[10px] font-medium text-indigo">
                  <Sparkles size={9} /> 신규
                </span>
              )}
            </div>
            <h2 className="mt-0.5 text-lg font-semibold text-ink">
              <InlineText value={record.contractName} onSave={(v) => update({ contractName: v })} className="text-lg font-semibold" />
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge record={record} />
            {record.excluded ? (
              <button onClick={restore} title="복원" className="text-slate hover:text-emerald-600"><RotateCcw size={16} /></button>
            ) : (
              <button onClick={remove} title="제외 처리" className="text-slate hover:text-red-600"><Trash2 size={16} /></button>
            )}
            <button onClick={onClose} className="text-slate hover:text-ink"><X size={18} /></button>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>
        )}

        {record.excluded && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>이 안건은 제외 처리되어 기본 목록에 표시되지 않습니다.</span>
            <button onClick={restore} className="font-medium underline underline-offset-2">복원하기</button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="부서"><InlineText value={record.deptName} onSave={(v) => update({ deptName: v })} /></Field>
          <Field label="PM"><InlineText value={record.pm} onSave={(v) => update({ pm: v })} /></Field>
          <Field label="계약금액(백만원)">
            <InlineText value={String(record.amount ?? '')} onSave={(v) => {
              const n = v.trim() === '' ? 0 : Number(v)
              if (Number.isNaN(n)) return setActionError('계약금액은 숫자만 입력할 수 있습니다.')
              update({ amount: n })
            }} />
          </Field>
          <Field label="심의방법">
            <select
              value={record.reviewMethod ?? '미실시'}
              onChange={(e) => update({ reviewMethod: e.target.value })}
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-indigo"
            >
              {REVIEW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="사업부문">
            <select
              value={record.businessDivision ?? ''}
              onChange={(e) => update({ businessDivision: e.target.value || null })}
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-indigo"
            >
              <option value="">미지정</option>
              {CLASSIFY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="적용사업"><InlineText value={record.appliedBusiness} onSave={(v) => update({ appliedBusiness: v })} /></Field>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">진행 단계</h3>
        </div>
        <VerticalStepper record={record} onUpdate={update} />

        <div className="mt-6">
          <p className="mb-1.5 text-xs font-medium text-slate">비고</p>
          <textarea
            value={record.note ?? ''}
            onChange={(e) => update({ note: e.target.value })}
            rows={2}
            placeholder="비고를 입력하세요"
            className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-indigo"
          />
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <CommentsSection recordId={record.id} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2.5">
      <p className="text-[11px] text-slate">{label}</p>
      <div className="mt-1 text-sm font-medium text-ink">{children}</div>
    </div>
  )
}
