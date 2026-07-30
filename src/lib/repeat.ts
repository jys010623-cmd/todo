import { dayOfWeek, parseISO } from '@/lib/date'
import type { EventOccurrence, ISODate, PlanEvent, Repeat, RepeatFreq } from '@/types'

/**
 * 반복 일정.
 *
 * 별도 편집 화면을 두지 않고 제목 뒤에 '매주' 처럼 적습니다 — 시간을 '10:00 회의' 로
 * 적는 것과 같은 방식입니다. 폼을 띄우지 않는 것이 이 플래너의 입력 방식입니다.
 */

const WORD: Record<RepeatFreq, string> = {
  daily: '매일',
  weekly: '매주',
  monthly: '매달',
}

/** 같은 뜻으로 쓰는 말들 */
const ALIASES: Record<string, RepeatFreq> = {
  매일: 'daily',
  날마다: 'daily',
  매주: 'weekly',
  주마다: 'weekly',
  매달: 'monthly',
  매월: 'monthly',
  달마다: 'monthly',
}

/** 제목 끝의 '매주' 를 떼어 냅니다. */
export function parseRepeatSuffix(input: string): { title: string; freq?: RepeatFreq } {
  const m = input.trim().match(/^(.*?)[\s]+(\S+)$/)
  if (!m) return { title: input.trim() }

  const freq = ALIASES[m[2]]
  if (!freq || !m[1].trim()) return { title: input.trim() }
  return { title: m[1].trim(), freq }
}

/** 편집할 때 입력창에 담을 꼬리표 */
export function repeatSuffix(repeat: Repeat | undefined): string {
  return repeat ? ` ${WORD[repeat.freq]}` : ''
}

export function repeatLabel(repeat: Repeat | undefined): string | undefined {
  return repeat ? WORD[repeat.freq] : undefined
}

/**
 * 그 날에 이 반복이 오는가.
 *
 * 매달은 '같은 날짜' 입니다. 31일에 시작한 것은 30일까지인 달을 건너뜁니다 —
 * 없는 날짜를 말일로 당기면 사람이 적어 둔 것과 달라집니다.
 */
export function occursOn(event: PlanEvent, date: ISODate): boolean {
  const repeat = event.repeat
  if (!repeat) return event.date === date
  // 시작 전에는 오지 않습니다.
  if (date < event.date) return false
  if (repeat.skip?.includes(date)) return false
  if (date === event.date) return true

  switch (repeat.freq) {
    case 'daily':
      return true
    case 'weekly':
      return dayOfWeek(date) === dayOfWeek(event.date)
    case 'monthly':
      return parseISO(date).getDate() === parseISO(event.date).getDate()
  }
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
