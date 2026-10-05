import { computeStage } from '../../lib/stage'

export default function StatusBadge({ record, size = 'md' }) {
  const stage = computeStage(record)
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${padding}`}
      style={{ background: `color-mix(in srgb, ${stage.color} 16%, white)`, color: stage.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color }} />
      {stage.label}
    </span>
  )
}
