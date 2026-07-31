import { useEffect, useMemo, useRef, useState } from 'react'
import { dayOfWeek, formatDateShort } from '@/lib/date'
import { frequentEvents, type Timing } from '@/lib/entry'
import { anchorFor } from '@/lib/repeat'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import type { ISODate, Repeat, TagColor } from '@/types'
import { EventFields } from './EventFields'
import styles from './EventAdd.module.css'

export interface EventDraft extends Timing {
  title: string
  /** 이 날들에 하나씩 — 늘 한 개 이상입니다. */
  dates: ISODate[]
  /** 자주 적는 것에서 가져왔다면 그때의 색. 없으면 호출부가 정합니다. */
  tag?: TagColor
}

interface Props {
  /** 기본으로 들어갈 날짜 — 지금 보고 있는 날 */
  date: ISODate
  onSubmit: (draft: EventDraft) => void
}

/**
 * 적은 것을 날짜마다 하나씩 풀어 놓습니다.
 *
 * 요일을 골랐는데 그 날짜의 요일이 거기 없으면, 규칙에는 없는데 원본이라 남아 있는
 * 날이 하나 생깁니다. 시작을 첫 번째 맞는 날로 옮겨 규칙과 어긋나지 않게 합니다.
 *
 * 두 화면(오늘·오른쪽 패널)이 같은 값을 넘겨야 해서 여기 둡니다.
 */
export function draftToEvents(draft: EventDraft) {
  const { title, dates, tag, start, end, freq, days, every, until } = draft
  const repeat: Repeat | undefined = freq
    ? {
        freq,
        days: freq === 'weekly' && days?.length ? days : undefined,
        every: every && every > 1 ? every : undefined,
        until,
      }
    : undefined

  return dates.map((date) => ({
    date: repeat ? anchorFor(date, repeat.days) : date,
    title,
    start,
    end,
    repeat,
    tag,
  }))
}

/**
 * 일정을 적는 자리.
 *
 * 평소에는 조용한 한 줄이었다가 누르면 그 자리에서 열립니다 — 모달을 띄우지 않는
 * 것이 이 플래너의 입력 방식입니다. 다만 이름 한 칸만으로는 날짜도 시간도 받을 수
 * 없어, 열렸을 때만 나머지 줄이 따라 나옵니다.
 */
export function EventAdd({ date, onSubmit }: Props) {
  const { data } = usePlanner()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [timing, setTiming] = useState<Timing>({})
  const [tag, setTag] = useState<TagColor | undefined>(undefined)
  const [dates, setDates] = useState<ISODate[]>([date])
  /*
   * 적고 난 뒤 날짜·시각 칸을 새로 답니다.
   *
   * 값을 비우는 것만으로는 부족합니다 — 브라우저의 date·time 입력은 칸 하나만
   * 채우다 만 것(연도-월-01 같은)을 값이 비어도 그대로 들고 있어, 다음 일정을
   * 적을 때 남의 자국 위에 적는 것처럼 보입니다.
   */
  const [round, setRound] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const presets = useMemo(() => frequentEvents(data.events), [data.events])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // 보고 있는 날이 바뀌면 기본 날짜도 따라갑니다.
  useEffect(() => setDates([date]), [date])

  const reset = () => {
    setTitle('')
    setTiming({})
    setTag(undefined)
    setDates([date])
    setRound((n) => n + 1)
  }

  const commit = () => {
    const trimmed = title.trim()
    // 이름 없는 일정은 목록에서 알아볼 수 없습니다 — 시간만 골라 둔 것은 버립니다.
    if (!trimmed) return
    onSubmit({ title: trimmed, dates, tag, ...timing })
    reset()
  }

  const close = () => {
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.plus}>+</span>
        일정 추가
      </button>
    )
  }

  return (
    <div
      className={styles.form}
      /*
       * 날짜나 시간을 고르러 가는 것도 이름 칸에서는 blur 입니다.
       * 칸 하나가 아니라 이 묶음 밖으로 나갔는지를 봅니다.
       */
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        commit()
        setOpen(false)
      }}
    >
      <input
        ref={inputRef}
        className={styles.title}
        value={title}
        placeholder="무엇을 하나요?"
        aria-label="일정 이름"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // 한글은 조합하는 동안에도 Enter 가 옵니다 — 그때 넣으면 쓰다 만 이름이 들어갑니다.
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') close()
        }}
      />

      {presets.length > 0 && (
        <div className={styles.presets}>
          {presets.map((preset) => (
            <button
              key={preset.title}
              type="button"
              className={styles.preset}
              /* 눌렀을 때 이름 칸의 blur 가 먼저 나면 빈 채로 닫힙니다. */
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTitle(preset.title)
                // 반복은 가져오지 않습니다 — 이미 도는 규칙 옆에 하나를 더 만들게 됩니다.
                setTiming((prev) => ({ ...prev, start: preset.start, end: preset.end }))
                setTag(preset.tag)
                inputRef.current?.focus()
              }}
            >
              <span className={styles.presetDot} style={{ background: tagVar(preset.tag) }} />
              {preset.title}
            </button>
          ))}
        </div>
      )}

      <div className={styles.dates}>
        <span className={styles.dateLabel}>날짜</span>
        {dates.map((d) => (
          <span key={d} className={styles.dateChip}>
            {formatDateShort(d)}
            {/* 하나는 남아야 합니다 — 날짜 없는 일정은 어디에도 놓을 수 없습니다. */}
            {dates.length > 1 && (
              <button
                type="button"
                className={styles.dateRemove}
                aria-label={`${formatDateShort(d)} 빼기`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDates(dates.filter((x) => x !== d))}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          key={round}
          type="date"
          className={styles.dateAdd}
          /* 고른 뒤에는 비워 둡니다 — 이 칸은 '더하는' 자리이지 값을 담는 자리가 아닙니다. */
          value=""
          aria-label="날짜 더하기"
          onChange={(e) => {
            const next = e.target.value
            if (!next || dates.includes(next)) return
            // 'YYYY-MM-DD' 는 사전순이 곧 날짜순입니다.
            setDates([...dates, next].sort())
          }}
        />
      </div>

      <div className={styles.row}>
        <EventFields
          key={round}
          name="새 일정"
          /* 요일을 안 고르면 첫 번째 날짜의 요일에 돕니다 — 그것을 켜서 보여 줍니다. */
          anchorDay={dates[0] ? dayOfWeek(dates[0]) : undefined}
          value={timing}
          onChange={setTiming}
        />
        <button
          type="button"
          className={styles.submit}
          /* 눌렀을 때 이름 칸의 blur 가 먼저 나면 같은 것이 두 번 들어갑니다. */
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            commit()
            inputRef.current?.focus()
          }}
        >
          추가
        </button>
      </div>
    </div>
  )
}
