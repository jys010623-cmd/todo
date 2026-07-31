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
import { nextTag } from '@/lib/entry'
import { tagSoftVar, tagTextVar, tagVar } from '@/lib/tag'
import {
  HOUR_H,
  isTimed,
  layoutDay,
  minutesAt,
  movedTimes,
  resizedEnd,
  snapDelta,
  timeAt,
  type TimedSlot,
} from '@/lib/weekgrid'
import { usePlanner } from '@/store/PlannerContext'
import type { EventOccurrence } from '@/types'
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

  /**
   * 끄는 동안의 모습. 매 움직임마다 dispatch 하면 저장까지 따라와 판이 버벅입니다.
   * 손을 뗄 때 한 번만 넘기고, 그전까지는 여기서 그립니다.
   */
  /**
   * 끌기를 시작한 순간의 원본.
   *
   * 끄는 동안 그 자리에 그려지는 것은 미리보기입니다. 거기서 값을 다시 읽으면
   * 옮긴 만큼이 매번 새로 더해져 손보다 몇 배씩 달아나고, 반복에서 펼쳐진
   * 것인지도 알 수 없게 됩니다. 기준은 처음 한 번만 잡고 끝까지 그것을 씁니다.
   */
  type DragOrigin = {
    /** 고칠 원본 일정 */
    id: string
    /** 화면에 그려지던 그 조각 — 키가 바뀌면 끌던 요소가 통째로 다시 붙습니다. */
    occurrenceId: string
    /** 반복에서 펼쳐 나온 것인지 — 미리보기를 원래 모습대로 그리는 데 씁니다. */
    virtual: boolean
    /**
     * 반복이 걸린 일정인지 — 그렇다면 요일은 고정입니다.
     *
     * 반복은 '무슨 요일' 이 곧 규칙입니다. 옆으로 끌어 날짜를 바꾸면 원본 날짜가
     * 바뀌면서 시리즈 전체가 다른 요일로 밀립니다 — 하루를 옮기려던 손짓이 조용히
     * 전부를 옮깁니다(되돌리기 대상도 아닙니다).
     *
     * '펼쳐진 날' 만 막으면 원본 날짜에서 그대로 빠져나갑니다. 그러면 같은 일정이
     * 어떤 날은 옆으로 가고 어떤 날은 안 가서, 규칙이 아니라 변덕처럼 보입니다.
     */
    repeats: boolean
    fromDate: string
    fromStart: string
    fromEnd?: string
  }

  type Dragging = DragOrigin & {
    kind: 'move' | 'resize'
    /** 끄는 동안 그려 줄 열 */
    date: string
    /**
     * 저장할 날짜. 반복에서 펼쳐진 것은 없습니다 —
     * 원본 날짜를 옮기면 시리즈 전체가 다른 요일로 밀립니다. 시간만 바꿉니다.
     */
    commitDate?: string
    start: string
    end?: string
  }
  const [dragging, setDragging] = useState<Dragging | null>(null)

  /*
   * 손을 뗄 때 쓸 값은 ref 로도 들고 있습니다.
   * 빠르게 끌면 pointermove 의 setState 가 반영되기 전에 pointerup 이 옵니다.
   * 그때 상태만 보면 아직 null 이라 아무 일도 일어나지 않습니다.
   */
  const draggingRef = useRef<Dragging | null>(null)
  const setDrag = (next: Dragging | null) => {
    draggingRef.current = next
    setDragging(next)
  }

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

  /**
   * 손이 가로로 어느 날 위에 있는지.
   * 일곱 열은 폭이 같고 서로 붙어 있으므로, 첫 열 하나만 재면 나머지가 따라옵니다.
   */
  const firstColumnRef = useRef<HTMLDivElement>(null)
  const dayUnder = (clientX: number): string | undefined => {
    const box = firstColumnRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return undefined
    const index = Math.floor((clientX - box.left) / box.width)
    return days[Math.min(Math.max(index, 0), days.length - 1)]
  }

  const commit = () => {
    const title = draft.trim()
    if (composing && title) {
      const dayEvents = eventsByDate.get(composing.date) ?? []
      // 시간은 누른 자리가 정합니다. 반복은 오른쪽 패널의 일정 줄에서 고릅니다.
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
                      value={e.repeat ? `${e.title} ↻` : e.title}
                      editValue={e.title}
                      label={e.title}
                      className={styles.chipTitle}
                      onCommit={(title) =>
                        dispatch({ type: 'UPDATE_EVENT', id: e.sourceId, patch: { title } })
                      }
                    />
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={
                        e.virtual ? `${e.title} 이 날만 건너뛰기` : `${e.title} 일정 삭제`
                      }
                      onClick={() =>
                        e.virtual
                          ? dispatch({ type: 'SKIP_OCCURRENCE', id: e.sourceId, date: e.date })
                          : dispatch({ type: 'DELETE_EVENT', id: e.sourceId })
                      }
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
              /*
               * 끄는 중인 일정은 살아 있는 값으로 갈아 끼워 배치에 넘깁니다.
               * 날짜를 건너뛰는 중이면 원래 날에서는 빼고 새 날에 얹습니다.
               */
              let timed = (eventsByDate.get(date) ?? []).filter(isTimed)
              if (dragging) {
                /*
                 * 끌고 있는 그 조각만 뺍니다.
                 * sourceId 로 빼면 매일 반복이 걸린 일정은 이레 치가 한꺼번에
                 * 사라져, 하나를 옮기는 동안 판이 텅 비어 보입니다.
                 */
                timed = timed.filter((e) => e.id !== dragging.occurrenceId)
                if (dragging.date === date) {
                  const source = data.events.find((e) => e.id === dragging.id)
                  if (source) {
                    timed = [
                      ...timed,
                      {
                        ...source,
                        // 키를 그대로 둡니다 — 바뀌면 끌던 요소가 다시 붙어 손을 놓칩니다.
                        id: dragging.occurrenceId,
                        date,
                        start: dragging.start,
                        end: dragging.end,
                        sourceId: source.id,
                        virtual: dragging.virtual,
                      },
                    ]
                  }
                }
              }
              /*
               * 뒤로 밀린 칸이 위에 얹혀야 겹친 자리가 제대로 보입니다.
               * 모두 같은 z-index 라 그리는 차례가 곧 위아래입니다.
               */
              const slots = layoutDay(timed).sort((a, b) => a.column - b.column)
              const composingHere = composing?.date === date

              return (
                <div
                  key={date}
                  className={styles.column}
                  data-selected={date === selectedDate || undefined}
                  ref={date === days[0] ? firstColumnRef : undefined}
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
                      dragging={dragging?.occurrenceId === slot.event.id}
                      onDrag={(kind, dy, clientX) => {
                        const e = slot.event
                        /*
                         * 두 번째 움직임부터 slot.event 는 미리보기입니다.
                         * 처음 한 번 잡아 둔 원본을 끝까지 기준으로 씁니다.
                         */
                        const from: DragOrigin = draggingRef.current ?? {
                          // 반복이라도 시간은 원본이 들고 있으므로 sourceId 로 고칩니다.
                          id: e.sourceId,
                          occurrenceId: e.id,
                          virtual: e.virtual,
                          repeats: Boolean(e.repeat),
                          fromDate: e.date,
                          fromStart: e.start as string,
                          fromEnd: e.end,
                        }
                        const delta = snapDelta(dy)

                        if (kind === 'resize') {
                          setDrag({
                            ...from,
                            kind,
                            date: from.fromDate,
                            start: from.fromStart,
                            end: resizedEnd(from.fromStart, from.fromEnd, delta),
                          })
                          return
                        }

                        const moved = movedTimes(from.fromStart, from.fromEnd, delta)
                        // 반복은 요일이 곧 규칙이라 옆으로는 가지 않습니다 — 시각만 바뀝니다.
                        const to = from.repeats
                          ? from.fromDate
                          : (dayUnder(clientX) ?? from.fromDate)
                        setDrag({
                          ...from,
                          kind,
                          date: to,
                          // 반복에서 펼쳐진 날은 원본 날짜를 건드리면 시리즈가 통째로 밀립니다.
                          commitDate: from.virtual ? undefined : to,
                          ...moved,
                        })
                      }}
                      onDragEnd={() => {
                        const d = draggingRef.current
                        if (!d) return
                        // date 를 undefined 로 넘기면 그대로 덮어써 일정이 날짜를 잃습니다.
                        dispatch({
                          type: 'UPDATE_EVENT',
                          id: d.id,
                          patch: d.commitDate
                            ? { date: d.commitDate, start: d.start, end: d.end }
                            : { start: d.start, end: d.end },
                        })
                        setDrag(null)
                      }}
                      onCommit={(title) =>
                        dispatch({
                          type: 'UPDATE_EVENT',
                          id: slot.event.sourceId,
                          patch: { title },
                        })
                      }
                      onDelete={() =>
                        slot.event.virtual
                          ? dispatch({
                              type: 'SKIP_OCCURRENCE',
                              id: slot.event.sourceId,
                              date: slot.event.date,
                            })
                          : dispatch({ type: 'DELETE_EVENT', id: slot.event.sourceId })
                      }
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
  slot: TimedSlot<EventOccurrence>
  hour12: boolean
  dragging: boolean
  onDrag: (kind: 'move' | 'resize', dy: number, clientX: number) => void
  onDragEnd: () => void
  onCommit: (next: string) => void
  onDelete: () => void
}

function EventBlock({ slot, hour12, dragging, onDrag, onDragEnd, onCommit, onDelete }: BlockProps) {
  const { event, top, height, left, width } = slot
  /*
   * 열을 다 쓰지 못하는 칸. 남는 자리에 '19:00 – 21:00' 이 들어가지 않고
   * '19:00 –' 로 잘립니다. 잘린 범위는 읽을 수도 없으면서 제목이 쓸 줄만 한 줄
   * 빼앗아 갑니다 — 그럴 바에는 시작 시각만 둡니다. 끝나는 시각은 오른쪽 패널과
   * 블록 높이가 이미 말해 줍니다.
   */
  const narrow = width < 99.9

  /**
   * 끌기와 '눌러서 고치기' 가 같은 자리에서 일어납니다.
   * 몇 px 이상 움직였을 때만 끌기로 보고, 그때는 뒤따라오는 click 을 막습니다.
   */
  const grab = useRef<{ x: number; y: number; kind: 'move' | 'resize'; moved: boolean } | null>(
    null,
  )
  const draggedRef = useRef(false)

  const start = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
    // 제목은 잡아 끌 수 있어야 하지만, 고치려고 연 입력은 그대로 둡니다.
    if ((e.target as HTMLElement).closest('textarea, input, [data-no-drag]')) return
    /*
     * 아래 손잡이는 블록 안에 있습니다. 여기서 막지 않으면 블록의 pointerdown 이
     * 뒤이어 돌면서 방금 잡은 'resize' 를 'move' 로 덮어씁니다 — 끝만 늘리려던 것이
     * 통째로 밀려 내려갑니다.
     */
    e.stopPropagation()
    grab.current = { x: e.clientX, y: e.clientY, kind, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 붙잡지 못해도 끌기는 이어집니다 */
    }
  }

  const move = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g) return
    const dy = e.clientY - g.y
    /*
     * 손이 조금 떨린 것까지 끌기로 보면 글자를 못 고칩니다.
     * 다만 가로도 함께 봐야 합니다 — 시각은 그대로 두고 옆 날로만 옮기는 것이
     * 세로로는 한 픽셀도 안 움직이는 끌기라, 세로만 재면 그 동작이 통째로 막힙니다.
     */
    if (!g.moved && Math.abs(dy) < 4 && Math.abs(e.clientX - g.x) < 4) return
    g.moved = true
    onDrag(g.kind, dy, e.clientX)
  }

  const end = (e: React.PointerEvent) => {
    const g = grab.current
    grab.current = null
    if (!g) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* 무시 */
    }
    if (!g.moved) return
    draggedRef.current = true
    onDragEnd()
  }

  return (
    <div
      data-event
      className={styles.block}
      data-short={height < HOUR_H * 0.7 || undefined}
      data-narrow={narrow || undefined}
      data-dragging={dragging || undefined}
      onPointerDown={start('move')}
      onPointerMove={move}
      onPointerUp={end}
      onClickCapture={(e) => {
        if (!draggedRef.current) return
        draggedRef.current = false
        e.stopPropagation()
        e.preventDefault()
      }}
      style={{
        top,
        height,
        left: `${left}%`,
        width: `${width}%`,
        background: tagSoftVar(event.tag),
        color: tagTextVar(event.tag),
      }}
    >
      <span className={styles.chipBar} style={{ background: tagVar(event.tag) }} />
      <span className={styles.blockTime}>
        {formatTime(event.start, hour12)}
        {!narrow && event.end ? ` – ${formatTime(event.end, hour12)}` : ''}
        {/* 반복인 줄 모르면 하나 지웠다가 다음 주에 또 나와 당황합니다. */}
        {event.repeat && <span className={styles.repeat}> ↻</span>}
      </span>
      <InlineEdit
        value={event.title}
        label={event.title}
        className={styles.blockTitle}
        onCommit={onCommit}
      />
      <button
        type="button"
        data-no-drag
        className={styles.remove}
        aria-label={
          event.virtual ? `${event.title} 이 날만 건너뛰기` : `${event.title} 일정 삭제`
        }
        onClick={onDelete}
      >
        ×
      </button>

      {/* 아래 모서리를 잡으면 끝나는 시각만 바뀝니다. */}
      <span
        className={styles.grip}
        aria-hidden="true"
        onPointerDown={start('resize')}
        onPointerMove={move}
        onPointerUp={end}
      />
    </div>
  )
}
