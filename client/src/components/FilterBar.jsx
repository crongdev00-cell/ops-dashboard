import { useState } from 'react'
import { Search, X, AlertTriangle, Bookmark, Plus, Check, Sparkles, EyeOff, UserX, Clock, ClipboardCheck } from 'lucide-react'
import { STAGES } from '../lib/stage'
import { OUR_DIVISION } from '../lib/businessDivision'
import { useData, isCftOverdue, needsClassification } from '../context/DataContext'

const DIVISION_TABS = [OUR_DIVISION, '그 외 부문', '미지정', 'all']
const DIVISION_LABELS = { [OUR_DIVISION]: OUR_DIVISION, '그 외 부문': '그 외 부문', '미지정': '미지정', all: '전체' }

export default function FilterBar() {
  const {
    filters, setFilters, depts, pms, visibleRecords, activeRecords, divisionScopedRecords, records,
    savedFilters, saveCurrentFilter, applySavedFilter, deleteSavedFilter,
  } = useData()
  const active = filters.dept !== 'all' || filters.pm !== 'all' || filters.stage !== 'all' || filters.query || filters.overdueOnly || filters.newOnly || filters.noPmOnly || filters.cftOverdueOnly || filters.needsClassificationOnly
  const [savingName, setSavingName] = useState(null)
  // 이 칩들은 지금 선택된 부문 탭과 "함께(AND)" 적용되는 하위 필터라서, 배지 숫자도 부문 탭으로
  // 좁힌 집합 기준으로 세야 한다 — 전체 기준 숫자를 보여주면 눌렀을 때 그보다 적게(또는 0건)
  // 나와서 숫자와 실제 결과가 안 맞는 모순이 생긴다. (unassignedCount는 "미지정" 탭 배지 자체라
  // 예외 — 부문 구분과 무관하게 전체 기준이 맞다.)
  const newCount = divisionScopedRecords.filter((r) => r.isNew).length
  const unassignedCount = activeRecords.filter((r) => !r.businessDivision).length
  const noPmCount = divisionScopedRecords.filter((r) => !r.pm).length
  const cftOverdueCount = divisionScopedRecords.filter((r) => isCftOverdue(r)).length
  const needsClassificationCount = divisionScopedRecords.filter((r) => needsClassification(r)).length

  const confirmSave = () => {
    const name = savingName.trim()
    if (name) saveCurrentFilter(name)
    setSavingName(null)
  }

  return (
    <div className="border-b border-line bg-surface">
      <div className="flex items-center gap-1 px-6 pt-2.5">
        {DIVISION_TABS.map((d) => (
          <button
            key={d}
            onClick={() => setFilters((f) => ({ ...f, division: d }))}
            aria-pressed={filters.division === d}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.division === d ? 'bg-indigo-soft text-indigo' : 'text-slate hover:text-ink'
            }`}
          >
            {DIVISION_LABELS[d]}
            {d === '미지정' && unassignedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{unassignedCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-6 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5">
          <Search size={13} className="text-slate" />
          <input
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="안건명 검색"
            className="w-40 bg-transparent text-xs text-ink outline-none placeholder:text-slate"
          />
        </div>

        <Select value={filters.dept} onChange={(v) => setFilters((f) => ({ ...f, dept: v }))} label="전체 부서" options={depts} />
        <Select value={filters.pm} onChange={(v) => setFilters((f) => ({ ...f, pm: v }))} label="전체 PM" options={pms} />
        <Select
          value={filters.stage}
          onChange={(v) => setFilters((f) => ({ ...f, stage: v }))}
          label="전체 상태"
          options={Object.values(STAGES).map((s) => s.code)}
          renderOption={(code) => Object.values(STAGES).find((s) => s.code === code)?.label ?? code}
        />

        <ToggleChip active={filters.overdueOnly} icon={AlertTriangle} label="지연만" onClick={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly }))} />
        {cftOverdueCount > 0 && (
          <ToggleChip active={filters.cftOverdueOnly} icon={Clock} label={`CFT 지연 ${cftOverdueCount}건`} onClick={() => setFilters((f) => ({ ...f, cftOverdueOnly: !f.cftOverdueOnly }))} />
        )}
        {needsClassificationCount > 0 && (
          <ToggleChip active={filters.needsClassificationOnly} icon={ClipboardCheck} label={`심의 대상 확정 필요 ${needsClassificationCount}건`} onClick={() => setFilters((f) => ({ ...f, needsClassificationOnly: !f.needsClassificationOnly }))} />
        )}
        {newCount > 0 && (
          <ToggleChip active={filters.newOnly} icon={Sparkles} label={`신규 ${newCount}건`} onClick={() => setFilters((f) => ({ ...f, newOnly: !f.newOnly }))} />
        )}
        <ToggleChip active={filters.showExcluded} icon={EyeOff} label="제외됨 보기" onClick={() => setFilters((f) => ({ ...f, showExcluded: !f.showExcluded }))} />
        {noPmCount > 0 && (
          <ToggleChip active={filters.noPmOnly} icon={UserX} label={`PM 미배정 ${noPmCount}건`} onClick={() => setFilters((f) => ({ ...f, noPmOnly: !f.noPmOnly }))} />
        )}

        {active && (
          <button
            onClick={() => setFilters((f) => ({ ...f, dept: 'all', pm: 'all', stage: 'all', query: '', overdueOnly: false, newOnly: false, noPmOnly: false, cftOverdueOnly: false, needsClassificationOnly: false }))}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate hover:bg-paper hover:text-ink"
          >
            <X size={12} /> 필터 초기화
          </button>
        )}

        <div className="h-4 w-px bg-line" />

        {savedFilters.map((sf) => (
          <span key={sf.id} className="group flex items-center gap-1 rounded-full border border-line bg-paper pl-2.5 pr-1 py-1 text-xs text-ink">
            <button onClick={() => applySavedFilter(sf.id)} className="flex items-center gap-1 hover:text-indigo">
              <Bookmark size={11} /> {sf.name}
            </button>
            <button onClick={() => deleteSavedFilter(sf.id)} className="rounded-full p-0.5 text-slate hover:bg-line hover:text-ink">
              <X size={10} />
            </button>
          </span>
        ))}

        {savingName !== null ? (
          <span className="flex items-center gap-1 rounded-lg border border-indigo bg-white px-1.5 py-1">
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSavingName(null) }}
              placeholder="필터 이름"
              className="w-24 text-xs outline-none"
            />
            <button onClick={confirmSave} className="text-indigo"><Check size={13} /></button>
          </span>
        ) : (
          active && (
            <button onClick={() => setSavingName('')} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate hover:bg-paper hover:text-ink">
              <Plus size={12} /> 현재 필터 저장
            </button>
          )
        )}

        <span className="ml-auto text-xs text-slate">
          {visibleRecords.length} / {filters.showExcluded ? records.length : activeRecords.length}건 표시
        </span>
      </div>
    </div>
  )
}

function ToggleChip({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-line bg-paper text-slate hover:text-ink'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  )
}

function Select({ value, onChange, label, options, renderOption = (v) => v }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-indigo"
    >
      <option value="all">{label}</option>
      {options.map((o) => <option key={o} value={o}>{renderOption(o)}</option>)}
    </select>
  )
}
