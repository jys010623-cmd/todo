import styles from './Donut.module.css'

interface Props {
  /** 0 ~ 1 */
  value: number
  size?: number
  stroke?: number
  /** 링 가운데에 놓을 내용. 없으면 퍼센트를 씁니다. */
  children?: React.ReactNode
  label?: string
}

/** 스터디 달성률처럼 '한 눈에 비율'만 필요한 자리에 씁니다. */
export function Donut({ value, size = 132, stroke = 11, children, label }: Props) {
  const pct = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const rounded = Math.round(pct * 100)

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? `${rounded}% 달성`}
      >
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className={styles.center}>{children ?? <span className={styles.pct}>{rounded}%</span>}</div>
    </div>
  )
}
