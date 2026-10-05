import { useState } from 'react'
import { X } from 'lucide-react'
import { BUSINESS_DIVISIONS, OUR_DIVISION } from '../lib/businessDivision'
import { useData } from '../context/DataContext'
import { useEscapeKey } from '../lib/useEscapeKey'

export default function AddRecordModal({ onClose, onCreated }) {
  const { addRecord } = useData()
  const [contractName, setContractName] = useState('')
  const [deptName, setDeptName] = useState('')
  const [pm, setPm] = useState('')
  const [businessDivision, setBusinessDivision] = useState(OUR_DIVISION)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  useEscapeKey(onClose)

  const submit = async (e) => {
    e.preventDefault()
    if (!contractName.trim()) { setError('계약(사업)명은 필수입니다.'); return }
    setSaving(true)
    setError(null)
    try {
      const created = await addRecord({ contractName: contractName.trim(), deptName: deptName.trim() || null, pm: pm.trim() || null, businessDivision })
      onClose()
      onCreated?.(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">새 안건 추가</h2>
          <button type="button" onClick={onClose} className="text-slate hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <Field label="계약(사업)명 *">
            <input autoFocus value={contractName} onChange={(e) => setContractName(e.target.value)} className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-indigo" />
          </Field>
          <Field label="부서">
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-indigo" />
          </Field>
          <Field label="PM">
            <input value={pm} onChange={(e) => setPm(e.target.value)} className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-indigo" />
          </Field>
          <Field label="사업부문">
            <select value={businessDivision} onChange={(e) => setBusinessDivision(e.target.value)} className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-indigo">
              {BUSINESS_DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-2 text-sm text-slate hover:bg-paper">취소</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-indigo px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? '추가 중…' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate">{label}</span>
      {children}
    </label>
  )
}
