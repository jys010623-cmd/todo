import { useMemo } from 'react'

import { ProgressBar } from '@/components/common/ProgressBar'
import { PageHeader } from '@/components/layout/PageHeader'
import { daysSince, formatDateLong, formatMinutes, formatTime, todayISO, weekDays } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import type { ViewId } from '@/types'
import styles from './HomeView.module.css'

/** 이만큼 지나면 한 번 챙기라고 말합니다 — 한 달에 한 번이면 잔소리가 되지 않습니다. */
const BACKUP_STALE_DAYS = 30

/** 이보다 적게 적혀 있으면 잃을 것도 적습니다 — 시작하자마자 백업하라고 하지 않습니다. */
const BACKUP_MIN_ITEMS = 10

/**
 * 홈은 '오늘' 을 다시 보여주는 자리가 아닙니다.
 * 흩어져 있는 여섯 화면이 지금 어떤 상태인지 한 줄씩 모아 두고, 눌러서 그리로 갑니다.
 */
export function HomeView() {
  const {
    data,
    dispatch,
    setView,
    eventsByDate,
    todosByDate,
    overdueTodos,
  } = usePlanner()

  const today = todayISO()
  const { settings, subjects, studyLogs, goals, mandals, mindmaps, timer } = data

  const events = eventsByDate.get(today) ?? []
  const todos = todosByDate.get(today) ?? []
  const doneTodos = todos.filter((t) => t.done).length

  /** 아직 오지 않은 오늘 일정 중 가장 가까운 것 */
  const nextEvent = useMemo(() => {
    const nowHM = new Date().toTimeString().slice(0, 5)
    return events.find((e) => e.start && e.start >= nowHM)
  }, [events])

  const study = useMemo(() => {
    const week = new Set(weekDays(today, settings.weekStart))
    const minutes = studyLogs.reduce((sum, l) => (week.has(l.date) ? sum + l.minutes : sum), 0)
    const goal = subjects.reduce((sum, s) => sum + s.weeklyGoalMin, 0)
    return { minutes, goal }
  }, [studyLogs, subjects, today, settings.weekStart])

  const goalStats = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active')
    const steps = active.flatMap((g) => g.steps)
    return { active: active.length, done: steps.filter((s) => s.done).length, total: steps.length }
  }, [goals])

  /** 만다라트는 적어 둔 실행 항목만 셉니다 — 안 적은 칸은 못 한 것이 아닙니다. */
  const mandalStats = useMemo(() => {
    const filled = mandals.flatMap((m) => m.actions.flat()).filter((a) => a.text.trim())
    return { done: filled.filter((a) => a.done).length, total: filled.length }
  }, [mandals])

  const mindNodes = mindmaps.reduce((sum, m) => sum + m.nodes.length, 0)
  const runningSubject = timer ? subjects.find((s) => s.id === timer.subjectId) : undefined

  /**
   * 백업이 오래됐는지.
   *
   * 설정 안에만 적어 두면 아무도 안 봅니다 — 설정은 무언가 고치려 할 때나 여는 자리라,
   * 정작 '잃을 것이 쌓였다' 는 신호는 여기서 나야 합니다. 적어 둔 것이 없으면
   * 잃을 것도 없으니 조용히 있습니다.
   */
  const backup = useMemo(() => {
    const worth = data.events.length + data.todos.length + goals.length + mandals.length
    if (worth < BACKUP_MIN_ITEMS) return null
    if (settings.exportedAt === undefined) return { days: null }
    const days = daysSince(settings.exportedAt, Date.now())
    return days >= BACKUP_STALE_DAYS ? { days } : null
  }, [data.events.length, data.todos.length, goals.length, mandals.length, settings.exportedAt])

  const isEmpty =
    events.length === 0 &&
    todos.length === 0 &&
    overdueTodos.length === 0 &&
    goals.length === 0 &&
    subjects.length === 0 &&
    mandals.length === 0 &&
    mindmaps.length === 0

  return (
    <div className={styles.scroll}>
      <PageHeader title="홈" subtitle={formatDateLong(today)} />

      <div className={styles.body}>
        {isEmpty ? (
          <div className={styles.blank}>
            <p className={styles.blankTitle}>빈 지면에서 시작합니다.</p>
            <p className={styles.blankBody}>
              오늘 할 일을 하나 적어 두는 것으로 충분합니다. 계획은 그다음에 붙습니다.
            </p>
            <button type="button" className={styles.blankGo} onClick={() => setView('today')}>
              오늘 펼치기 →
            </button>
          </div>
        ) : (
          <div className={styles.cards}>
            {/* 밀린 것이 있으면 가장 먼저 보여야 합니다 — 이게 안 보이면 계속 밀립니다. */}
            {overdueTodos.length > 0 && (
              <Card view="today" onGo={setView} accent title="지난 할 일">
                <p className={styles.big}>{overdueTodos.length}개</p>
                <p className={styles.sub}>못 끝내고 넘어온 것들</p>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() =>
                    dispatch({
                      type: 'MOVE_TODOS',
                      ids: overdueTodos.map((t) => t.id),
                      date: today,
                    })
                  }
                >
                  전부 오늘로
                </button>
              </Card>
            )}

            {backup && (
              <Card view="settings" onGo={setView} title="백업">
                <p className={styles.big}>
                  {backup.days === null ? '없음' : `${backup.days}일`}
                </p>
                <p className={styles.sub}>
                  {backup.days === null
                    ? '한 번도 내려받지 않았습니다 — 이 브라우저에만 있습니다'
                    : '전에 내려받았습니다 — 이 브라우저에만 있습니다'}
                </p>
              </Card>
            )}

            <Card view="today" onGo={setView} title="오늘 할 일">
              {todos.length > 0 ? (
                <>
                  <p className={styles.big}>
                    {doneTodos}
                    <span className={styles.of}> / {todos.length}</span>
                  </p>
                  <ProgressBar value={doneTodos / todos.length} />
                </>
              ) : (
                <p className={styles.sub}>아직 적은 것이 없습니다</p>
              )}
            </Card>

            <Card view="today" onGo={setView} title="오늘 일정">
              {events.length > 0 ? (
                <>
                  <p className={styles.big}>{events.length}개</p>
                  <p className={styles.sub}>
                    {nextEvent
                      ? `다음 · ${formatTime(nextEvent.start, settings.hour12)} ${nextEvent.title}`
                      : '남은 일정 없음'}
                  </p>
                </>
              ) : (
                <p className={styles.sub}>비어 있는 하루입니다</p>
              )}
            </Card>

            <Card view="study" onGo={setView} title="이번 주 공부">
              <p className={styles.big}>
                {formatMinutes(study.minutes)}
                {study.goal > 0 && <span className={styles.of}> / {formatMinutes(study.goal)}</span>}
              </p>
              {study.goal > 0 && <ProgressBar value={study.minutes / study.goal} />}
              <p className={styles.sub}>
                {runningSubject ? `${runningSubject.name} 재는 중` : '타이머가 멈춰 있습니다'}
              </p>
            </Card>

            <Card view="goals" onGo={setView} title="목표">
              {goalStats.active > 0 ? (
                <>
                  <p className={styles.big}>{goalStats.active}개</p>
                  {goalStats.total > 0 ? (
                    <>
                      <ProgressBar value={goalStats.done / goalStats.total} />
                      <p className={styles.sub}>
                        단계 {goalStats.done}/{goalStats.total} 완료
                      </p>
                    </>
                  ) : (
                    <p className={styles.sub}>아직 단계로 쪼개지 않았습니다</p>
                  )}
                </>
              ) : (
                <p className={styles.sub}>진행 중인 목표가 없습니다</p>
              )}
            </Card>

            <Card view="mandal" onGo={setView} title="만다라트">
              {mandalStats.total > 0 ? (
                <>
                  <p className={styles.big}>
                    {mandalStats.done}
                    <span className={styles.of}> / {mandalStats.total}</span>
                  </p>
                  <ProgressBar value={mandalStats.done / mandalStats.total} />
                  <p className={styles.sub}>적어 둔 실행 항목 기준</p>
                </>
              ) : (
                <p className={styles.sub}>가운데 하나에서 여덟 갈래로</p>
              )}
            </Card>

            <Card view="mindmap" onGo={setView} title="마인드맵">
              {mindNodes > 0 ? (
                <>
                  <p className={styles.big}>{mindNodes}개</p>
                  <p className={styles.sub}>맵 {mindmaps.length}개에 펼친 생각</p>
                </>
              ) : (
                <p className={styles.sub}>생각을 가지처럼 펼칩니다</p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  title: string
  view: ViewId
  onGo: (view: ViewId) => void
  /** 눈에 먼저 들어와야 하는 카드 */
  accent?: boolean
  children: React.ReactNode
}

function Card({ title, view, onGo, accent, children }: CardProps) {
  return (
    <div className={styles.card} data-accent={accent || undefined}>
      {/*
       * 카드 전체가 눌리되 버튼 안에 버튼이 들어가지 않도록, 누르는 자리를 카드 위에
       * 한 겹 펴 둡니다. 카드가 곧 버튼이면 '전부 오늘로' 가 그 안에 들어가는데,
       * 버튼 안의 버튼은 브라우저마다 다르게 다루고 스크린리더는 안쪽에 닿지 못합니다.
       */}
      <button
        type="button"
        className={styles.cardGo}
        aria-label={`${title} 화면으로`}
        onClick={() => onGo(view)}
      />
      <span className={styles.cardTitle}>{title}</span>
      <div className={styles.cardBody}>{children}</div>
    </div>
  )
}
