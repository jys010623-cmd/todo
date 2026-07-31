import { useState } from 'react'
import { dayOfWeek, formatDateShort } from '@/lib/date'
import { timingToPatch, type Timing } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { REPEAT_WORD, anchorFor, repeatLabel } from '@/lib/repeat'
import { usePlanner } from '@/store/PlannerContext'
import {
  REPEAT_FREQS,
  TAG_COLORS,
  type Repeat,
  type RepeatFreq,
  type TagColor,
  type Todo,
  type TodoOccurrence,
} from '@/types'
import { EventFields } from './EventFields'
import styles from './TodoMeta.module.css'

interface Props {
  todo: TodoOccurrence
  /** 좁은 자리(주간 칸)에서는 색만 — 시각 칸까지 넣으면 제목이 설 자리가 없습니다. */
  compact?: boolean
}

/** 안 정함 → 다섯 색 → 다시 안 정함 */
function nextTag(tag: TagColor | undefined): TagColor | undefined {
  if (!tag) return TAG_COLORS[0]
  const at = TAG_COLORS.indexOf(tag)
  return at === TAG_COLORS.length - 1 ? undefined : TAG_COLORS[at + 1]
}

/** 되풀이 규칙에서 컨트롤 값으로 — 할 일에는 시작·끝이 없습니다. */
function todoTiming(todo: Todo): Timing {
  return {
    freq: todo.repeat?.freq,
    days: todo.repeat?.days,
    every: todo.repeat?.every,
    until: todo.repeat?.until,
  }
}

/**
 * 할 일 줄의 색과 시각과 되풀이.
 *
 * 색을 고르는 데 목록을 띄우지 않습니다 — 다섯 개뿐이라 눌러서 넘기는 편이 빠르고,
 * 이 플래너는 떠오르는 것을 쓰지 않습니다. 한 바퀴 돌면 '안 정함' 으로 돌아옵니다.
 */
export function TodoMeta({ todo, compact }: Props) {
  const { data, dispatch } = usePlanner()
  const [open, setOpen] = useState(false)

  // 되풀이에서 펼쳐진 것은 자기 id 가 따로 있어, 고칠 때는 원본을 가리켜야 합니다.
  const patch = (next: Partial<Todo>) =>
    dispatch({ type: 'UPDATE_TODO', id: todo.sourceId, patch: next })

  /** 규칙을 들고 있는 것은 펼쳐진 날이 아니라 원본입니다. */
  const source = data.todos.find((t) => t.id === todo.sourceId)
  const label = repeatLabel(todo.repeat)
  // 'YYYY-MM-DD' 는 사전순이 곧 날짜순입니다.
  const skipped = [...(todo.repeat?.skip ?? [])].sort()

  return (
    <div className={styles.meta}>
      {!compact && (
        <input
          type="time"
          className={styles.time}
          data-set={todo.time ? true : undefined}
          value={todo.time ?? ''}
          aria-label={`${todo.title} 시각`}
          /* 칸 하나에 엉뚱한 키가 들어가면 브라우저가 값을 통째로 비웁니다 — 지우기는 × 가 맡습니다. */
          onChange={(e) => e.target.value && patch({ time: e.target.value })}
        />
      )}
      {!compact && todo.time && (
        <button
          type="button"
          className={styles.clear}
          aria-label={`${todo.title} 시각 지우기`}
          onClick={() => patch({ time: undefined })}
        >
          ×
        </button>
      )}

      {/*
       * 되풀이가 없을 때는 고를 것이 '무엇으로 돌릴지' 하나뿐이라 목록으로 충분합니다.
       * 켠 뒤에는 요일·간격·마지막 날까지 붙어 한 줄에 들어가지 않으므로, 지금 무슨
       * 규칙인지를 글로 보여 주고 누르면 그 아래가 열립니다 — 일정과 같은 방식입니다.
       */}
      {!compact && !todo.repeat && (
        <select
          className={styles.repeat}
          value=""
          aria-label={`${todo.title} 되풀이`}
          onChange={(e) => {
            const freq = e.target.value as RepeatFreq
            /*
             * 되풀이를 켜면 그 날부터 시작합니다 — 펼쳐진 날에서 켰다면 원본이 아니라
             * 지금 보고 있는 날이 시작이어야 합니다.
             */
            patch({
              repeat: { freq },
              date: todo.date,
              doneOn: todo.done ? [todo.date] : undefined,
            })
          }}
        >
          <option value="">↻</option>
          {REPEAT_FREQS.map((freq) => (
            <option key={freq} value={freq}>
              {REPEAT_WORD[freq]}
            </option>
          ))}
        </select>
      )}

      {!compact && todo.repeat && (
        <button
          type="button"
          className={styles.rule}
          aria-expanded={open}
          aria-label={`${todo.title} 되풀이`}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
      )}

      {open && todo.repeat && (
        /*
         * 줄 아래에 겹쳐 띄웁니다. 줄 안에서 펼치면 목록의 나머지가 통째로 밀려,
         * 규칙 하나 고치는 동안 보고 있던 할 일들이 화면 밖으로 나갑니다.
         */
        <div className={styles.panel}>
          <EventFields
            repeatOnly
            name={todo.title}
            /* 요일을 안 골랐으면 시작한 날의 요일이 곧 규칙입니다 — 그것을 켜서 보여 줍니다. */
            anchorDay={source ? dayOfWeek(source.date) : undefined}
            value={todoTiming(todo)}
            onChange={(next) => {
              if (!next.freq) {
                // 끄면 끝낸 날 기록도 함께 내려놓습니다 — 지금 보고 있는 날의 상태만 남깁니다.
                setOpen(false)
                patch({ repeat: undefined, doneOn: undefined, done: todo.done })
                return
              }
              const repeat = timingToPatch(next, todo.repeat).repeat
              /*
               * 고른 요일에 시작 날짜가 없으면 규칙에는 없는데 원본이라 남아 있는 날이
               * 하나 생깁니다. 일정과 같이 시작을 첫 번째 맞는 날로 옮깁니다.
               */
              const anchored = source ? anchorFor(source.date, repeat?.days) : undefined
              patch(anchored && anchored !== source?.date ? { repeat, date: anchored } : { repeat })
            }}
          />

          {/*
           * 건너뛴 날.
           *
           * × 한 번이면 그 날이 목록에서 사라지는데, 되살릴 자리가 없으면 잘못 눌렀을 때
           * 방법이 없습니다. 규칙을 펼쳐 보는 이 자리에 함께 둡니다.
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
                    patch({
                      repeat: { ...(todo.repeat as Repeat), skip: skipped.filter((d) => d !== date) },
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
        </div>
      )}

      <button
        type="button"
        className={styles.dot}
        style={todo.tag ? { background: tagVar(todo.tag) } : undefined}
        data-empty={todo.tag ? undefined : true}
        aria-label={`${todo.title} 색 바꾸기`}
        onClick={() => patch({ tag: nextTag(todo.tag) })}
      />
    </div>
  )
}
