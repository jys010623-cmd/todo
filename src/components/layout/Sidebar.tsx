import { useEffect, useState } from 'react'
import { formatDateShort, todayISO, weekdayLabel } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import type { ViewId } from '@/types'
import { TimerBadge } from './TimerBadge'
import styles from './Sidebar.module.css'

interface NavItem {
  id: ViewId
  label: string
  /** 아래 막대와 더보기에서 쓰는 이름 — 화면 제목이 한글이라 그쪽에 맞췄습니다. */
  short: string
}

/**
 * 넓은 화면은 세로로 길어 열 개를 다 펼쳐도 됩니다.
 * 다만 평평하게 늘어놓으면 '오늘' 과 '만다라트' 가 같은 무게로 읽힙니다 —
 * 매일 여는 것과 가끔 펼치는 것을 눈으로 구분할 수 있게 성격끼리 묶었습니다.
 */
const GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    label: 'Plan',
    items: [
      { id: 'home', label: 'Home', short: '홈' },
      { id: 'today', label: 'Today', short: '오늘' },
      { id: 'week', label: 'Week', short: '주간' },
      { id: 'month', label: 'Month', short: '월간' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { id: 'goals', label: 'Goals', short: '목표' },
      { id: 'mandal', label: 'Mandal', short: '만다라트' },
      { id: 'mindmap', label: 'Mind Map', short: '마인드맵' },
      { id: 'study', label: 'Study', short: '스터디' },
    ],
  },
  // 이름표 없이 선 하나로만 떼어 둡니다 — 계획도 기록도 아닌 것들입니다.
  {
    items: [
      { id: 'search', label: 'Search', short: '검색' },
      { id: 'settings', label: 'Settings', short: '설정' },
    ],
  },
]

/**
 * 좁은 화면의 아래 막대에 남길 넷.
 *
 * 열 개를 다 늘어놓으면 375px 에서 한 칸이 37px 이 됩니다 — 손가락 끝보다 좁아
 * 옆 것이 눌리고, 넘치는 만큼은 밀어야 보여서 있는 줄도 모르고 지나칩니다.
 * 날짜를 따라 옮겨 다니는 것만 남기고 나머지는 더보기 안으로 넣었습니다.
 */
const PRIMARY: ViewId[] = ['home', 'today', 'week', 'month']

const ALL = GROUPS.flatMap((g) => g.items)
const BAR = PRIMARY.map((id) => ALL.find((i) => i.id === id) as NavItem)
const OVERFLOW = ALL.filter((i) => !PRIMARY.includes(i.id))

export function Sidebar() {
  const { view, setView } = usePlanner()
  const today = todayISO()
  const [moreOpen, setMoreOpen] = useState(false)

  // 화면이 바뀌었으면 더보기는 할 일을 마친 것입니다.
  useEffect(() => setMoreOpen(false), [view])

  // 열어 놓고 마음이 바뀌었을 때 — 시트를 닫는 것이 뒤로 가기보다 앞섭니다.
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const button = (item: NavItem, className: string, korean: boolean) => (
    <button
      key={item.id}
      type="button"
      className={className}
      data-active={view === item.id || undefined}
      aria-current={view === item.id ? 'page' : undefined}
      onClick={() => setView(item.id)}
    >
      {korean ? item.short : item.label}
    </button>
  )

  return (
    <nav className={styles.nav} aria-label="주요 메뉴" data-more={moreOpen || undefined}>
      {/* 이름을 누르면 홈으로 — 어디서든 돌아올 자리가 하나는 있어야 합니다. */}
      <button type="button" className={styles.brand} onClick={() => setView('home')}>
        <span className={styles.wordmark}>PlanMe</span>
        <span className={styles.tagline}>Paper Planner, Reimagined.</span>
      </button>

      <div className={styles.full}>
        {GROUPS.map((group, i) => (
          <div key={group.label ?? `rest${i}`} className={styles.group}>
            {group.label ? <span className={styles.groupLabel}>{group.label}</span> : null}
            <ul className={styles.list}>
              {group.items.map((item) => (
                <li key={item.id}>{button(item, styles.item, false)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 메뉴 아래, 날짜 위 — 좁은 화면에서는 아래 막대 바로 위로 갑니다. */}
      <div className={styles.bottom}>
        <TimerBadge />
        <div className={styles.footer}>
          <span className={styles.footerDate}>{formatDateShort(today)}</span>
          <span className={styles.footerDay}>{weekdayLabel(today)}요일</span>
        </div>
      </div>

      {/* 아래 막대 — 넓은 화면에서는 그려지지 않습니다. */}
      <div className={styles.bar}>
        {BAR.map((item) => button(item, styles.tab, true))}
        <button
          type="button"
          className={styles.tab}
          /* 더보기 안에 있는 화면을 보고 있으면 여기가 눌린 자리입니다. */
          data-active={OVERFLOW.some((i) => i.id === view) || undefined}
          aria-expanded={moreOpen}
          aria-controls="nav-more"
          onClick={() => setMoreOpen((open) => !open)}
        >
          더보기
        </button>
      </div>

      {moreOpen ? (
        <>
          {/* 시트 밖 아무 데나 눌러도 닫힙니다 — 닫기 버튼을 찾게 만들지 않습니다. */}
          <button
            type="button"
            className={styles.scrim}
            aria-label="더보기 닫기"
            onClick={() => setMoreOpen(false)}
          />
          <div id="nav-more" className={styles.sheet}>
            {OVERFLOW.map((item) => button(item, styles.sheetItem, true))}
          </div>
        </>
      ) : null}
    </nav>
  )
}
