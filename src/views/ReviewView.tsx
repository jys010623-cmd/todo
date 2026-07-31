import { useMemo, useState } from 'react'

import { ProgressBar } from '@/components/common/ProgressBar'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Segmented } from '@/components/common/Segmented'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  addDays,
  formatDateShort,
  formatMinutes,
  formatMonthTitle,
  monthDays,
  todayISO,
  weekDays,
} from '@/lib/date'
import { streaks, tallyGoalSteps, tallyTagMinutes, tallyTodos } from '@/lib/review'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './ReviewView.module.css'

type Span = 'week' | 'month'

/** 태그 이름 — 색 이름을 그대로 부르는 것이 무엇에 썼는지보다 정직합니다. */
const TAG_WORD = {
  mint: '민트',
  blue: '블루',
  lilac: '라일락',
  coral: '코랄',
  honey: '허니',
} as const

/**
 * 돌아보기.
 *
 * 쌓인 것을 보여 주는 자리가 없으면 적는 동기가 오래가지 않습니다. 만다라트에
 * '주간 회고 · 월간 결산' 을 적어 두고도 정작 그걸 볼 화면이 없었습니다.
 *
 * 잘한 것을 세는 화면이지 못한 것을 나무라는 화면이 아닙니다 — 못 한 개수를 크게
 * 띄우지 않고, 지난 기간과의 차이도 나빠졌을 때 굳이 붉게 칠하지 않습니다.
 */
export function ReviewView() {
  const { data } = usePlanner()
  const { settings } = data
  const [span, setSpan] = useState<Span>('week')

  const today = todayISO()

  /** 이번 구간과 그 앞 구간 — 늘어났는지 줄었는지는 견줄 것이 있어야 말할 수 있습니다. */
  const { now, before, label } = useMemo(() => {
    if (span === 'week') {
      const days = weekDays(today, settings.weekStart)
      return {
        now: days,
        before: weekDays(addDays(days[0], -7), settings.weekStart),
        label: `${formatDateShort(days[0])} – ${formatDateShort(days[6])}`,
      }
    }
    const days = monthDays(today)
    return {
      now: days,
      before: monthDays(addDays(days[0], -1)),
      label: formatMonthTitle(today),
    }
  }, [span, today, settings.weekStart])

  const todos = tallyTodos(data.todos, now)
  const todosBefore = tallyTodos(data.todos, before)
  const tags = tallyTagMinutes(data.events, now)
  const goals = tallyGoalSteps(data.goals)
  const rows = streaks(data.todos, today)

  const studyMinutes = data.studyLogs.reduce(
    (sum, l) => (now.includes(l.date) ? sum + l.minutes : sum),
    0,
  )
  const totalMinutes = tags.reduce((sum, t) => sum + t.minutes, 0)
  const doneDiff = todos.done - todosBefore.done

  const empty = todos.total === 0 && tags.length === 0 && goals.total === 0 && rows.length === 0

  return (
    <div className={styles.scroll}>
      <PageHeader title="돌아보기" subtitle={label} printable>
        <Segmented
          label="돌아볼 구간"
          value={span}
          options={[
            { value: 'week', label: '이번 주' },
            { value: 'month', label: '이번 달' },
          ]}
          onChange={setSpan}
        />
      </PageHeader>

      <div className={styles.body}>
        {empty ? (
          <p className={styles.blank}>
            아직 돌아볼 것이 없습니다. 며칠 적어 두면 여기에 쌓입니다.
          </p>
        ) : (
          <>
            <section className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>끝낸 할 일</span>
                <p className={styles.statValue}>
                  {todos.done}
                  <span className={styles.of}> / {todos.total}</span>
                </p>
                {todos.total > 0 && <ProgressBar value={todos.done / todos.total} />}
                {/* 지난 구간과의 차이 — 줄었다고 붉게 칠하지 않습니다. */}
                <span className={styles.statSub}>
                  {doneDiff === 0
                    ? span === 'week'
                      ? '지난주와 같습니다'
                      : '지난달과 같습니다'
                    : `${span === 'week' ? '지난주' : '지난달'}보다 ${doneDiff > 0 ? '+' : ''}${doneDiff}`}
                </span>
              </div>

              <div className={styles.stat}>
                <span className={styles.statLabel}>일정에 쓴 시간</span>
                <p className={styles.statValue}>{formatMinutes(totalMinutes)}</p>
                <span className={styles.statSub}>시각을 정해 둔 것만</span>
              </div>

              <div className={styles.stat}>
                <span className={styles.statLabel}>공부</span>
                <p className={styles.statValue}>{formatMinutes(studyMinutes)}</p>
                <span className={styles.statSub}>기록해 둔 시간</span>
              </div>
            </section>

            {tags.length > 0 && (
              <section className={styles.section}>
                <SectionHeader title="무엇에 썼나" meta={formatMinutes(totalMinutes)} />
                <ul className={styles.bars}>
                  {tags.map((t) => (
                    <li key={t.tag} className={styles.bar}>
                      <span className={styles.barDot} style={{ background: tagVar(t.tag) }} />
                      <span className={styles.barName}>{TAG_WORD[t.tag]}</span>
                      <span className={styles.barTrack}>
                        <span
                          className={styles.barFill}
                          style={{
                            width: `${(t.minutes / tags[0].minutes) * 100}%`,
                            background: tagVar(t.tag),
                          }}
                        />
                      </span>
                      <span className={styles.barValue}>{formatMinutes(t.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {rows.length > 0 && (
              <section className={styles.section}>
                <SectionHeader title="이어 오는 것" meta={rows.length} />
                <ul className={styles.streaks}>
                  {rows.map(({ todo, days }) => (
                    <li key={todo.id} className={styles.streak}>
                      {todo.tag && (
                        <span className={styles.barDot} style={{ background: tagVar(todo.tag) }} />
                      )}
                      <span className={styles.streakName}>{todo.title}</span>
                      <span className={styles.streakDays}>{days}일째</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {goals.total > 0 && (
              <section className={styles.section}>
                <SectionHeader title="목표" meta={`${goals.done}/${goals.total}`} />
                <ProgressBar value={goals.done / goals.total} />
                <p className={styles.note}>진행 중인 목표의 단계 기준</p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
