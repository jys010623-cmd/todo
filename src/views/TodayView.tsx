import { Checkbox } from '@/components/common/Checkbox'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { ProgressBar } from '@/components/common/ProgressBar'
import { SectionHeader } from '@/components/common/SectionHeader'
import { PageHeader } from '@/components/layout/PageHeader'
import { EventAdd, draftToEvents } from '@/components/planner/EventAdd'
import { EventTiming } from '@/components/planner/EventTiming'
import { TodoMeta } from '@/components/planner/TodoMeta'
import { formatDateLong, formatDateShort, formatMinutes, formatTime, todayISO } from '@/lib/date'
import { nextTag } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './TodayView.module.css'

/**
 * 오늘 하루만 크게 펼쳐 봅니다.
 * 다른 뷰와 달리 선택 날짜를 따라가지 않고 항상 '오늘' 에 고정됩니다.
 */
export function TodayView() {
  const { eventsByDate, todosByDate, studyMinutesByDate, overdueTodos, data, dispatch } =
    usePlanner()

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
                        label={e.title}
                        className={styles.slotTitle}
                        onCommit={(title) =>
                          dispatch({ type: 'UPDATE_EVENT', id: e.sourceId, patch: { title } })
                        }
                      />
                      <EventTiming event={e} />
                    </div>
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>비어 있는 하루입니다.</p>
            )}

            <EventAdd
              date={today}
              onSubmit={(draft) =>
                // 고른 날마다 하나씩 — 날짜만 다르고 나머지는 같습니다.
                draftToEvents(draft).forEach((event) =>
                  dispatch({
                    type: 'ADD_EVENT',
                    ...event,
                    tag: event.tag ?? nextTag((eventsByDate.get(event.date) ?? []).length),
                  }),
                )
              }
            />
          </section>

          <section className={styles.col}>
            {overdueTodos.length > 0 && (
              <div className={styles.overdue}>
                <SectionHeader title="지난 할 일" meta={overdueTodos.length} />

                <ul className={styles.todos}>
                  {overdueTodos.map((t) => (
                    <li key={t.id} className={styles.todo}>
                      <Checkbox
                        checked={t.done}
                        label={t.title}
                        /* 밀린 것은 되풀이하지 않는 것뿐이라 그 날이 곧 자기 날짜입니다. */
                        onChange={() => dispatch({ type: 'TOGGLE_TODO', id: t.id, date: t.date })}
                      />
                      <InlineEdit
                        value={t.title}
                        label={t.title}
                        className={styles.todoTitle}
                        onCommit={(title) =>
                          dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title } })
                        }
                      />
                      <span className={styles.overdueDate}>{formatDateShort(t.date)}</span>
                      <button
                        type="button"
                        className={styles.pull}
                        aria-label={`${t.title} 오늘로 가져오기`}
                        onClick={() =>
                          dispatch({ type: 'MOVE_TODOS', ids: [t.id], date: today })
                        }
                      >
                        오늘로
                      </button>
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

                {overdueTodos.length > 1 && (
                  <button
                    type="button"
                    className={styles.pullAll}
                    onClick={() =>
                      dispatch({
                        type: 'MOVE_TODOS',
                        ids: overdueTodos.map((t) => t.id),
                        date: today,
                      })
                    }
                  >
                    {overdueTodos.length}개 전부 오늘로
                  </button>
                )}
              </div>
            )}

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
                      onChange={() =>
                        dispatch({ type: 'TOGGLE_TODO', id: t.sourceId, date: t.date })
                      }
                    />
                    <InlineEdit
                      value={t.title}
                      label={t.title}
                      className={styles.todoTitle}
                      dataDone={t.done}
                      onCommit={(title) =>
                        dispatch({ type: 'UPDATE_TODO', id: t.sourceId, patch: { title } })
                      }
                    />
                    <TodoMeta todo={t} />
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={
                        t.repeat ? `${t.title} 되풀이 전체 삭제` : `${t.title} 할 일 삭제`
                      }
                      onClick={() => dispatch({ type: 'DELETE_TODO', id: t.sourceId })}
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
