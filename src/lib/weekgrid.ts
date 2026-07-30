import { timeToMinutes } from '@/lib/date'
import type { PlanEvent } from '@/types'

/**
 * 주간 시간 격자의 자리 계산.
 *
 * 높이는 CSS 가 아니라 여기서 정합니다 — 픽셀 좌표로 일정을 얹어야 해서
 * 한 시간이 몇 px 인지 두 곳이 다르게 알고 있으면 곧바로 어긋납니다.
 * CSS 는 --hour-h 로 이 값을 받아 씁니다.
 */
export const HOUR_H = 44

export const DAY_MINUTES = 24 * 60

/** 끝 시각이 없는 일정은 이만큼 잡아 그립니다. */
const DEFAULT_MIN = 60

/** 아무리 짧아도 제목 한 줄은 보이게 합니다. */
const MIN_MIN = 24

export interface TimedSlot {
  event: PlanEvent
  /** 격자 위에서의 위치(px) */
  top: number
  height: number
  /** 겹치는 묶음 안에서 몇 번째 칸인지 */
  column: number
  /** 그 묶음이 몇 칸으로 나뉘는지 */
  columns: number
}

/** 'HH:MM' 이 아니거나 범위를 벗어나면 null — 저장된 값이 깨져도 그리기는 멈추지 않습니다. */
function minutesOf(time: string | undefined): number | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null
  const min = timeToMinutes(time)
  if (!Number.isFinite(min) || min < 0 || min >= DAY_MINUTES) return null
  return min
}

/** 시간이 있는 일정만 격자에 오릅니다. 나머지는 '종일' 줄로 갑니다. */
export function isTimed(e: PlanEvent): boolean {
  return minutesOf(e.start) !== null
}

/**
 * 하루치 일정을 격자 좌표로 옮깁니다.
 *
 * 겹치는 것들은 한 묶음으로 보고 폭을 나눠 갖습니다. 겹칠 때 하나가 다른 하나를
 * 완전히 덮어 버리면 뒤엣것은 있는지조차 알 수 없습니다.
 */
export function layoutDay(events: PlanEvent[]): TimedSlot[] {
  const items = events
    .map((event) => {
      const start = minutesOf(event.start)
      if (start === null) return null
      const rawEnd = minutesOf(event.end)
      // 끝이 시작보다 앞이면(자정 넘김 등) 기본 길이로 둡니다.
      const end =
        rawEnd !== null && rawEnd > start ? rawEnd : Math.min(start + DEFAULT_MIN, DAY_MINUTES)
      return { event, start, end: Math.max(end, start + MIN_MIN) }
    })
    .filter((x): x is { event: PlanEvent; start: number; end: number } => x !== null)
    .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start))

  const slots: TimedSlot[] = []

  let cluster: typeof items = []
  /** 묶음 안에서 각 칸이 언제까지 차 있는지 */
  let columnEnds: number[] = []
  /** cluster 에 담긴 항목이 몇 번 칸을 쓰는지 */
  let columnOf: number[] = []

  const flush = () => {
    if (cluster.length === 0) return
    const columns = columnEnds.length
    cluster.forEach((item, i) => {
      slots.push({
        event: item.event,
        top: (item.start / 60) * HOUR_H,
        height: ((item.end - item.start) / 60) * HOUR_H,
        column: columnOf[i],
        columns,
      })
    })
    cluster = []
    columnEnds = []
    columnOf = []
  }

  for (const item of items) {
    // 묶음 안의 어떤 것과도 안 겹치면 새 묶음입니다.
    const clusterEnd = columnEnds.reduce((max, end) => Math.max(max, end), 0)
    if (cluster.length > 0 && item.start >= clusterEnd) flush()

    let col = columnEnds.findIndex((end) => end <= item.start)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(item.end)
    } else {
      columnEnds[col] = item.end
    }
    cluster.push(item)
    columnOf.push(col)
  }
  flush()

  return slots
}

/** 격자에서 누른 높이 → 분. 30분 단위로 맞춰 떨어집니다. */
export function minutesAt(offsetY: number): number {
  const raw = (offsetY / HOUR_H) * 60
  const snapped = Math.round(raw / 30) * 30
  return Math.min(Math.max(snapped, 0), DAY_MINUTES - 30)
}

/** 끌어 옮긴 픽셀 → 분. 15분 단위 — 옮길 때는 30분보다 잘게 잡아야 손맛이 납니다. */
export function snapDelta(dy: number): number {
  return Math.round((dy / HOUR_H) * 60 / 15) * 15
}

/** 시작을 옮깁니다. 길이는 그대로 두고 하루 밖으로 나가지 않게 붙잡습니다. */
export function movedTimes(
  start: string,
  end: string | undefined,
  deltaMin: number,
): { start: string; end?: string } {
  const from = timeToMinutes(start)
  const length = end ? Math.max(0, timeToMinutes(end) - from) : 0
  const next = Math.min(Math.max(from + deltaMin, 0), DAY_MINUTES - Math.max(length, MIN_MIN))
  return { start: timeAt(next), end: end ? timeAt(next + length) : undefined }
}

/** 끝을 늘이고 줄입니다. 시작보다 앞서지 않게, 자정을 넘지 않게. */
export function resizedEnd(start: string, end: string | undefined, deltaMin: number): string {
  const from = timeToMinutes(start)
  const base = end ? timeToMinutes(end) : from + DEFAULT_MIN
  const next = Math.min(Math.max(base + deltaMin, from + MIN_MIN), DAY_MINUTES)
  return timeAt(next)
}

/** 540 → '09:00' */
export function timeAt(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
