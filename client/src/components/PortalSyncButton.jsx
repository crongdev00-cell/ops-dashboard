import { useRef, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import FlashButton from './common/FlashButton'

export default function PortalSyncButton() {
  const { syncPortalFile, syncing, syncError } = useData()
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    setResult(null)
    try {
      const summary = await syncPortalFile(file)
      setResult(summary)
      setTimeout(() => setResult(null), 6000)
    } catch {
      /* syncError가 컨텍스트에 이미 반영됨 */
    }
  }

  return (
    <div className="relative">
      <FlashButton
        onClick={() => inputRef.current?.click()}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40 disabled:opacity-50"
      >
        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 포털 동기화
      </FlashButton>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {result && (
        <div className="absolute right-0 top-full z-10 mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 shadow-md">
          <CheckCircle2 size={12} /> 신규 {result.created}건 · 갱신 {result.updated}건 · 제외됨 {result.excluded}건
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
