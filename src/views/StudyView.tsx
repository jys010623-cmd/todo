import { useEffect, useMemo, useState } from 'react'

import { Donut } from '@/components/common/Donut'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { ProgressBar } from '@/components/common/ProgressBar'
import { SectionHeader } from '@/components/common/SectionHeader'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatMinutes, formatWeekRange, todayISO, weekDays } from '@/lib/date'
import { nextTag } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './StudyView.module.css'

/** 타이머를 켜지 않고 손으로 쌓을 때의 단위 */
const STEPS = [10, 30, 60]

const DEFAULT_GOAL_MIN = 300
const GOAL_STEP = 30

/** 흘러간 시간을 '1:23:45' / '23:45' 로 */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function StudyView() {
  const { data, dispatch } = usePlanner()
  const { subjects, studyLogs, settings, timer } = data

  const today = todayISO()

  /*
   * 1초마다 다시 그립니다. 흘러간 시간은 세어 두지 않고 매번 시작 시각과의 차이로
   * 구합니다 — 탭이 잠들어 있던 동안도 그대로 흘러간 것으로 보여야 하니까요.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer) return
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [timer])

  const elapsedMs = timer ? Math.max(0, now - timer.startedAt) : 0
  /** 기록은 분 단위라 반올림합니다. 30초 미만은 0분이 되어 쌓이지 않습니다. */
  const elapsedMin = Math.round(elapsedMs / 60_000)

  const startTimer = (subjectId: string) => {
    // 이미 돌고 있던 것은 먼저 기록하고 넘어갑니다 — 재던 시간이 그냥 사라지면 안 됩니다.
    if (timer) dispatch({ type: 'STOP_TIMER', date: today, minutes: elapsedMin })
    dispatch({ type: 'START_TIMER', subjectId, startedAt: Date.now() })
  }
  const week = useMemo(() => weekDays(today, settings.weekStart), [today, settings.weekStart])

  /** 과목별로 이번 주 누적과 오늘 기록을 한 번에 집계합니다. */
  const stats = useMemo(() => {
    const inWeek = new Set(week)
    const map = new Map<string, { week: number; today: number }>()
    for (const s of subjects) map.set(s.id, { week: 0, today: 0 })

    for (const log of studyLogs) {
      const entry = map.get(log.subjectId)
      if (!entry) continue
      if (inWeek.has(log.date)) entry.week += log.minutes
      if (log.date === today) entry.today += log.minutes
    }
    return map
  }, [subjects, studyLogs, week, today])

  const weekTotal = subjects.reduce((sum, s) => sum + (stats.get(s.id)?.week ?? 0), 0)
  const todayTotal = subjects.reduce((sum, s) => sum + (stats.get(s.id)?.today ?? 0), 0)
  const weekGoal = subjects.reduce((sum, s) => sum + s.weeklyGoalMin, 0)
  const dailyGoal = weekGoal > 0 ? Math.round(weekGoal / 7) : 0

  return (
    <div className={styles.scroll}>
      <PageHeader title="스터디" subtitle={formatWeekRange(today, settings.weekStart)} />

      <div className={styles.body}>
        <section className={styles.summary}>
          <Donut
            value={dailyGoal === 0 ? 0 : todayTotal / dailyGoal}
            label={`오늘 목표 대비 ${dailyGoal === 0 ? 0 : Math.round((todayTotal / dailyGoal) * 100)}% 달성`}
          />

          <div className={styles.summaryStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>오늘 공부 시간</span>
              <span className={styles.statValue}>{formatMinutes(todayTotal)}</span>
              <span className={styles.statGoal}>
                {dailyGoal > 0 ? `일일 목표 ${formatMinutes(dailyGoal)}` : '목표 없음'}
              </span>
            </div>

            <div className={styles.weekTotal}>
              <div className={styles.weekTotalHead}>
                <span className={styles.statLabel}>이번 주 누적</span>
                <span className={styles.weekTotalValue}>
                  {formatMinutes(weekTotal)}
                  {weekGoal > 0 && <span className={styles.weekTotalGoal}> / {formatMinutes(weekGoal)}</span>}
                </span>
              </div>
              <ProgressBar value={weekGoal === 0 ? 0 : weekTotal / weekGoal} />
            </div>
          </div>
        </section>

        <section className={styles.subjects}>
          <SectionHeader title="과목" meta={subjects.length > 0 ? subjects.length : undefined} />

          {subjects.length > 0 ? (
            <ul className={styles.list}>
              {subjects.map((s) => {
                const stat = stats.get(s.id) ?? { week: 0, today: 0 }
                const running = timer?.subjectId === s.id
                return (
                  <li key={s.id} className={styles.subject} data-running={running || undefined}>
                    <div className={styles.subjectHead}>
                      <span className={styles.dot} style={{ background: tagVar(s.tag) }} />
                      <InlineEdit
                        value={s.name}
                        label={s.name}
                        className={styles.name}
                        onCommit={(name) =>
                          dispatch({ type: 'UPDATE_SUBJECT', id: s.id, patch: { name } })
                        }
                      />

                      <span className={styles.amount}>
                        {formatMinutes(stat.week)}
                        <span className={styles.amountGoal}>
                          {' '}
                          / {formatMinutes(s.weeklyGoalMin)}
                        </span>
                      </span>

                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${s.name} 과목 삭제`}
                        onClick={() => dispatch({ type: 'DELETE_SUBJECT', id: s.id })}
                      >
                        ×
                      </button>
                    </div>

                    <ProgressBar
                      value={s.weeklyGoalMin === 0 ? 0 : stat.week / s.weeklyGoalMin}
                      tag={s.tag}
                    />

                    <div className={styles.controls}>
                      <div className={styles.steps}>
                        {running ? (
                          <>
                            <span className={styles.clock} role="timer" aria-live="off">
                              {clock(elapsedMs)}
                            </span>
                            <button
                              type="button"
                              className={styles.stop}
                              onClick={() =>
                                dispatch({ type: 'STOP_TIMER', date: today, minutes: elapsedMin })
                              }
                            >
                              정지
                              {elapsedMin > 0 && (
                                <span className={styles.stopHint}> · {elapsedMin}분 기록</span>
                              )}
                            </button>
                            <button
                              type="button"
                              className={styles.step}
                              onClick={() => dispatch({ type: 'CANCEL_TIMER' })}
                            >
                              버리기
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.start}
                            aria-label={`${s.name} 타이머 시작`}
                            onClick={() => startTimer(s.id)}
                          >
                            ▶ 시작
                          </button>
                        )}

                        {STEPS.map((min) => (
                          <button
                            key={min}
                            type="button"
                            className={styles.step}
                            onClick={() =>
                              dispatch({
                                type: 'LOG_STUDY',
                                date: today,
                                subjectId: s.id,
                                minutes: min,
                              })
                            }
                          >
                            +{min}분
                          </button>
                        ))}
                        {stat.today > 0 && (
                          <>
                            <button
                              type="button"
                              className={styles.step}
                              onClick={() =>
                                dispatch({
                                  type: 'LOG_STUDY',
                                  date: today,
                                  subjectId: s.id,
                                  minutes: -10,
                                })
                              }
                            >
                              −10분
                            </button>
                            <span className={styles.todayMark}>
                              오늘 {formatMinutes(stat.today)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className={styles.goal}>
                        <span className={styles.goalLabel}>주간 목표</span>
                        <button
                          type="button"
                          className={styles.goalBtn}
                          aria-label={`${s.name} 주간 목표 ${GOAL_STEP}분 줄이기`}
                          onClick={() =>
                            dispatch({
                              type: 'UPDATE_SUBJECT',
                              id: s.id,
                              patch: {
                                weeklyGoalMin: Math.max(0, s.weeklyGoalMin - GOAL_STEP),
                              },
                            })
                          }
                        >
                          −
                        </button>
                        <span className={styles.goalValue}>{formatMinutes(s.weeklyGoalMin)}</span>
                        <button
                          type="button"
                          className={styles.goalBtn}
                          aria-label={`${s.name} 주간 목표 ${GOAL_STEP}분 늘리기`}
                          onClick={() =>
                            dispatch({
                              type: 'UPDATE_SUBJECT',
                              id: s.id,
                              patch: { weeklyGoalMin: s.weeklyGoalMin + GOAL_STEP },
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={styles.empty}>아직 과목이 없습니다.</p>
          )}

          <InlineAdd
            label="과목 추가"
            placeholder="과목 이름"
            onSubmit={(name) =>
              dispatch({
                type: 'ADD_SUBJECT',
                name,
                tag: nextTag(subjects.length),
                weeklyGoalMin: DEFAULT_GOAL_MIN,
              })
            }
          />
        </section>
      </div>
    </div>
  )
}
