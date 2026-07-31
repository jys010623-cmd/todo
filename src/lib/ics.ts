import { timeToMinutes } from '@/lib/date'
import type { ISODate, PlanEvent, Repeat, RepeatFreq, Time } from '@/types'

/**
 * 일정을 달력 파일(.ics)로.
 *
 * 적어 둔 것이 이 브라우저에만 갇혀 있지 않게 합니다 — 구글 캘린더나 폰의 기본
 * 달력으로 한 번에 넘어갑니다. 백업(JSON)과는 쓰임이 다릅니다. 백업은 이 앱으로
 * 돌아오기 위한 것이고, 이건 다른 데서 보기 위한 것입니다.
 *
 * 반복은 규칙 그대로 RRULE 로 옮깁니다. 날짜를 다 펼쳐 내보내면 파일이 수천 줄이
 * 되고, 받는 쪽에서 '매주 하는 일' 이 아니라 '따로따로인 수백 개' 가 됩니다.
 */

const FREQ: Record<RepeatFreq, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
}

/** 0(일) … 6(토) → ICS 의 요일 약자 */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** '2026-07-31' → '20260731' */
function stamp(date: ISODate): string {
  return date.replace(/-/g, '')
}

/** '2026-07-31' + '09:30' → '20260731T093000' */
function stampAt(date: ISODate, time: Time): string {
  const [h, m] = time.split(':')
  return `${stamp(date)}T${h.padStart(2, '0')}${m}00`
}

/** 하루 뒤 — 종일 일정의 끝은 '다음 날 0시' 로 적습니다(ICS 규칙). */
function nextDay(date: ISODate): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return stamp(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  )
}

/**
 * 줄바꿈·쉼표·세미콜론은 ICS 에서 뜻이 있는 글자입니다.
 * 그대로 두면 메모 한 줄이 파일 전체를 깨뜨립니다.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function rrule(repeat: Repeat, freq: RepeatFreq): string {
  const parts = [`FREQ=${FREQ[freq]}`]
  if (repeat.every && repeat.every > 1) parts.push(`INTERVAL=${repeat.every}`)
  if (freq === 'weekly' && repeat.days?.length) {
    parts.push(`BYDAY=${[...repeat.days].sort().map((d) => BYDAY[d]).join(',')}`)
  }
  // 마지막 날 끝까지 포함하도록 그 날의 끝 시각으로 적습니다.
  if (repeat.until) parts.push(`UNTIL=${stamp(repeat.until)}T235959`)
  return `RRULE:${parts.join(';')}`
}

/** 한 일정의 VEVENT 줄들 */
function lines(event: PlanEvent, now: string): string[] {
  const out = [
    'BEGIN:VEVENT',
    `UID:${event.id}@planme`,
    `DTSTAMP:${now}`,
    `SUMMARY:${esc(event.title)}`,
  ]

  if (event.start) {
    out.push(`DTSTART:${stampAt(event.date, event.start)}`)
    /*
     * 끝이 없으면 한 시간으로 둡니다. 시작만 있는 일정을 받는 쪽은 대개 길이 0 으로
     * 그려서, 달력에서 선 하나로 사라집니다.
     */
    const end = event.end && timeToMinutes(event.end) > timeToMinutes(event.start)
      ? event.end
      : undefined
    out.push(
      end
        ? `DTEND:${stampAt(event.date, end)}`
        : `DTEND:${stampAt(event.date, addHour(event.start))}`,
    )
  } else {
    // 종일 — 날짜만 적습니다.
    out.push(`DTSTART;VALUE=DATE:${stamp(event.date)}`)
    out.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`)
  }

  if (event.repeat) {
    out.push(rrule(event.repeat, event.repeat.freq))
    for (const date of event.repeat.skip ?? []) {
      // 건너뛴 날은 규칙에서 빼 줍니다 — 안 그러면 받는 쪽에 다시 나타납니다.
      out.push(
        event.start
          ? `EXDATE:${stampAt(date, event.start)}`
          : `EXDATE;VALUE=DATE:${stamp(date)}`,
      )
    }
  }

  if (event.note) out.push(`DESCRIPTION:${esc(event.note)}`)
  out.push('END:VEVENT')
  return out
}

function addHour(time: Time): Time {
  const total = Math.min(timeToMinutes(time) + 60, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * 일정 전체를 하나의 ICS 문서로.
 * now 는 호출부가 넘깁니다 — 여기서 시계를 읽으면 같은 입력에 다른 결과가 나옵니다.
 */
export function toICS(events: PlanEvent[], now: string): string {
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanMe//KO',
    'CALSCALE:GREGORIAN',
  ]
  for (const event of events) {
    if (!event.title.trim()) continue
    out.push(...lines(event, now))
  }
  out.push('END:VCALENDAR')
  // ICS 는 줄 끝이 CRLF 입니다.
  return out.join('\r\n') + '\r\n'
}

/** '20260731T090000Z' — DTSTAMP 에 쓰는 UTC 표기 */
export function icsNow(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}
