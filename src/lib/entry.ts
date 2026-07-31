import { timeToMinutes } from '@/lib/date'
import { DAY_MINUTES, timeAt } from '@/lib/weekgrid'
import {
  TAG_COLORS,
  type ISODate,
  type PlanEvent,
  type Repeat,
  type RepeatFreq,
  type TagColor,
  type Time,
} from '@/types'

/** 연속으로 추가할 때 색이 겹치지 않도록 그날 일정 수에 따라 돌아가며 씁니다. */
export function nextTag(count: number): TagColor {
  return TAG_COLORS[count % TAG_COLORS.length]
}

export interface EventPreset {
  title: string
  start?: Time
  end?: Time
  tag: TagColor
}

/**
 * 자주 적은 일정 — 다시 적을 때 한 번에 채워 넣을 것들.
 *
 * 따로 즐겨찾기를 두지 않습니다. 무엇을 자주 하는지는 이미 적어 둔 것에 다 있고,
 * 별도로 관리하게 하면 등록할 것이 하나 더 느는 셈입니다.
 *
 * 시간과 색은 가장 최근에 적은 것을 따릅니다 — 운동을 아침으로 옮겼으면 칩도
 * 아침으로 따라옵니다.
 */
export function frequentEvents(events: PlanEvent[], limit = 5): EventPreset[] {
  const groups = new Map<string, { count: number; latest: PlanEvent }>()

  for (const event of events) {
    const title = event.title.trim()
    if (!title) continue

    const found = groups.get(title)
    if (!found) {
      groups.set(title, { count: 1, latest: event })
      continue
    }
    found.count += 1
    if (event.date > found.latest.date) found.latest = event
  }

  return (
    [...groups.values()]
      /*
       * 한 번뿐인 것은 '자주' 가 아닙니다. 다 보여 주면 그냥 지난 일정 목록이 되고,
       * 반복으로 적어 둔 것은 애초에 다시 적을 일이 없어 하나로 셉니다.
       */
      .filter((group) => group.count >= 2)
      .sort((a, b) =>
        b.count === a.count ? (a.latest.date < b.latest.date ? 1 : -1) : b.count - a.count,
      )
      .slice(0, limit)
      .map(({ latest }) => ({
        title: latest.title.trim(),
        start: latest.start,
        end: latest.end,
        tag: latest.tag,
      }))
  )
}

/**
 * 시간·반복 컨트롤이 주고받는 값.
 *
 * 저장 형태(PlanEvent)와 떼어 둡니다 — 아직 만들지 않은 일정에도 같은 규칙을 써야 하고,
 * 규칙을 화면이 아니라 여기 두어야 추가할 때와 고칠 때가 어긋나지 않습니다.
 */
export interface Timing {
  start?: Time
  end?: Time
  freq?: RepeatFreq
  /** 매주일 때 도는 요일들 (0 = 일요일) */
  days?: number[]
  /** 몇 번에 한 번 — 없거나 1 이면 매번 */
  every?: number
  /** 이 날까지만 */
  until?: ISODate
}

/**
 * 시작을 옮기면 끝도 같은 만큼 따라갑니다 — 격자에서 일정을 끌어 옮길 때와 같습니다.
 * 시작만 움직이면 두 시간짜리가 세 시간이 되거나, 끝이 시작보다 앞서 버립니다.
 *
 * 시작을 지우면 끝도 함께 지웁니다. 시작 없는 끝은 어디에도 그릴 수 없어,
 * 종일 일정에 '~ 12:00' 만 남습니다.
 */
export function withStart(timing: Timing, next: Time | undefined): Timing {
  if (!next) return { ...timing, start: undefined, end: undefined }
  if (!timing.start || !timing.end) return { ...timing, start: next }

  const length = Math.max(timeToMinutes(timing.end) - timeToMinutes(timing.start), 0)
  // 자정을 넘겨 다음 날로 새지 않게 붙잡습니다.
  const end = Math.min(timeToMinutes(next) + length, DAY_MINUTES - 1)
  return { ...timing, start: next, end: timeAt(end) }
}

/**
 * 끝은 시작보다 뒤여야 합니다 — 앞서면 격자에서 높이가 음수가 되고, 같으면
 * 길이가 0 인 일정이 됩니다. 받을 수 없는 값은 그냥 두어 고르기 전으로 되돌아갑니다.
 */
export function withEnd(timing: Timing, next: Time | undefined): Timing {
  if (!next) return { ...timing, end: undefined }
  if (!timing.start || timeToMinutes(next) <= timeToMinutes(timing.start)) return timing
  return { ...timing, end: next }
}

/** 일정에서 컨트롤 값으로 */
export function eventTiming(e: Pick<PlanEvent, 'start' | 'end' | 'repeat'>): Timing {
  return {
    start: e.start,
    end: e.end,
    freq: e.repeat?.freq,
    days: e.repeat?.days,
    every: e.repeat?.every,
    until: e.repeat?.until,
  }
}

/**
 * 컨트롤 값을 UPDATE_EVENT 용 patch 로 바꿉니다.
 *
 * 건너뛴 날들은 그대로 둡니다 — 시간을 고쳤다고 지난주에 건너뛴 것이 되살아나면
 * 안 됩니다.
 */
export function timingToPatch(
  timing: Timing,
  previous?: Repeat,
): Pick<PlanEvent, 'start' | 'end' | 'repeat'> {
  return {
    start: timing.start,
    end: timing.end,
    repeat: timing.freq
      ? {
          freq: timing.freq,
          skip: previous?.skip,
          // 요일은 매주에만 뜻이 있습니다 — 매일·매달로 바꿔 놓고 남아 있으면 유령 규칙이 됩니다.
          days: timing.freq === 'weekly' && timing.days?.length ? timing.days : undefined,
          every: timing.every && timing.every > 1 ? timing.every : undefined,
          until: timing.until,
        }
      : undefined,
  }
}
