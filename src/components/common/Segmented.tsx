import styles from './Segmented.module.css'

interface Option<T> {
  value: T
  label: string
}

interface Props<T> {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

/** 선택지가 2~3개뿐일 때 드롭다운 대신 씁니다 — 현재 값이 항상 보이도록. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={styles.option}
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
