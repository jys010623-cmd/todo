import { useEffect, useMemo, useRef } from 'react'

import { addDays, monthGrid, isSameMonth, todayISO, weekdayLabels } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import { CalendarCell } from './CalendarCell'
import styles from './MonthCalendar.module.css'

export function MonthCalendar() {
  const {
    cursorMonth,
    selectedDate,
    selectDate,
    eventsByDate,
    todosByDate,
    data: { settings },
  } = usePlanner()

  const gridRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  const days = useMemo(
    () => monthGrid(cursorMonth, settings.weekStart),
    [cursorMonth, settings.weekStart],
  )
  const labels = useMemo(() => weekdayLabels(settings.weekStart), [settings.weekStart])

  // ARIA 의 grid 는 row 를 거쳐야 gridcell 에 닿습니다. 레이아웃은 display:contents 로 유지합니다.
  const weeks = useMemo(
    () => Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7)),
    [days],
  )

  // 키보드로 이동했을 때만 포커스를 따라 옮깁니다.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || !grid.contains(document.activeElement)) return
    const cell = grid.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`)
    cell?.focus()
  }, [selectedDate, days])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const move = (n: number) => {
      e.preventDefault()
      selectDate(addDays(selectedDate, n))
    }
    switch (e.key) {
      case 'ArrowLeft':
        return move(-1)
      case 'ArrowRight':
        return move(1)
      case 'ArrowUp':
        return move(-7)
      case 'ArrowDown':
        return move(7)
      case 'PageUp':
        return move(-28)
      case 'PageDown':
        return move(28)
      default:
        return undefined
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.weekdays} aria-hidden="true">
        {labels.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="월간 달력"
        className={styles.grid}
        key={cursorMonth.slice(0, 7)}
        onKeyDown={handleKeyDown}
        // 5주인 달과 6주인 달의 행 수가 달라, 남은 높이를 정확히 나누려면 CSS 가 주 수를 알아야 합니다.
        style={{ '--weeks': days.length / 7 } as React.CSSProperties}
      >
        {weeks.map((week) => (
          <div key={week[0]} role="row" className={styles.row}>
            {week.map((date) => (
              <CalendarCell
                key={date}
                date={date}
                events={eventsByDate.get(date) ?? []}
                todos={todosByDate.get(date) ?? []}
                inMonth={isSameMonth(date, cursorMonth)}
                isToday={date === today}
                isSelected={date === selectedDate}
                onSelect={selectDate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
