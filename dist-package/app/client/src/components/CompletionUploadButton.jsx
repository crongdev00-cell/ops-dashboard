import { useRef, useState } from 'react'
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import FlashButton from './common/FlashButton'

// 완료보고(개발완료보고) 엑셀 업로드 — 고유 키가 없는 양식이라 매번 전부 신규 생성한다(사용자 확인).
export default function CompletionUploadButton() {
  const { importCompletionFile, migrating, migrateError } = useData()
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    setResult(null)
    try {
      const summary = await importCompletionFile(file)
      setResult(summary)
      setTimeout(() => setResult(null), 8000)
    } catch {
      /* migrateError가 컨텍스트에 이미 반영됨 */
    }
  }

  return (
    <div className="relative">
      <FlashButton
        onClick={() => inputRef.current?.click()}
        disabled={migrating}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-slate hover:bg-line/40 disabled:opacity-50"
      >
        {migrating ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} 완료보고 업로드
      </FlashButton>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {result && (
        <div className="absolute right-0 top-full z-10 mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 shadow-md">
          <CheckCircle2 size={12} /> 신규생성 {result.created}건
        </div>
      )}
      {migrateError && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-80 max-w-[90vw] rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow-md">
          {migrateError}
        </div>
      )}
    </div>
  )
}
