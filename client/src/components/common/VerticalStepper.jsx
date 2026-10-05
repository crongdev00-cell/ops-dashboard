import { Check } from 'lucide-react'
import { STEP_SEQUENCE, computeStage } from '../../lib/stage'
import DateField from './DateField'

export default function VerticalStepper({ record, onUpdate }) {
  const stage = computeStage(record)
  const order = ['A', 'B', 'C', 'D', 'E', 'F']
  const activeIdx = order.indexOf(stage.code)

  if (stage.code === 'N') {
    return (
      <div className="rounded-xl border border-line bg-paper px-4 py-6 text-center text-sm text-slate">
        심의 미실시 — 심의방법을 전자결재/심의회로 변경하면 진행 단계가 표시됩니다.
      </div>
    )
  }

  return (
    <ol className="relative">
      {STEP_SEQUENCE.map((step, i) => {
        const done = i < activeIdx || stage.code === 'F'
        const current = i === activeIdx && stage.code !== 'F'
        return (
          <li key={step.key} className="relative flex gap-3 pb-7 last:pb-0">
            {i < STEP_SEQUENCE.length - 1 && (
              <span
                className="absolute left-[11px] top-6 w-px"
                style={{ height: 'calc(100% - 1.2rem)', background: done ? 'var(--color-indigo)' : 'var(--color-line)' }}
              />
            )}
            <span
              className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{
                background: done ? 'var(--color-indigo)' : current ? 'var(--color-indigo-soft)' : 'var(--color-surface)',
                border: `1.5px solid ${done || current ? 'var(--color-indigo)' : 'var(--color-line)'}`,
                color: done ? '#fff' : current ? 'var(--color-indigo)' : 'var(--color-slate)',
              }}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm ${current ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-slate'}`}>
                {step.label}
              </p>
              <div className="mt-0.5">
                <DateField value={record[step.key]} onChange={(v) => onUpdate({ [step.key]: v })} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
