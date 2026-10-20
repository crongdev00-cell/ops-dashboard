import { useRef, useState } from 'react'

// 클릭했다는 걸 명확히 알 수 있도록, 클릭 순간 배경색이 강조색으로 확 바뀌었다가 원래대로 돌아온다.
// active: 가상클래스(마우스를 누르고 있는 동안만)보다 오래/뚜렷하게 남아서 "클릭이 됐다"는 확신을 준다.
export default function FlashButton({ onClick, className = '', children, ...rest }) {
  const [flashing, setFlashing] = useState(false)
  const timerRef = useRef(null)

  const handleClick = (e) => {
    setFlashing(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlashing(false), 260)
    onClick?.(e)
  }

  return (
    <button
      onClick={handleClick}
      className={`${className} ${flashing ? '!border-indigo !bg-indigo !text-white' : ''} transition-colors duration-150`}
      {...rest}
    >
      {children}
    </button>
  )
}
