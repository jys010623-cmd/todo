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
  const inputRef = useRef<HTMLInputElement>(null)

  const source = editValue ?? value

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    input?.focus()
    input?.select()
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
    <input
      ref={inputRef}
      className={className ? `${styles.input} ${className}` : styles.input}
      value={draft}
      aria-label={label ? `${label} 수정` : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      onBlur={commit}
    />
  )
}
