import { dayOfMonth, dayOfWeek, formatDateLong } from '@/lib/date'
import { tagVar } from '@/lib/tag'
import type { ISODate, PlanEvent, Todo } from '@/types'
import styles from './CalendarCell.module.css'

const MAX_VISIBLE = 3

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
  const visible = events.slice(0, MAX_VISIBLE)
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

      {visible.length > 0 && (
        <ul className={styles.events}>
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
