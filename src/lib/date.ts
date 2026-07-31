import type { ISODate, Time } from '@/types'

/**
 * 전부 순수 함수이며 로컬 타임존 기준입니다.
 * Date#toISOString() 은 UTC 로 변환되어 날짜가 하루 밀리므로 사용하지 않습니다.
 */

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toISO(d)
}

export function startOfWeek(s: ISODate, weekStart: 0 | 1): ISODate {
  const d = parseISO(s)
  const diff = (d.getDay() - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  return toISO(d)
}

/** 선택 주의 7일 */
export function weekDays(s: ISODate, weekStart: 0 | 1): ISODate[] {
  const first = startOfWeek(s, weekStart)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/**
 * 월간 달력 그리드 — 앞뒤 달을 채워 7의 배수(35 또는 42)로 반환합니다.
 */
export function monthGrid(s: ISODate, weekStart: 0 | 1): ISODate[] {
  const d = parseISO(s)
  const firstOfMonth = toISO(new Date(d.getFullYear(), d.getMonth(), 1))
  const lastOfMonth = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))

  const gridStart = startOfWeek(firstOfMonth, weekStart)
  const days: ISODate[] = []
  let cursor = gridStart

  // 마지막 날을 포함하는 주까지 채웁니다.
  while (cursor <= lastOfMonth || days.length % 7 !== 0) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
    if (days.length > 42) break
  }
  return days
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function dayOfMonth(s: ISODate): number {
  return Number(s.slice(8, 10))
}

export function dayOfWeek(s: ISODate): number {
  return parseISO(s).getDay()
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** 그리드 열 순서에 맞는 요일 라벨 */
export function weekdayLabels(weekStart: 0 | 1): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_KO[(i + weekStart) % 7])
}

export function weekdayLabel(s: ISODate): string {
  return WEEKDAY_KO[parseISO(s).getDay()]
}

/** '2026년 7월' */
export function formatMonthTitle(s: ISODate): string {
  const d = parseISO(s)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

/** '7월 28일 화요일' */
export function formatDateLong(s: ISODate): string {
  const d = parseISO(s)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}요일`
}

/** '7월 28일' */
export function formatDateShort(s: ISODate): string {
  const d = parseISO(s)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 주 범위: '7월 27일 – 8월 2일' */
export function formatWeekRange(s: ISODate, weekStart: 0 | 1): string {
  const days = weekDays(s, weekStart)
  return `${formatDateShort(days[0])} – ${formatDateShort(days[6])}`
}

export function formatTime(t: Time | undefined, hour12: boolean): string {
  if (!t) return ''
  if (!hour12) return t
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${period} ${hh}:${String(m).padStart(2, '0')}`
}

/** 150 → '2시간 30분', 45 → '45분', 120 → '2시간' */
export function formatMinutes(min: number): string {
  if (min <= 0) return '0분'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export function timeToMinutes(t: Time): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 그 달의 1일부터 말일까지 — 달마다 길이가 달라 직접 세지 않습니다. */
export function monthDays(s: ISODate): ISODate[] {
  const d = parseISO(s)
  const year = d.getFullYear()
  const month = d.getMonth()
  // 다음 달 0일 = 이번 달 말일
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => toISO(new Date(year, month, i + 1)))
}

/**
 * 그때부터 지금까지 며칠.
 *
 * 시각이 아니라 '날' 로 셉니다 — 어젯밤 11시와 오늘 새벽 1시는 두 시간 차이지만
 * 사람에게는 어제와 오늘입니다. 앞선 시각(미래)이면 0 으로 둡니다.
 */
export function daysSince(from: number, now: number): number {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(now)
  b.setHours(0, 0, 0, 0)
  // 서머타임이 있는 지역에서는 하루가 23시간일 수 있어 반올림합니다.
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

/**
 * 돌고 있는 시계 — '1:23:45' / '23:45'.
 *
 * 한 시간을 못 넘겼는데 '0:12:34' 로 두면 앞의 0 이 자리만 차지합니다.
 * 초까지 보여 주는 것은 이게 지금 돌고 있다는 표시이기도 합니다.
 */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
