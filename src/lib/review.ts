import { addDays, timeToMinutes } from '@/lib/date'
import { expandEvents, expandTodos, occursOn } from '@/lib/repeat'
import type { Goal, ISODate, PlanEvent, TagColor, Todo } from '@/types'

/**
 * 돌아보기의 셈.
 *
 * 쌓인 것을 보여 주는 화면이 없으면 적는 동기가 오래가지 않습니다. 만다라트에
 * '주간 회고 · 월간 결산' 을 적어 두고도 정작 그걸 볼 자리가 없었습니다.
 *
 * 계산은 전부 여기 둡니다 — 화면에서 세면 주간과 월간이 서로 다르게 세기 시작합니다.
 */

/** 끝이 없는 일정을 이만큼으로 봅니다 — 주간 격자에서 그리는 기본 길이와 같습니다. */
const DEFAULT_MIN = 60

export interface Tally {
  done: number
  total: number
}

/**
 * 그 날들의 할 일 — 되풀이하는 것은 날마다 하나씩으로 셉니다.
 *
 * 펼치는 쪽은 되풀이하지 않는 것을 범위와 상관없이 다 내보냅니다(어느 날 것이든
 * 제자리에 놓아야 하니까). 셈에는 그 날들의 것만 들어가야 해서 한 번 거릅니다.
 */
export function tallyTodos(todos: Todo[], dates: ISODate[]): Tally {
  const want = new Set(dates)
  const out = expandTodos(todos, dates).filter((t) => want.has(t.date))
  return { done: out.filter((t) => t.done).length, total: out.length }
}

export interface TagMinutes {
  tag: TagColor
  minutes: number
}

/**
 * 무엇에 시간을 썼는지 — 태그별로 모읍니다.
 *
 * 시각이 있는 일정만 셉니다. 종일은 길이가 없어, 하루로 세면 그것만으로 한 주가
 * 가득 차 나머지가 안 보입니다.
 */
export function tallyTagMinutes(events: PlanEvent[], dates: ISODate[]): TagMinutes[] {
  const sum = new Map<TagColor, number>()

  for (const e of expandEvents(events, dates)) {
    // 펼쳐진 것이 보이는 날짜 밖일 수 있습니다(원본은 늘 딸려 옵니다).
    if (!dates.includes(e.date) || !e.start) continue
    const start = timeToMinutes(e.start)
    const end = e.end ? timeToMinutes(e.end) : start + DEFAULT_MIN
    const length = end > start ? end - start : DEFAULT_MIN
    sum.set(e.tag, (sum.get(e.tag) ?? 0) + length)
  }

  return [...sum.entries()]
    .map(([tag, minutes]) => ({ tag, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** 진행 중인 목표의 단계 진척 */
export function tallyGoalSteps(goals: Goal[]): Tally {
  const steps = goals.filter((g) => g.status === 'active').flatMap((g) => g.steps)
  return { done: steps.filter((s) => s.done).length, total: steps.length }
}

/**
 * 며칠째 이어 오고 있는지.
 *
 * 오늘 것은 아직 안 했을 수 있으니 끊긴 것으로 보지 않습니다 — 저녁에 할 일을
 * 아침에 열었다고 기록이 0 이 되면, 그 숫자를 믿을 수 없게 됩니다.
 * 그 앞에서 하루라도 빠지면 거기서 끊깁니다.
 */
export function streakOf(todo: Todo, today: ISODate, limit = 400): number {
  if (!todo.repeat) return 0

  const done = new Set(todo.doneOn ?? [])
  let count = 0
  let cursor = today
  let firstSeen = true

  for (let i = 0; i < limit; i++) {
    if (cursor < todo.date) break
    if (occursOn(todo, cursor)) {
      if (done.has(cursor)) count++
      else if (!firstSeen) break
      firstSeen = false
    }
    cursor = addDays(cursor, -1)
  }
  return count
}

export interface Streak {
  todo: Todo
  days: number
}

/** 이어 오는 것들 — 긴 것부터. 하루도 못 이은 것은 굳이 보여 주지 않습니다. */
export function streaks(todos: Todo[], today: ISODate): Streak[] {
  return todos
    .filter((t) => t.repeat)
    .map((todo) => ({ todo, days: streakOf(todo, today) }))
    .filter((s) => s.days > 0)
    .sort((a, b) => b.days - a.days)
}
