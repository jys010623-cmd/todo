import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
import { eventToInput, inputToEventPatch, nextTag } from '@/lib/entry'
import { tagSoftVar, tagTextVar, tagVar } from '@/lib/tag'
import {
  HOUR_H,
  isTimed,
  layoutDay,
  minutesAt,
  timeAt,
  type TimedSlot,
} from '@/lib/weekgrid'
import { usePlanner } from '@/store/PlannerContext'
import styles from './WeekView.module.css'

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** 처음 열었을 때 눈에 들어와야 하는 시각 — 하루가 대개 여기서 시작합니다. */
const FIRST_HOUR = 7

export function WeekView() {
  const { selectedDate, selectDate, eventsByDate, todosByDate, data, dispatch } = usePlanner()

  const today = todayISO()
  const { weekStart, hour12 } = data.settings
  const days = useMemo(() => weekDays(selectedDate, weekStart), [selectedDate, weekStart])
  const inThisWeek = days.includes(today)

  /** 격자에서 누른 자리 — 여기에 입력창이 뜹니다. */
  const [composing, setComposing] = useState<{ date: string; minutes: number } | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (composing) inputRef.current?.focus()
  }, [composing])

  /*
   * 주가 바뀌면 쓰다 만 입력은 닫습니다 — 안 보이는 날짜에 남아 있게 됩니다.
   * selectedDate 로 걸면 안 됩니다. 빈 칸을 누르면 그 날이 선택되면서 이 effect 가
   * 돌아, 방금 연 입력을 그 자리에서 지웁니다(두 번 눌러야 열립니다).
   */
  const weekKey = days[0]
  useEffect(() => {
    setComposing(null)
    setDraft('')
  }, [weekKey])

  /** 자정부터 그리면 빈 새벽만 보입니다. 하루가 시작하는 자리로 내려 둡니다. */
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useLayoutEffect(() => {
    if (scrolled.current || !scrollRef.current) return
    scrollRef.current.scrollTop = FIRST_HOUR * HOUR_H
    scrolled.current = true
  }, [])

  /** 오늘 열의 '지금' 선 — 1분마다 내려갑니다. */
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const commit = () => {
    const title = draft.trim()
    if (composing && title) {
      const dayEvents = eventsByDate.get(composing.date) ?? []
      dispatch({
        type: 'ADD_EVENT',
        date: composing.date,
        title,
        start: timeAt(composing.minutes),
        tag: nextTag(dayEvents.length),
      })
    }
    setDraft('')
    setComposing(null)
  }

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

      <div className={styles.week} style={{ '--hour-h': `${HOUR_H}px` } as React.CSSProperties}>
        {/*
         * 머리·종일·격자가 한 스크롤 안에 있어야 열이 맞습니다.
         * 격자만 따로 스크롤시키면 그쪽만 스크롤바 폭만큼 좁아져 선이 틀어집니다.
         */}
        <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.sticky}>
        {/* ── 요일 머리 ── */}
        <div className={styles.head}>
          <div className={styles.gutterHead} />
          {days.map((date) => (
            <button
              key={date}
              type="button"
              className={styles.dayHead}
              data-selected={date === selectedDate || undefined}
              data-out={!isSameMonth(date, selectedDate) || undefined}
              onClick={() => selectDate(date)}
            >
              <span className={styles.weekday}>{weekdayLabel(date)}</span>
              <span className={styles.date} data-today={date === today || undefined}>
                {dayOfMonth(date)}
              </span>
            </button>
          ))}
        </div>

        {/* ── 종일 — 시간 없는 일정과 할 일 ── */}
        <div className={styles.allDay}>
          <div className={styles.gutterLabel}>종일</div>
          {days.map((date) => {
            const untimed = (eventsByDate.get(date) ?? []).filter((e) => !isTimed(e))
            const todos = todosByDate.get(date) ?? []
            return (
              <div
                key={date}
                className={styles.allDayCell}
                data-selected={date === selectedDate || undefined}
              >
                {untimed.map((e) => (
                  <div
                    key={e.id}
                    className={styles.chip}
                    style={{ background: tagSoftVar(e.tag), color: tagTextVar(e.tag) }}
                  >
                    <span className={styles.chipBar} style={{ background: tagVar(e.tag) }} />
                    <InlineEdit
                      value={e.title}
                      editValue={eventToInput(e)}
                      label={e.title}
                      className={styles.chipTitle}
                      onCommit={(next) =>
                        dispatch({ type: 'UPDATE_EVENT', id: e.id, patch: inputToEventPatch(next) })
                      }
                    />
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${e.title} 일정 삭제`}
                      onClick={() => dispatch({ type: 'DELETE_EVENT', id: e.id })}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {todos.map((t) => (
                  <div key={t.id} className={styles.todo}>
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
                  </div>
                ))}

                <div className={styles.add}>
                  <InlineAdd
                    label="할 일"
                    placeholder="할 일"
                    onSubmit={(title) => dispatch({ type: 'ADD_TODO', date, title })}
                  />
                </div>
              </div>
            )
          })}
        </div>
        </div>

        {/* ── 시간 격자 ── */}
          <div className={styles.grid}>
            <div className={styles.gutter}>
              {HOURS.map((h) => (
                <div key={h} className={styles.hourLabel}>
                  {formatTime(`${String(h).padStart(2, '0')}:00`, hour12)}
                </div>
              ))}
            </div>

            {days.map((date) => {
              const timed = (eventsByDate.get(date) ?? []).filter(isTimed)
              const slots = layoutDay(timed)
              const composingHere = composing?.date === date

              return (
                <div
                  key={date}
                  className={styles.column}
                  data-selected={date === selectedDate || undefined}
                  onClick={(e) => {
                    // 일정 위를 누른 것은 그 일정의 몫입니다.
                    if ((e.target as HTMLElement).closest('[data-event]')) return
                    const box = e.currentTarget.getBoundingClientRect()
                    selectDate(date)
                    setDraft('')
                    setComposing({ date, minutes: minutesAt(e.clientY - box.top) })
                  }}
                >
                  {HOURS.map((h) => (
                    <div key={h} className={styles.hourLine} />
                  ))}

                  {date === today && (
                    <div
                      className={styles.nowLine}
                      style={{ top: (nowMinutes / 60) * HOUR_H }}
                      aria-hidden="true"
                    />
                  )}

                  {slots.map((slot) => (
                    <EventBlock
                      key={slot.event.id}
                      slot={slot}
                      hour12={hour12}
                      onCommit={(next) =>
                        dispatch({
                          type: 'UPDATE_EVENT',
                          id: slot.event.id,
                          patch: inputToEventPatch(next),
                        })
                      }
                      onDelete={() => dispatch({ type: 'DELETE_EVENT', id: slot.event.id })}
                    />
                  ))}

                  {composingHere && composing && (
                    <div
                      className={styles.composer}
                      style={{ top: (composing.minutes / 60) * HOUR_H }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={styles.composerTime}>
                        {formatTime(timeAt(composing.minutes), hour12)}
                      </span>
                      <input
                        ref={inputRef}
                        className={styles.composerInput}
                        value={draft}
                        placeholder="무엇을 하나요?"
                        aria-label={`${timeAt(composing.minutes)} 일정 추가`}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commit()
                          if (e.key === 'Escape') {
                            setDraft('')
                            setComposing(null)
                          }
                        }}
                        onBlur={commit}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

interface BlockProps {
  slot: TimedSlot
  hour12: boolean
  onCommit: (next: string) => void
  onDelete: () => void
}

function EventBlock({ slot, hour12, onCommit, onDelete }: BlockProps) {
  const { event, top, height, column, columns } = slot
  const width = 100 / columns

  return (
    <div
      data-event
      className={styles.block}
      data-short={height < HOUR_H * 0.7 || undefined}
      style={{
        top,
        height,
        left: `${column * width}%`,
        width: `${width}%`,
        background: tagSoftVar(event.tag),
        color: tagTextVar(event.tag),
      }}
    >
      <span className={styles.chipBar} style={{ background: tagVar(event.tag) }} />
      <span className={styles.blockTime}>
        {formatTime(event.start, hour12)}
        {event.end ? ` – ${formatTime(event.end, hour12)}` : ''}
      </span>
      <InlineEdit
        value={event.title}
        editValue={eventToInput(event)}
        label={event.title}
        className={styles.blockTitle}
        onCommit={onCommit}
      />
      <button
        type="button"
        className={styles.remove}
        aria-label={`${event.title} 일정 삭제`}
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}
