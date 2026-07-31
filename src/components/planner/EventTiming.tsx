import { useState } from 'react'
import { dayOfWeek, formatDateShort, formatTime } from '@/lib/date'
import { eventTiming, timingToPatch } from '@/lib/entry'
import { anchorFor, repeatLabel } from '@/lib/repeat'
import { usePlanner } from '@/store/PlannerContext'
import type { EventOccurrence, Repeat } from '@/types'
import { EventFields } from './EventFields'
import styles from './EventTiming.module.css'

interface Props {
  event: EventOccurrence
}

/**
 * 일정 줄에 붙는 시간·반복.
 *
 * 평소에는 '10:00 – 12:00' 한 줄로 읽히다가, 누르면 그 자리에서 고르는 칸이 됩니다.
 * 읽는 자리와 고치는 자리가 같아야 어디를 눌러야 할지 찾지 않습니다.
 *
 * 반복에서 펼쳐진 날의 시간을 고치면 규칙 자체가 바뀝니다 — 이 자리에서 그 날
 * 하나만 따로 옮길 수는 없습니다(× 로 그 날만 건너뛰는 것과 다릅니다).
 */
export function EventTiming({ event }: Props) {
  const { data, dispatch } = usePlanner()
  const [open, setOpen] = useState(false)

  const hour12 = data.settings.hour12
  const start = event.start ? formatTime(event.start, hour12) : undefined
  const end = event.end ? formatTime(event.end, hour12) : undefined
  const time = start ? (end ? `${start} – ${end}` : start) : '종일'
  const repeat = repeatLabel(event.repeat)
  // 'YYYY-MM-DD' 는 사전순이 곧 날짜순입니다.
  const skipped = [...(event.repeat?.skip ?? [])].sort()
  /** 규칙을 들고 있는 것은 펼쳐진 날이 아니라 원본입니다. */
  const source = data.events.find((e) => e.id === event.sourceId)

  return (
    <div className={styles.timing}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-label={`${event.title} 시간과 반복`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.time}>{time}</span>
        {repeat && <span className={styles.repeat}>{repeat}</span>}
      </button>

      {open && (
        <>
          <EventFields
            name={event.title}
            /* 요일을 안 골랐으면 시작한 날의 요일이 곧 규칙입니다 — 그것을 켜서 보여 줍니다. */
            anchorDay={source ? dayOfWeek(source.date) : undefined}
            value={eventTiming(event)}
            onChange={(next) => {
              const patch = timingToPatch(next, event.repeat)
              /*
               * 고른 요일에 시작 날짜가 없으면 '규칙에는 없는데 원본이라 남아 있는 날' 이
               * 하나 생깁니다. 시작을 첫 번째 맞는 날로 옮겨 규칙과 어긋나지 않게 합니다 —
               * 수요일을 빼고 토요일만 고르는 것이 곧 요일을 옮기는 방법이기도 합니다.
               */
              const anchored = source ? anchorFor(source.date, patch.repeat?.days) : undefined
              dispatch({
                type: 'UPDATE_EVENT',
                id: event.sourceId,
                patch:
                  anchored && anchored !== source?.date ? { ...patch, date: anchored } : patch,
              })
            }}
          />

          {/*
           * 건너뛴 날.
           *
           * × 한 번이면 그 날이 목록에서 사라지는데, 되살릴 자리가 없으면 잘못 눌렀을 때
           * 방법이 없습니다. 규칙을 펼쳐 보는 이 자리에 함께 둡니다 — 무엇을 빼 놨는지도
           * 여기서 알게 됩니다.
           */}
          {skipped.length > 0 && (
            <div className={styles.skips}>
              <span className={styles.skipLabel}>건너뛴 날</span>
              {skipped.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={styles.skip}
                  aria-label={`${formatDateShort(date)} 다시 살리기`}
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_EVENT',
                      id: event.sourceId,
                      patch: {
                        repeat: {
                          ...(event.repeat as Repeat),
                          skip: skipped.filter((d) => d !== date),
                        },
                      },
                    })
                  }
                >
                  {formatDateShort(date)}
                  <span className={styles.skipUndo} aria-hidden="true">
                    ↩
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
