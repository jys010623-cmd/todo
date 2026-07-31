import { useEffect, useRef, useState } from 'react'
import styles from './InlineEdit.module.css'

interface Props {
  /** 평소에 보이는 글자 */
  value: string
  /** 편집을 시작할 때 입력창에 담을 값. 없으면 value 를 씁니다. */
  editValue?: string
  onCommit: (next: string) => void
  label?: string
  /** 행마다 글자 크기·색이 달라 타이포그래피는 호출부가 정합니다. */
  className?: string
  dataDone?: boolean
}

/**
 * 누르면 그 자리에서 입력으로 바뀝니다 — InlineAdd 와 같은 방식입니다.
 * 모달을 띄우지 않는 것이 이 플래너의 편집 방식입니다.
 *
 * 한 줄짜리 input 이 아니라 textarea 를 씁니다. 주간 칸처럼 좁은 자리에서는
 * 제목이 두세 줄로 접히는데, 한 줄 입력으로 바꾸면 그 글이 한 줄로 눌리면서
 * 앞부분이 밀려 나가 다른 글로 바뀐 것처럼 보입니다. 높이도 함께 튑니다.
 */
export function InlineEdit({
  value,
  editValue,
  onCommit,
  label,
  className,
  dataDone,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const source = editValue ?? value

  /** 적힌 만큼 높이를 맞춥니다 — 접힌 줄 수가 글자와 같아야 자리가 안 움직입니다. */
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    // 먼저 풀어야 줄어들 때도 따라옵니다 — scrollHeight 는 줄어들지 않습니다.
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    el?.focus()
    el?.select()
    fit(el)
  }, [editing])

  const open = () => {
    setDraft(source)
    setEditing(true)
  }

  const commit = () => {
    const trimmed = draft.trim()
    // 비우는 것은 삭제가 아니라 취소로 봅니다 — 삭제는 × 버튼의 몫입니다.
    if (trimmed && trimmed !== source) onCommit(trimmed)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={className ? `${styles.text} ${className}` : styles.text}
        data-done={dataDone || undefined}
        aria-label={label ? `${label} 수정` : undefined}
        onClick={open}
      >
        {value}
      </button>
    )
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className ? `${styles.input} ${className}` : styles.input}
      value={draft}
      aria-label={label ? `${label} 수정` : undefined}
      onChange={(e) => {
        setDraft(e.target.value)
        fit(e.target)
      }}
      onKeyDown={(e) => {
        /*
         * 한글은 조합하는 동안에도 Enter 가 옵니다 — 마지막 글자를 앉히려고 누른
         * 것까지 '다 적었다' 로 받으면 쓰다 만 글이 저장됩니다.
         */
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') {
          // 여기서 줄을 바꿀 일은 없습니다 — 제목 한 줄을 고치는 자리입니다.
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') setEditing(false)
      }}
      onBlur={commit}
    />
  )
}
