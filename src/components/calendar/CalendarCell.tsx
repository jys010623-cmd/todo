import { useLayoutEffect, useRef, useState } from 'react'

import { dayOfMonth, dayOfWeek, formatDateLong } from '@/lib/date'
import { tagVar } from '@/lib/tag'
import type { ISODate, PlanEvent, Todo } from '@/types'
import styles from './CalendarCell.module.css'

/** 칸이 아무리 높아도 이 이상은 늘어놓지 않습니다 — 그 위는 +N 으로 접습니다. */
const MAX_VISIBLE = 3

/** .events 의 gap 과 같아야 합니다. */
const GAP = 3

interface Props {
  date: ISODate
  events: PlanEvent[]
  todos: Todo[]
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  onSelect: (date: ISODate) => void
}

export function CalendarCell({
  date,
  events,
  todos,
  inMonth,
  isToday,
  isSelected,
  onSelect,
}: Props) {
  /**
   * 몇 개가 들어가는지는 칸 높이에 달려 있습니다.
   * 고정된 개수를 늘어놓고 넘치는 만큼 잘라내면 마지막 줄이 글자 중간에서 끊겨,
   * 잘린 획이 아랫줄과 겹쳐 보입니다. 온전히 들어가는 만큼만 그립니다.
   *
   * .events 는 남는 높이를 모두 받으므로(flex-grow) 몇 개를 그리든 높이가 같습니다.
   * 그래서 개수를 줄여도 다시 계산이 뒤집히지 않습니다.
   */
  const listRef = useRef<HTMLUListElement>(null)
  const [fits, setFits] = useState(MAX_VISIBLE)
  // 한 줄 높이는 늘 같습니다. 하나도 안 그리게 된 뒤에도 다시 셈하려면 기억해 둬야 합니다.
  const rowHeight = useRef(0)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const measure = () => {
      const row = list.firstElementChild?.getBoundingClientRect().height
      if (row) rowHeight.current = row
      if (!rowHeight.current) return
      const next = Math.floor((list.clientHeight + GAP) / (rowHeight.current + GAP))
      setFits(Math.max(0, Math.min(MAX_VISIBLE, next)))
    }

    measure()
    // 창 크기가 바뀌면 칸 높이도 따라 바뀝니다.
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [events.length])

  const visible = events.slice(0, fits)
  const overflow = events.length - visible.length
  const doneCount = todos.filter((t) => t.done).length
  const weekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6

  // 칸 안의 숫자만으로는 무슨 날인지 읽히지 않아 이름을 따로 붙입니다.
  const label = [
    formatDateLong(date),
    isToday ? '오늘' : null,
    events.length > 0 ? `일정 ${events.length}개` : null,
    todos.length > 0 ? `할 일 ${doneCount}/${todos.length}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      role="gridcell"
      aria-label={label}
      aria-selected={isSelected}
      data-date={date}
      tabIndex={isSelected ? 0 : -1}
      className={styles.cell}
      data-out={!inMonth || undefined}
      data-selected={isSelected || undefined}
      data-weekend={weekend || undefined}
      onClick={() => onSelect(date)}
    >
      <div className={styles.dateRow}>
        <span className={styles.date} data-today={isToday || undefined}>
          {dayOfMonth(date)}
        </span>
      </div>

      {/* 하나도 안 들어가는 칸에서도 높이를 재야 해서, 일정이 있으면 목록은 그대로 둡니다. */}
      {events.length > 0 && (
        <ul ref={listRef} className={styles.events}>
          {visible.map((e) => (
            <li key={e.id} className={styles.event}>
              <span className={styles.tagBar} style={{ background: tagVar(e.tag) }} />
              <span className={styles.eventTitle}>{e.title}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        {overflow > 0 && <span className={styles.more}>+{overflow}</span>}
        {todos.length > 0 && (
          <span className={styles.todoCount} data-all-done={doneCount === todos.length || undefined}>
            할 일 {doneCount}/{todos.length}
          </span>
        )}
      </div>
    </div>
  )
}
