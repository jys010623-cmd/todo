import { dayOfWeek, parseISO, startOfWeek, toISO } from '@/lib/date'
import type {
  EventOccurrence,
  ISODate,
  PlanEvent,
  Repeat,
  RepeatFreq,
  Todo,
  TodoOccurrence,
} from '@/types'

/** 규칙을 들고 시작 날짜가 있는 것 — 일정과 할 일이 같은 규칙을 씁니다. */
type Repeating = { date: ISODate; repeat?: Repeat }

/**
 * 반복 일정.
 *
 * 규칙만 저장하고 화면에 그릴 때 펼칩니다. 규칙은 일정 줄의 '반복' 선택으로 정합니다.
 */

export const REPEAT_WORD: Record<RepeatFreq, string> = {
  daily: '매일',
  weekly: '매주',
  monthly: '매달',
}

/** 간격이 있을 때 부르는 말 — '2주마다' 처럼 */
const EVERY_UNIT: Record<RepeatFreq, string> = {
  daily: '일',
  weekly: '주',
  monthly: '달',
}

/** 일 · 월 · 화 … — 요일을 고르는 자리와 이름표에서 함께 씁니다. */
export const WEEKDAY_WORD = ['일', '월', '화', '수', '목', '금', '토']

export function repeatLabel(repeat: Repeat | undefined): string | undefined {
  if (!repeat) return undefined

  const every = repeat.every && repeat.every > 1 ? repeat.every : 1
  const head = every > 1 ? `${every}${EVERY_UNIT[repeat.freq]}마다` : REPEAT_WORD[repeat.freq]

  // 요일을 여러 개 고른 것은 그것이 곧 규칙입니다 — '매주' 만으로는 무슨 요일인지 모릅니다.
  if (repeat.freq === 'weekly' && repeat.days && repeat.days.length > 1) {
    return `${head} ${[...repeat.days].sort().map((d) => WEEKDAY_WORD[d]).join('·')}`
  }
  return head
}

/** 두 날짜 사이의 날 수 — 자정끼리 재므로 서머타임에도 정수로 떨어집니다. */
function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISO(from)
  const b = parseISO(to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** 두 날짜 사이의 달 수 */
function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parseISO(from)
  const b = parseISO(to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/**
 * 그 날에 이 반복이 오는가.
 *
 * 매달은 '같은 날짜' 입니다. 31일에 시작한 것은 30일까지인 달을 건너뜁니다 —
 * 없는 날짜를 말일로 당기면 사람이 적어 둔 것과 달라집니다.
 */
export function occursOn(event: Repeating, date: ISODate): boolean {
  const repeat = event.repeat
  if (!repeat) return event.date === date
  // 시작 전에는 오지 않습니다.
  if (date < event.date) return false
  // 끝난 뒤에도 오지 않습니다.
  if (repeat.until && date > repeat.until) return false
  if (repeat.skip?.includes(date)) return false

  const every = repeat.every && repeat.every > 1 ? Math.floor(repeat.every) : 1

  switch (repeat.freq) {
    case 'daily':
      return daysBetween(event.date, date) % every === 0

    case 'weekly': {
      /*
       * 고른 요일이 없으면 시작한 날의 요일 하나입니다.
       * 간격은 '주' 로 셉니다 — 같은 주 안의 월·수·금은 한 묶음이어야, 격주 월수금이
       * 한 주는 월수금 다음 주는 쉬고가 됩니다.
       */
      const days = repeat.days?.length ? repeat.days : [dayOfWeek(event.date)]
      if (!days.includes(dayOfWeek(date))) return false
      if (every === 1) return true

      // 주의 첫날 기준이 주마다 같아야 하므로 시작 요일은 아무거나 하나로 고정합니다.
      const weeks = daysBetween(startOfWeek(event.date, 1), startOfWeek(date, 1)) / 7
      return weeks % every === 0
    }

    case 'monthly': {
      if (parseISO(date).getDate() !== parseISO(event.date).getDate()) return false
      return monthsBetween(event.date, date) % every === 0
    }
  }
}

/**
 * 고른 요일에 맞게 시작 날짜를 옮깁니다.
 *
 * 매주 수요일짜리에서 수요일을 빼고 토요일만 고르면, 시작 날짜(수)는 규칙에 없는 날이
 * 됩니다. 그대로 두면 '원본이지만 규칙에는 없는 날' 이라는 이상한 것이 하나 남습니다.
 * 시작을 첫 번째 맞는 날로 옮겨 규칙과 어긋나지 않게 합니다.
 *
 * 뒤로만 옮깁니다 — 앞으로 당기면 원래 시작하지도 않았던 날들이 되살아납니다.
 */
export function anchorFor(date: ISODate, days: number[] | undefined): ISODate {
  if (!days?.length || days.includes(dayOfWeek(date))) return date

  const from = parseISO(date)
  for (let i = 1; i <= 7; i++) {
    const next = new Date(from)
    next.setDate(next.getDate() + i)
    if (days.includes(next.getDay())) return toISO(next)
  }
  return date
}

/** 저장된 일정 하나를 그 날짜의 모습으로 */
function occurrenceOn(event: PlanEvent, date: ISODate): EventOccurrence {
  const virtual = date !== event.date
  return {
    ...event,
    date,
    // 같은 원본이 여러 날에 오므로 날짜까지 붙여야 서로 구분됩니다.
    id: virtual ? `${event.id}@${date}` : event.id,
    sourceId: event.id,
    virtual,
  }
}

/**
 * 보이는 날짜들에 대해서만 펼칩니다.
 *
 * 끝없이 반복되는 것을 미리 다 만들 수는 없습니다. 화면이 지금 무슨 날짜를 그리는지
 * 알고 있으니, 그만큼만 물어봅니다.
 */
export function expandEvents(events: PlanEvent[], dates: Iterable<ISODate>): EventOccurrence[] {
  const wanted = [...dates]
  const out: EventOccurrence[] = []

  for (const event of events) {
    if (!event.repeat) {
      out.push(occurrenceOn(event, event.date))
      continue
    }
    // 반복이라도 시작한 그 날은 늘 있습니다 — 보이는 범위 밖이어도 제자리에 둡니다.
    if (!wanted.includes(event.date) && !event.repeat.skip?.includes(event.date)) {
      out.push(occurrenceOn(event, event.date))
    }
    for (const date of wanted) {
      if (occursOn(event, date)) out.push(occurrenceOn(event, date))
    }
  }
  return out
}

/**
 * 할 일도 같은 방식으로 펼칩니다.
 *
 * 다만 끝냈는지는 날마다 다릅니다 — 매일 하는 일에 done 하나만 두면 오늘 체크한 것이
 * 내일도 끝난 것이 됩니다. 되풀이하는 것은 doneOn 에 그 날이 있는지로 봅니다.
 */
export function expandTodos(todos: Todo[], dates: Iterable<ISODate>): TodoOccurrence[] {
  const wanted = [...dates]
  const out: TodoOccurrence[] = []

  for (const todo of todos) {
    if (!todo.repeat) {
      out.push({ ...todo, sourceId: todo.id, virtual: false })
      continue
    }
    for (const date of wanted) {
      if (!occursOn(todo, date)) continue
      const virtual = date !== todo.date
      out.push({
        ...todo,
        date,
        id: virtual ? `${todo.id}@${date}` : todo.id,
        sourceId: todo.id,
        virtual,
        done: todo.doneOn?.includes(date) ?? false,
      })
    }
  }
  return out
}
