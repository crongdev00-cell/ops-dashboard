import { useEffect, useState } from 'react'
import { X, Trash2, Sparkles, RotateCcw, Check } from 'lucide-react'
import StatusBadge from './StatusBadge'
import InlineText from './InlineText'
import VerticalStepper from './VerticalStepper'
import CommentsSection from './CommentsSection'
import { REVIEW_METHODS, FACE_TO_FACE_SONCHUNGGEUM, COMPLETION_STAGE_OPTIONS, STAGES } from '../../lib/stage'
import { CLASSIFY_OPTIONS } from '../../lib/businessDivision'
import { BUSINESS_TYPES } from '../../lib/businessType'
import { PROJECT_STAGES } from '../../lib/projectStage'
import { useData } from '../../context/DataContext'
import { useEscapeKey } from '../../lib/useEscapeKey'
import DateField from './DateField'

export default function RecordModal({ record, onClose }) {
  const { updateRecord, deleteRecord, markSeen } = useData()
  const [actionError, setActionError] = useState(null)
  useEscapeKey(onClose)
  const isCompletion = (record?.category ?? 'review') === 'completion'

  useEffect(() => {
    if (record?.isNew) markSeen(record.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id])

  if (!record) return null
  const update = (patch) => updateRecord(record.id, patch).catch((err) => setActionError(err.message))
  const remove = async () => {
    if (!confirm('이 안건을 완전히 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteRecord(record.id)
      onClose() // 성공했을 때만 닫는다 — 실패했는데 닫히면 사용자는 삭제된 줄 착각하게 된다.
    } catch (err) {
      setActionError(err.message)
    }
  }
  const restore = () => update({ excluded: false })
  // 손충금 체크가 되어 있으면 무조건 대면보고(부문장), 아니면 추천 분류값 그대로가 "지금 적용돼야 할" 심의방법.
  const expectedReviewMethod = record.isSonchunggeum ? FACE_TO_FACE_SONCHUNGGEUM : record.autoClassification
  const classificationMismatch = !!(expectedReviewMethod && record.reviewMethod !== expectedReviewMethod)
  // "확정"을 누르면: 아직 담당자가 심의방법을 직접 안 건드렸을 때(미지정 그대로)만 추천 분류값을
  // 적용한다 — 이미 수동으로 바꿔놨다면(미실시 포함) 그 선택을 존중하고 확정 표시만 한다.
  const confirmClassification = () => {
    const patch = { classificationConfirmed: true }
    if (record.reviewMethod === '미지정' && record.autoClassification) {
      patch.reviewMethod = expectedReviewMethod
    }
    update(patch)
  }
  // "재적용"은 이미 확정된 뒤에 손충금 체크를 바꿔서 추천값과 실제 심의방법이 어긋났을 때,
  // 명시적으로 눌러서 지금의 체크 상태를 심의방법에 다시 반영하는 버튼이다.
  const reapplyClassification = () => update({ reviewMethod: expectedReviewMethod })

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
            {record.excluded && (
              <button onClick={restore} title="복원" className="text-slate hover:text-emerald-600"><RotateCcw size={16} /></button>
            )}
            <button onClick={remove} title="완전 삭제" className="text-slate hover:text-red-600"><Trash2 size={16} /></button>
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
          <Field label="BM 이름"><InlineText value={record.bm} onSave={(v) => update({ bm: v })} /></Field>
          <Field label="BM 부서"><InlineText value={record.deptName} onSave={(v) => update({ deptName: v })} /></Field>
          <Field label="PM"><InlineText value={record.pm} onSave={(v) => update({ pm: v })} /></Field>
          <Field label="PM 부서"><InlineText value={record.pmDeptName} onSave={(v) => update({ pmDeptName: v })} /></Field>
          <Field label="계약금액(백만원)">
            <InlineText
              value={String(record.amount ?? '')}
              format={(v) => Number(v).toLocaleString('ko-KR')}
              onSave={(v) => {
                const n = v.trim() === '' ? 0 : Number(v)
                if (Number.isNaN(n)) return setActionError('계약금액은 숫자만 입력할 수 있습니다.')
                update({ amount: n })
              }}
            />
          </Field>
          <Field label="심의방법">
            <select
              value={record.reviewMethod ?? '미지정'}
              onChange={(e) => update({ reviewMethod: e.target.value })}
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-indigo"
            >
              {REVIEW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          {!isCompletion && (
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
          )}
          <Field label="적용사업"><InlineText value={record.appliedBusiness} onSave={(v) => update({ appliedBusiness: v })} /></Field>
          <Field label="계약일자"><DateField value={record.contractDate} onChange={(v) => update({ contractDate: v })} /></Field>
          <Field label="최종납기"><DateField value={record.dueDate} onChange={(v) => update({ dueDate: v })} /></Field>
          <Field label="사업형태">
            <select
              value={record.businessType ?? ''}
              onChange={(e) => update({ businessType: e.target.value || null })}
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-indigo"
            >
              <option value="">미지정</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {isCompletion && (
            <>
              <Field label="연구소명"><InlineText value={record.labName} onSave={(v) => update({ labName: v })} /></Field>
              <Field label="사업단계">
                <select
                  value={record.projectStage ?? ''}
                  onChange={(e) => update({ projectStage: e.target.value || null })}
                  className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-indigo"
                >
                  <option value="">미지정</option>
                  {PROJECT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>

        {record.autoClassification && (
          <div className="mb-6 rounded-xl border border-line bg-paper p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">1차 분류</h3>
              {record.classificationConfirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <Check size={10} /> 확정됨
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">확정 필요</span>
              )}
            </div>
            <p className="text-sm text-ink">
              추천 분류: <strong>{record.autoClassification}</strong>
              <span className="ml-1.5 text-xs text-slate">({record.classificationReason})</span>
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!record.isSonchunggeum} onChange={(e) => update({ isSonchunggeum: e.target.checked })} />
              손충금 사업 (체크하면 확정 시 대면보고(부문장)로 적용됩니다)
            </label>
            <p className="mt-2 text-xs text-slate">
              참고 — 사업 특성 고려해서 서면보고로 대체하거나 미실시 처리할 수 있는 경우: 정비/수리부속,
              유지보수, 단순 용역/제작/구매, 또는 개발기간 1년 이하·1억원 미만의 용역/제작/구매 사업
              {record.businessType === '운영유지(정비/수리부속)' && ' — 이 안건은 사업형태가 "운영유지(정비/수리부속)"라 해당될 수 있습니다.'}
            </p>
            {!record.classificationConfirmed && (
              <button onClick={confirmClassification} className="mt-3 rounded-lg bg-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo/90">
                확정
              </button>
            )}
            {record.classificationConfirmed && classificationMismatch && (
              <button onClick={reapplyClassification} className="mt-3 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500/90">
                재적용 — 심의방법을 "{expectedReviewMethod}"로 변경
              </button>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">진행 단계</h3>
        </div>
        {isCompletion ? (
          // 완료보고는 CFT 8개 부서 날짜로 역산하지 않고 엑셀에서 받은(또는 직접 지정한) 단계를
          // 그대로 쓴다 — VerticalStepper 대신 단순 select.
          <select
            value={record.stageOverride ?? 'U'}
            onChange={(e) => update({ stageOverride: e.target.value })}
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo"
          >
            {COMPLETION_STAGE_OPTIONS.map((code) => <option key={code} value={code}>{STAGES[code].label}</option>)}
          </select>
        ) : (
          <VerticalStepper record={record} onUpdate={update} />
        )}

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
