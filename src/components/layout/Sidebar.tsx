import { formatDateShort, todayISO, weekdayLabel } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import type { ViewId } from '@/types'
import styles from './Sidebar.module.css'

const NAV: { id: ViewId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'goals', label: 'Goals' },
  { id: 'mandal', label: 'Mandal' },
  { id: 'mindmap', label: 'Mind Map' },
  { id: 'study', label: 'Study' },
  { id: 'settings', label: 'Settings' },
]

export function Sidebar() {
  const { view, setView } = usePlanner()
  const today = todayISO()

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      <div className={styles.brand}>
        <span className={styles.wordmark}>PlanMe</span>
        <span className={styles.tagline}>Paper Planner, Reimagined.</span>
      </div>

      <ul className={styles.list}>
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.item}
              data-active={view === item.id || undefined}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <span className={styles.footerDate}>{formatDateShort(today)}</span>
        <span className={styles.footerDay}>{weekdayLabel(today)}요일</span>
      </div>
    </nav>
  )
}
