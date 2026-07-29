import styles from './Checkbox.module.css'

interface Props {
  checked: boolean
  onChange: () => void
  label?: string
}

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={styles.box}
      data-checked={checked || undefined}
      onClick={onChange}
    >
      <svg viewBox="0 0 14 14" className={styles.check} aria-hidden="true">
        <path
          d="M3.5 7.2 6 9.7l4.6-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
