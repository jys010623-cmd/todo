import { formatDateShort, todayISO, weekdayLabel } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import type { ViewId } from '@/types'
import styles from './Sidebar.module.css'

/**
 * short 는 아래 막대가 되는 좁은 화면에서 씁니다.
 * 아홉 개를 영어 이름 그대로 늘어놓으면 375px 에 들어가지 않아 뒤쪽이 잘립니다.
 * 화면 제목이 이미 한글이라 짧게 줄이면서 그쪽에 맞췄습니다.
 */
const NAV: { id: ViewId; label: string; short: string }[] = [
  { id: 'home', label: 'Home', short: '홈' },
  { id: 'today', label: 'Today', short: '오늘' },
  { id: 'week', label: 'Week', short: '주간' },
  { id: 'month', label: 'Month', short: '월간' },
  { id: 'goals', label: 'Goals', short: '목표' },
  { id: 'mandal', label: 'Mandal', short: '만다라트' },
  { id: 'mindmap', label: 'Mind Map', short: '마인드맵' },
  { id: 'study', label: 'Study', short: '스터디' },
  { id: 'settings', label: 'Settings', short: '설정' },
]

export function Sidebar() {
  const { view, setView } = usePlanner()
  const today = todayISO()

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {/* 이름을 누르면 홈으로 — 어디서든 돌아올 자리가 하나는 있어야 합니다. */}
      <button type="button" className={styles.brand} onClick={() => setView('home')}>
        <span className={styles.wordmark}>PlanMe</span>
        <span className={styles.tagline}>Paper Planner, Reimagined.</span>
      </button>

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
              <span className={styles.labelFull}>{item.label}</span>
              <span className={styles.labelShort}>{item.short}</span>
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
