import { useMemo } from 'react'

import { Checkbox } from '@/components/common/Checkbox'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  addDays,
  dayOfMonth,
  formatTime,
  formatWeekRange,
  isSameMonth,
  todayISO,
  weekDays,
  weekdayLabel,
} from '@/lib/date'
import { eventToInput, inputToEventPatch } from '@/lib/entry'
import { tagSoftVar, tagTextVar, tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './WeekView.module.css'

export function WeekView() {
  const { selectedDate, selectDate, eventsByDate, todosByDate, data, dispatch } = usePlanner()

  const today = todayISO()
  const { weekStart, hour12 } = data.settings
  const days = useMemo(() => weekDays(selectedDate, weekStart), [selectedDate, weekStart])
  const inThisWeek = days.includes(today)

  return (
    <>
      <PageHeader title="주간" subtitle={formatWeekRange(selectedDate, weekStart)}>
        {!inThisWeek && (
          <button type="button" className={styles.todayBtn} onClick={() => selectDate(today)}>
            오늘
          </button>
        )}
        <button
          type="button"
          className={styles.arrow}
          aria-label="이전 주"
          onClick={() => selectDate(addDays(selectedDate, -7))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10 3 5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={styles.arrow}
          aria-label="다음 주"
          onClick={() => selectDate(addDays(selectedDate, 7))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </PageHeader>

      <div className={styles.grid}>
        {days.map((date) => {
          const events = eventsByDate.get(date) ?? []
          const todos = todosByDate.get(date) ?? []
          const isToday = date === today
          const isSelected = date === selectedDate

          return (
            <section
              key={date}
              className={styles.day}
              data-selected={isSelected || undefined}
              data-out={!isSameMonth(date, selectedDate) || undefined}
              onClick={() => selectDate(date)}
            >
              <header className={styles.dayHead}>
                <span className={styles.weekday}>{weekdayLabel(date)}</span>
                <span className={styles.date} data-today={isToday || undefined}>
                  {dayOfMonth(date)}
                </span>
              </header>

              <div className={styles.dayBody}>
                {events.length > 0 && (
                  <ul className={styles.events}>
                    {events.map((e) => (
                      <li
                        key={e.id}
                        className={styles.chip}
                        style={{ background: tagSoftVar(e.tag), color: tagTextVar(e.tag) }}
                      >
                        {e.start && (
                          <span className={styles.chipTime}>{formatTime(e.start, hour12)}</span>
                        )}
                        <InlineEdit
                          value={e.title}
                          editValue={eventToInput(e)}
                          label={e.title}
                          className={styles.chipTitle}
                          onCommit={(next) =>
                            dispatch({
                              type: 'UPDATE_EVENT',
                              id: e.id,
                              patch: inputToEventPatch(next),
                            })
                          }
                        />
                        <span className={styles.chipBar} style={{ background: tagVar(e.tag) }} />
                      </li>
                    ))}
                  </ul>
                )}

                {todos.length > 0 && (
                  <ul className={styles.todos}>
                    {todos.map((t) => (
                      <li key={t.id} className={styles.todo}>
                        <Checkbox
                          checked={t.done}
                          label={t.title}
                          onChange={() => dispatch({ type: 'TOGGLE_TODO', id: t.id })}
                        />
                        <InlineEdit
                          value={t.title}
                          label={t.title}
                          className={styles.todoTitle}
                          dataDone={t.done}
                          onCommit={(title) =>
                            dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title } })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.add}>
                  <InlineAdd
                    label="할 일"
                    placeholder="할 일"
                    onSubmit={(title) => dispatch({ type: 'ADD_TODO', date, title })}
                  />
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
