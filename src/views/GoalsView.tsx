import { useMemo, useState } from 'react'

import { Checkbox } from '@/components/common/Checkbox'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { ProgressBar } from '@/components/common/ProgressBar'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Segmented } from '@/components/common/Segmented'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDateShort, parseISO, todayISO } from '@/lib/date'
import { nextTag } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import { WISH_LABEL, type GoalStatus, type WishKind } from '@/types'
import styles from './GoalsView.module.css'

const FILTERS: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: '진행 중' },
  { value: 'someday', label: '언젠가' },
  { value: 'done', label: '이룬 것' },
]

const WISH_KINDS: WishKind[] = ['learn', 'cert']

/** 남은 날짜를 사람이 읽는 말로. 지난 것은 굳이 며칠 지났는지 세지 않습니다. */
function dueLabel(due: string, today: string): { text: string; overdue: boolean } {
  if (due < today) return { text: `${formatDateShort(due)} 지남`, overdue: true }
  if (due === today) return { text: '오늘까지', overdue: false }
  // new Date('YYYY-MM-DD') 는 UTC 로 읽혀서, 이 프로젝트에서는 parseISO 만 씁니다.
  const days = Math.round((parseISO(due).getTime() - parseISO(today).getTime()) / 86_400_000)
  if (days <= 30) return { text: `${days}일 남음`, overdue: false }
  return { text: formatDateShort(due), overdue: false }
}

export function GoalsView() {
  const { data, dispatch } = usePlanner()
  const { goals, wishes, subjects } = data

  const [filter, setFilter] = useState<GoalStatus>('active')
  const today = todayISO()

  const visible = useMemo(
    () => goals.filter((g) => g.status === filter).sort((a, b) => a.order - b.order),
    [goals, filter],
  )

  const counts = useMemo(
    () => ({
      active: goals.filter((g) => g.status === 'active').length,
      someday: goals.filter((g) => g.status === 'someday').length,
      done: goals.filter((g) => g.status === 'done').length,
    }),
    [goals],
  )

  return (
    <div className={styles.scroll}>
      <PageHeader
        title="목표"
        subtitle={
          goals.length > 0
            ? `진행 중 ${counts.active} · 언젠가 ${counts.someday} · 이룬 것 ${counts.done}`
            : '오늘 밖의 일들을 적어 둡니다'
        }
      >
        <Segmented label="목표 상태" value={filter} options={FILTERS} onChange={setFilter} />
      </PageHeader>

      <div className={styles.body}>
        <section className={styles.goals}>
          {visible.length > 0 ? (
            <ul className={styles.goalList}>
              {visible.map((g) => {
                const doneSteps = g.steps.filter((s) => s.done).length
                const due = g.due ? dueLabel(g.due, today) : null

                return (
                  <li key={g.id} className={styles.goal}>
                    <div className={styles.goalHead}>
                      <Checkbox
                        checked={g.status === 'done'}
                        label={g.title}
                        onChange={() =>
                          dispatch({
                            type: 'UPDATE_GOAL',
                            id: g.id,
                            patch: { status: g.status === 'done' ? 'active' : 'done' },
                          })
                        }
                      />
                      <span className={styles.dot} style={{ background: tagVar(g.tag) }} />
                      <InlineEdit
                        value={g.title}
                        label={g.title}
                        className={styles.goalTitle}
                        dataDone={g.status === 'done'}
                        onCommit={(title) =>
                          dispatch({ type: 'UPDATE_GOAL', id: g.id, patch: { title } })
                        }
                      />
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${g.title} 목표 삭제`}
                        onClick={() => dispatch({ type: 'DELETE_GOAL', id: g.id })}
                      >
                        ×
                      </button>
                    </div>

                    {g.steps.length > 0 && (
                      <>
                        <ProgressBar value={doneSteps / g.steps.length} tag={g.tag} />
                        <ul className={styles.steps}>
                          {g.steps.map((s) => (
                            <li key={s.id} className={styles.step}>
                              <Checkbox
                                checked={s.done}
                                label={s.title}
                                onChange={() =>
                                  dispatch({
                                    type: 'TOGGLE_GOAL_STEP',
                                    goalId: g.id,
                                    stepId: s.id,
                                  })
                                }
                              />
                              <InlineEdit
                                value={s.title}
                                label={s.title}
                                className={styles.stepTitle}
                                dataDone={s.done}
                                onCommit={(title) =>
                                  dispatch({
                                    type: 'UPDATE_GOAL_STEP',
                                    goalId: g.id,
                                    stepId: s.id,
                                    title,
                                  })
                                }
                              />
                              <button
                                type="button"
                                className={styles.remove}
                                aria-label={`${s.title} 단계 삭제`}
                                onClick={() =>
                                  dispatch({
                                    type: 'DELETE_GOAL_STEP',
                                    goalId: g.id,
                                    stepId: s.id,
                                  })
                                }
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <div className={styles.goalFoot}>
                      <InlineAdd
                        label="단계 추가"
                        placeholder="무엇부터 할까요?"
                        onSubmit={(title) =>
                          dispatch({ type: 'ADD_GOAL_STEP', goalId: g.id, title })
                        }
                      />

                      <div className={styles.goalMeta}>
                        {g.steps.length > 0 && (
                          <span className={styles.stepCount}>
                            {doneSteps}/{g.steps.length}
                          </span>
                        )}

                        <label className={styles.dueField}>
                          <span className="sr-only">{g.title} 목표일</span>
                          <input
                            type="date"
                            className={styles.dueInput}
                            value={g.due ?? ''}
                            onChange={(e) =>
                              dispatch({
                                type: 'UPDATE_GOAL',
                                id: g.id,
                                patch: { due: e.target.value || undefined },
                              })
                            }
                          />
                          {due && (
                            <span className={styles.dueText} data-overdue={due.overdue || undefined}>
                              {due.text}
                            </span>
                          )}
                        </label>

                        <button
                          type="button"
                          className={styles.statusBtn}
                          onClick={() =>
                            dispatch({
                              type: 'UPDATE_GOAL',
                              id: g.id,
                              patch: { status: g.status === 'someday' ? 'active' : 'someday' },
                            })
                          }
                        >
                          {g.status === 'someday' ? '진행 중으로' : '언젠가로'}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={styles.empty}>
              {filter === 'done' ? '아직 이룬 목표가 없습니다.' : '적어 둔 목표가 없습니다.'}
            </p>
          )}

          <InlineAdd
            label="목표 추가"
            placeholder="이루고 싶은 것"
            onSubmit={(title) =>
              dispatch({ type: 'ADD_GOAL', title, tag: nextTag(goals.length) })
            }
          />
        </section>

        <aside className={styles.wishes}>
          {WISH_KINDS.map((kind) => {
            const items = wishes
              .filter((w) => w.kind === kind)
              .sort((a, b) => a.order - b.order)
            const done = items.filter((w) => w.done).length

            return (
              <section key={kind} className={styles.wishBlock}>
                <SectionHeader
                  title={WISH_LABEL[kind]}
                  meta={items.length > 0 ? `${done}/${items.length}` : undefined}
                />

                {items.length > 0 && (
                  <ul className={styles.wishList}>
                    {items.map((w) => {
                      const subject = w.subjectId
                        ? subjects.find((s) => s.id === w.subjectId)
                        : undefined

                      return (
                        <li key={w.id} className={styles.wish}>
                          <Checkbox
                            checked={w.done}
                            label={w.title}
                            onChange={() => dispatch({ type: 'TOGGLE_WISH', id: w.id })}
                          />
                          <div className={styles.wishBody}>
                            <InlineEdit
                              value={w.title}
                              label={w.title}
                              className={styles.wishTitle}
                              dataDone={w.done}
                              onCommit={(title) =>
                                dispatch({ type: 'UPDATE_WISH', id: w.id, patch: { title } })
                              }
                            />
                            {subjects.length > 0 && (
                              <select
                                className={styles.subjectSelect}
                                aria-label={`${w.title} 연결 과목`}
                                value={w.subjectId ?? ''}
                                onChange={(e) =>
                                  dispatch({
                                    type: 'UPDATE_WISH',
                                    id: w.id,
                                    patch: { subjectId: e.target.value || undefined },
                                  })
                                }
                              >
                                <option value="">과목 연결 안 함</option>
                                {subjects.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {subject && (
                            <span
                              className={styles.subjectDot}
                              style={{ background: tagVar(subject.tag) }}
                              aria-hidden="true"
                            />
                          )}
                          <button
                            type="button"
                            className={styles.remove}
                            aria-label={`${w.title} 삭제`}
                            onClick={() => dispatch({ type: 'DELETE_WISH', id: w.id })}
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <InlineAdd
                  label="추가"
                  placeholder={kind === 'cert' ? '자격증 이름' : '배우고 싶은 것'}
                  onSubmit={(title) => dispatch({ type: 'ADD_WISH', title, kind })}
                />
              </section>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
