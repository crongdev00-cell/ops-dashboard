import { useEffect } from 'react'

// 모달/패널에서 Esc로 닫을 수 있게 하는 공용 훅. enabled=false면 리스너를 등록하지 않는다
// (항상 마운트된 채 open prop으로만 표시 여부를 제어하는 패널에서 필요).
export function useEscapeKey(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, enabled])
}
