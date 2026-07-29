import { Checkbox } from '@/components/common/Checkbox'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { ProgressBar } from '@/components/common/ProgressBar'
import { SectionHeader } from '@/components/common/SectionHeader'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDateLong, formatMinutes, formatTime, todayISO } from '@/lib/date'
import { eventToInput, inputToEventPatch, nextTag, parseTimePrefix } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './TodayView.module.css'

/**
 * 오늘 하루만 크게 펼쳐 봅니다.
 * 다른 뷰와 달리 선택 날짜를 따라가지 않고 항상 '오늘' 에 고정됩니다.
 */
export function TodayView() {
  const { eventsByDate, todosByDate, studyMinutesByDate, data, dispatch } = usePlanner()

  const today = todayISO()
  const events = eventsByDate.get(today) ?? []
  const todos = todosByDate.get(today) ?? []
  const studyMinutes = studyMinutesByDate.get(today) ?? 0
  const note = data.notes[today] ?? ''
  const doneCount = todos.filter((t) => t.done).length

  return (
    <div className={styles.scroll}>
      <PageHeader title="오늘" subtitle={formatDateLong(today)} />

      <div className={styles.body}>
        <section className={styles.summary}>
          <div className={styles.summaryHead}>
            <span className={styles.summaryLabel}>
              {todos.length > 0
                ? `할 일 ${doneCount}/${todos.length} 완료`
                : '오늘 할 일이 아직 없습니다'}
            </span>
            {studyMinutes > 0 && (
              <span className={styles.summaryStudy}>공부 {formatMinutes(studyMinutes)}</span>
            )}
          </div>
          <ProgressBar value={todos.length === 0 ? 0 : doneCount / todos.length} />
        </section>

        <div className={styles.cols}>
          <section className={styles.col}>
            <SectionHeader title="일정" meta={events.length > 0 ? events.length : undefined} />

            {events.length > 0 ? (
              <ul className={styles.timeline}>
                {events.map((e) => (
                  <li key={e.id} className={styles.slot}>
                    <span className={styles.slotTime}>
                      {e.start ? formatTime(e.start, data.settings.hour12) : '종일'}
                    </span>
                    <span className={styles.dot} style={{ background: tagVar(e.tag) }} />
                    <div className={styles.slotBody}>
                      <InlineEdit
                        value={e.title}
                        editValue={eventToInput(e)}
                        label={e.title}
                        className={styles.slotTitle}
                        onCommit={(next) =>
                          dispatch({
                            type: 'UPDATE_EVENT',
                            id: e.id,
                            patch: inputToEventPatch(next),
                          })
                        }
                      />
                      {e.end && (
                        <span className={styles.slotEnd}>
                          ~ {formatTime(e.end, data.settings.hour12)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${e.title} 일정 삭제`}
                      onClick={() => dispatch({ type: 'DELETE_EVENT', id: e.id })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>비어 있는 하루입니다.</p>
            )}

            <InlineAdd
              label="일정 추가"
              placeholder="10:00 팀 회의"
              onSubmit={(value) => {
                const { start, title } = parseTimePrefix(value)
                dispatch({
                  type: 'ADD_EVENT',
                  date: today,
                  title,
                  start,
                  tag: nextTag(events.length),
                })
              }}
            />
          </section>

          <section className={styles.col}>
            <SectionHeader
              title="할 일"
              meta={todos.length > 0 ? `${doneCount}/${todos.length}` : undefined}
            />

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
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${t.title} 할 일 삭제`}
                      onClick={() => dispatch({ type: 'DELETE_TODO', id: t.id })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <InlineAdd
              label="할 일 추가"
              placeholder="무엇을 할까요?"
              onSubmit={(title) => dispatch({ type: 'ADD_TODO', date: today, title })}
            />

            <div className={styles.noteBlock}>
              <SectionHeader title="메모" />
              <textarea
                className={styles.note}
                value={note}
                placeholder="오늘에 대해 남기고 싶은 것"
                onChange={(e) =>
                  dispatch({ type: 'SET_NOTE', date: today, text: e.target.value })
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
