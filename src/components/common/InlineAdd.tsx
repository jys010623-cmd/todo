import { useEffect, useRef, useState } from 'react'
import styles from './InlineAdd.module.css'

interface Props {
  label: string
  placeholder?: string
  onSubmit: (value: string) => void
}

/**
 * 평소에는 조용한 텍스트 한 줄이었다가, 누르면 그 자리에서 입력으로 바뀝니다.
 * 별도 모달이나 카드를 띄우지 않는 것이 이 플래너의 입력 방식입니다.
 */
export function InlineAdd({ label, placeholder, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
    setValue('')
    // 연속 입력을 위해 열어 둡니다.
    inputRef.current?.focus()
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.plus}>+</span>
        {label}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      className={styles.input}
      value={value}
      placeholder={placeholder ?? label}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        // 한글은 조합하는 동안에도 Enter 가 옵니다 — 그때 넣으면 쓰다 만 글이 들어갑니다.
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          setValue('')
          setOpen(false)
        }
      }}
      onBlur={() => {
        if (value.trim()) commit()
        setOpen(false)
      }}
    />
  )
}
