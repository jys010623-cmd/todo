import { useId } from 'react'
import { withEnd, withStart, type Timing } from '@/lib/entry'
import { REPEAT_WORD, WEEKDAY_WORD } from '@/lib/repeat'
import { REPEAT_FREQS, type RepeatFreq } from '@/types'
import styles from './EventFields.module.css'

/** '2주마다' 처럼 부를 때의 단위 */
const EVERY_UNIT: Record<RepeatFreq, string> = {
  daily: '일',
  weekly: '주',
  monthly: '달',
}

/**
 * 고를 수 있는 간격.
 * 더 성기게 도는 것은 규칙으로 적는 것보다 그때그때 적는 편이 낫습니다.
 */
const EVERY_CHOICES = [1, 2, 3, 4]

interface Props {
  value: Timing
  onChange: (next: Timing) => void
  /** 한 화면에 여러 벌이 뜨므로, 어느 일정의 것인지 읽어 줍니다. */
  name: string
  /**
   * 요일을 따로 고르지 않았을 때 실제로 도는 요일 (0 = 일요일).
   *
   * 규칙상 요일이 비어 있으면 '시작한 날의 요일 하나' 인데, 화면에 하나도 안 켜진
   * 것으로 보여 주면 지금 무슨 요일에 도는지 알 수 없습니다. 게다가 다른 요일을
   * 하나 켜는 순간 원래 요일이 빠져, 보고 있던 줄이 눈앞에서 사라집니다.
   */
  anchorDay?: number
}

/**
 * 일정의 시간과 반복을 고르는 한 줄.
 *
 * 시각은 브라우저의 time 입력을 씁니다 — 목표일의 date 입력과 같은 방식입니다.
 * 직접 그린 목록보다 나은 점은 모양이 아니라, 기기마다 이미 있는 것(모바일의 시계 UI,
 * 키보드로 숫자를 바로 치는 것, 오전·오후 표기)을 그대로 받는다는 점입니다.
 */
export function EventFields({ value, onChange, name, anchorDay }: Props) {
  const id = useId()

  /** 화면에 켜 보일 요일 — 안 고른 상태는 '시작한 날의 요일 하나' 와 같습니다. */
  const activeDays =
    value.days?.length ? value.days : anchorDay === undefined ? [] : [anchorDay]

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-start`}>
          시작
        </label>
        <input
          id={`${id}-start`}
          type="time"
          className={styles.input}
          value={value.start ?? ''}
          aria-label={`${name} 시작 시각`}
          /*
           * 빈 값은 지우려는 뜻으로 보지 않습니다.
           *
           * 칸 하나(오전·오후 같은)에 엉뚱한 키가 들어가면 브라우저가 값을 통째로
           * 비웁니다. 그걸 '지웠다' 로 받으면 손이 미끄러진 것만으로 적어 둔 시간이
           * 사라집니다 — 지우는 것은 옆의 버튼이 따로 맡습니다.
           */
          onChange={(e) => e.target.value && onChange(withStart(value, e.target.value))}
        />
        {value.start && (
          <button
            type="button"
            className={styles.clear}
            aria-label={`${name} 종일로`}
            onClick={() => onChange(withStart(value, undefined))}
          >
            종일로
          </button>
        )}
      </div>

      <div className={styles.field} data-off={!value.start || undefined}>
        <label className={styles.label} htmlFor={`${id}-end`}>
          끝
        </label>
        <input
          id={`${id}-end`}
          type="time"
          className={styles.input}
          value={value.end ?? ''}
          /* 시작이 없으면 끝만으로는 그릴 자리가 없습니다. */
          disabled={!value.start}
          min={value.start}
          aria-label={`${name} 끝 시각`}
          onChange={(e) => e.target.value && onChange(withEnd(value, e.target.value))}
        />
        {value.end && (
          <button
            type="button"
            className={styles.clear}
            aria-label={`${name} 끝 시각 지우기`}
            onClick={() => onChange(withEnd(value, undefined))}
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-repeat`}>
          반복
        </label>
        <select
          id={`${id}-repeat`}
          className={styles.select}
          value={value.freq ?? ''}
          aria-label={`${name} 반복`}
          onChange={(e) => {
            const freq = (e.target.value || undefined) as RepeatFreq | undefined
            // 반복을 끄면 딸린 규칙도 함께 내려놓습니다 — 남겨 두면 다시 켤 때 되살아납니다.
            onChange(
              freq
                ? { ...value, freq }
                : { ...value, freq: undefined, days: undefined, every: undefined, until: undefined },
            )
          }}
        >
          <option value="">안 함</option>
          {REPEAT_FREQS.map((freq) => (
            <option key={freq} value={freq}>
              {REPEAT_WORD[freq]}
            </option>
          ))}
        </select>
      </div>

      {/*
       * 반복을 켰을 때만 나오는 둘째 줄.
       *
       * 늘 펼쳐 두면 반복 없는 일정에까지 빈 칸 넷이 붙습니다 — 대부분의 일정은
       * 한 번뿐이라, 그 자리는 없느니만 못합니다.
       */}
      {value.freq && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-every`}>
              간격
            </label>
            <select
              id={`${id}-every`}
              className={styles.select}
              value={String(value.every && value.every > 1 ? value.every : 1)}
              aria-label={`${name} 반복 간격`}
              onChange={(e) => {
                const every = Number(e.target.value)
                onChange({ ...value, every: every > 1 ? every : undefined })
              }}
            >
              {EVERY_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? REPEAT_WORD[value.freq as RepeatFreq] : `${n}${EVERY_UNIT[value.freq as RepeatFreq]}마다`}
                </option>
              ))}
            </select>
          </div>

          {value.freq === 'weekly' && (
            <div className={styles.field} role="group" aria-label={`${name} 도는 요일`}>
              <span className={styles.label}>요일</span>
              <div className={styles.weekdays}>
                {WEEKDAY_WORD.map((word, day) => {
                  const on = activeDays.includes(day)
                  // 마지막 하나까지 끄면 아무 날에도 안 오는 규칙이 됩니다.
                  const last = on && activeDays.length === 1
                  return (
                    <button
                      key={day}
                      type="button"
                      className={styles.weekday}
                      data-on={on || undefined}
                      disabled={last}
                      aria-pressed={on}
                      aria-label={`${word}요일`}
                      onClick={() => {
                        const next = on
                          ? activeDays.filter((d) => d !== day)
                          : [...activeDays, day].sort((a, b) => a - b)
                        onChange({ ...value, days: next })
                      }}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.field}>
            {/* 시각의 '끝' 과 헷갈리지 않게 — 한 화면에 둘 다 있습니다. */}
            <label className={styles.label} htmlFor={`${id}-until`}>
              마지막 날
            </label>
            <input
              id={`${id}-until`}
              type="date"
              className={styles.input}
              value={value.until ?? ''}
              aria-label={`${name} 반복이 끝나는 날`}
              onChange={(e) => e.target.value && onChange({ ...value, until: e.target.value })}
            />
            {value.until ? (
              <button
                type="button"
                className={styles.clear}
                aria-label={`${name} 끝나는 날 지우기`}
                onClick={() => onChange({ ...value, until: undefined })}
              >
                ×
              </button>
            ) : (
              <span className={styles.hint}>없으면 계속</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
