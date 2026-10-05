// 부서/담당자 같은 부가정보를 " · "로 이어붙이지 않고, 아이콘이 붙은 태그로 구분해서 보여준다.
// 한 줄에 여러 속성을 욱여넣을 때 무슨 값이 부서고 무슨 값이 담당자인지 한눈에 구별되게 하기 위함.
export default function MetaTags({ items, dense = false }) {
  const visible = items.filter((item) => item.text)
  if (visible.length === 0) return null

  if (dense) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate">
        {visible.map(({ icon: Icon, text }, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <Icon size={11} /> {text}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map(({ icon: Icon, text }, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-paper px-1.5 py-0.5 text-xs text-slate">
          <Icon size={11} /> {text}
        </span>
      ))}
    </div>
  )
}
