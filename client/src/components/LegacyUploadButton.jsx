import { useRef, useState } from 'react'
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import FlashButton from './common/FlashButton'

// 구 엑셀(안건 관리 시트) 업로드 — 포털 동기화와는 정반대로, PM/위원장/CFT 진행 날짜 같은
// 팀 입력 항목(TEAM_FIELDS)만 채운다. 사용자가 구 엑셀에 "계약번호" 열을 직접 추가해서 올린다.
export default function LegacyUploadButton() {
  const { migrateLegacyFile, migrating, migrateError } = useData()
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    setResult(null)
    try {
      const summary = await migrateLegacyFile(file)
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
        {migrating ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} 레거시 데이터 업로드
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
          <CheckCircle2 size={12} /> 갱신 {result.matched}건 · 신규생성 {result.created}건
          {result.unrecognizedReviewMethod.length > 0 && ` · 확인필요 ${result.unrecognizedReviewMethod.length}건`}
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
