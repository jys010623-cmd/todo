import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import { REPEAT_FREQS, TAG_COLORS, type RepeatFreq, type TagColor, type Todo, type TodoOccurrence } from '@/types'
import { REPEAT_WORD } from '@/lib/repeat'
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

/**
 * 할 일 줄의 색과 시각.
 *
 * 색을 고르는 데 목록을 띄우지 않습니다 — 다섯 개뿐이라 눌러서 넘기는 편이 빠르고,
 * 이 플래너는 떠오르는 것을 쓰지 않습니다. 한 바퀴 돌면 '안 정함' 으로 돌아옵니다.
 */
export function TodoMeta({ todo, compact }: Props) {
  const { dispatch } = usePlanner()

  // 되풀이에서 펼쳐진 것은 자기 id 가 따로 있어, 고칠 때는 원본을 가리켜야 합니다.
  const patch = (next: Partial<Todo>) =>
    dispatch({ type: 'UPDATE_TODO', id: todo.sourceId, patch: next })

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

      {!compact && (
        <select
          className={styles.repeat}
          data-set={todo.repeat ? true : undefined}
          value={todo.repeat?.freq ?? ''}
          aria-label={`${todo.title} 되풀이`}
          onChange={(e) => {
            const freq = (e.target.value || undefined) as RepeatFreq | undefined
            /*
             * 되풀이를 켜면 그 날부터 시작합니다 — 펼쳐진 날에서 켰다면 원본이 아니라
             * 지금 보고 있는 날이 시작이어야 합니다. 끄면 끝낸 날 기록도 함께 내려놓습니다.
             */
            patch(
              freq
                ? { repeat: { freq }, date: todo.date, doneOn: todo.done ? [todo.date] : undefined }
                : { repeat: undefined, doneOn: undefined, done: todo.done },
            )
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
