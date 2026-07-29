import { tagVar } from '@/lib/tag'
import type { TagColor } from '@/types'
import styles from './ProgressBar.module.css'

interface Props {
  /** 0 ~ 1 */
  value: number
  /** 색을 과목 태그에 맞춥니다. 없으면 accent */
  tag?: TagColor
}

export function ProgressBar({ value, tag }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={styles.track} role="presentation">
      <div
        className={styles.fill}
        style={{ width: `${pct}%`, background: tag ? tagVar(tag) : 'var(--accent)' }}
      />
    </div>
  )
}
