import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import FlashButton from './common/FlashButton'

export default function PortalSyncButton() {
  const { syncPortalFile, syncGovPortalFile, syncing, syncError } = useData()
  const [result, setResult] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [govMode, setGovMode] = useState(false) // 다음 파일선택이 사업용인지 국책사업용인지
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e) => { if (!wrapRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  const openPicker = (isGov) => {
    setGovMode(isGov)
    setMenuOpen(false)
    inputRef.current?.click()
  }

  const handleFile = async (file) => {
    setResult(null)
    try {
      const summary = govMode ? await syncGovPortalFile(file) : await syncPortalFile(file)
      setResult({ ...summary, gov: govMode })
      setTimeout(() => setResult(null), 6000)
    } catch {
      /* syncError가 컨텍스트에 이미 반영됨 */
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <FlashButton
        onClick={() => setMenuOpen((o) => !o)}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40 disabled:opacity-50"
      >
        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 포털 데이터 업로드
        <ChevronDown size={12} />
      </FlashButton>
      {menuOpen && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-32 overflow-hidden rounded-lg border border-line bg-paper text-xs shadow-md">
          <button onClick={() => openPicker(false)} className="block w-full px-3 py-2 text-left text-slate hover:bg-line/40">사업</button>
          <button onClick={() => openPicker(true)} className="block w-full px-3 py-2 text-left text-slate hover:bg-line/40">국책사업</button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {result && (
        <div className="absolute right-0 top-full z-10 mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 shadow-md">
          <CheckCircle2 size={12} /> {result.gov ? '국책사업 ' : ''}신규 {result.created}건 · 갱신 {result.updated}건 · 제외됨 {result.excluded}건
        </div>
      )}
      {syncError && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-80 max-w-[90vw] rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow-md">
          {syncError}
        </div>
      )}
    </div>
  )
}
