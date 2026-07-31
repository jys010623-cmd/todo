import { describe, expect, it } from 'vitest'

import type { PlanEvent } from '@/types'
import {
  HOUR_H,
  isTimed,
  layoutDay,
  MAX_LANES,
  minutesAt,
  movedTimes,
  resizedEnd,
  snapDelta,
  timeAt,
  type TimedSlot,
} from './weekgrid'

const ev = (id: string, start?: string, end?: string): PlanEvent => ({
  id,
  date: '2026-07-30',
  title: id,
  start,
  end,
  tag: 'blue',
})

const by = (slots: TimedSlot[], id: string) => slots.find((s) => s.event.id === id)!

/**
 * 시간이 겹치는데 같은 자리(column)를 쓰는가.
 *
 * 화면에서 상자끼리 조금 겹치는 것은 일부러 그렇게 둔 것입니다(layoutDay 의 오른쪽 확장).
 * 하지만 같은 자리를 배정받으면 하나가 다른 하나를 통째로 덮어, 있는 줄도 모릅니다.
 */
function sameLane(a: TimedSlot, b: TimedSlot): boolean {
  const vertical = a.top < b.top + b.height - 0.01 && b.top < a.top + a.height - 0.01
  return vertical && a.column === b.column
}

/** 겹치는 것끼리는 어느 둘도 같은 자리를 쓰지 않아야 합니다 */
function noneOverlap(slots: TimedSlot[]) {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      expect(sameLane(slots[i], slots[j])).toBe(false)
    }
  }
}

describe('layoutDay — 가로 자리', () => {
  it('혼자면 열을 다 쓴다', () => {
    const [s] = layoutDay([ev('a', '09:00', '10:00')])
    expect(s.left).toBe(0)
    expect(s.width).toBe(100)
  })

  it('늦게 시작하는 것 밑으로는 뻗는다 — 내 글은 그 위에 있습니다', () => {
    const slots = layoutDay([ev('a', '19:00', '21:00'), ev('b', '20:00', '21:00')])
    // a 는 b 가 시작하기 전 구간에서 열을 다 씁니다.
    expect(by(slots, 'a').width).toBe(100)
    expect(by(slots, 'a').left).toBe(0)
    // b 는 제 자리를 지킵니다 — 왼쪽으로 밀지 않습니다.
    expect(by(slots, 'b').left).toBe(50)
    expect(by(slots, 'b').width).toBe(50)
  })

  it('같이 시작하면 뻗지 않는다 — 뻗어 봐야 처음부터 덮여 제목만 잘립니다', () => {
    const slots = layoutDay([ev('a', '10:00', '12:00'), ev('b', '10:00', '12:00')])
    expect(by(slots, 'a').width).toBe(50)
    expect(by(slots, 'b').width).toBe(50)
  })

  it('먼저 시작한 것에 막히면 거기서 멈춘다', () => {
    // b(09:30)는 c(09:00)보다 늦게 시작하므로 c 밑으로는 못 뻗습니다.
    const slots = layoutDay([
      ev('a', '09:00', '12:00'),
      ev('b', '09:30', '12:00'),
      ev('c', '09:00', '12:00'),
    ])
    expect(by(slots, 'b').width).toBeCloseTo(100 / 3, 6)
  })

  it('아무도 안 겹치는 칸까지는 뻗는다', () => {
    // a 는 12:00 에 끝나고 c 는 13:00 에 시작 — 셋이 한 묶음이지만 a 는 c 와 무관합니다.
    const slots = layoutDay([
      ev('a', '09:00', '12:00'),
      ev('b', '10:00', '14:00'),
      ev('c', '13:00', '14:00'),
    ])
    expect(by(slots, 'a').width).toBeGreaterThan(100 / 3)
  })

  it('어느 칸도 열 밖으로 나가지 않는다', () => {
    const slots = layoutDay([
      ev('a', '09:00', '12:00'),
      ev('b', '09:00', '12:00'),
      ev('c', '10:00', '12:00'),
      ev('d', '11:00', '12:00'),
    ])
    for (const s of slots) {
      expect(s.left).toBeGreaterThanOrEqual(0)
      expect(s.left + s.width).toBeLessThanOrEqual(100.000001)
    }
  })

  it('왼쪽으로는 절대 밀지 않는다 — 앞 칸을 덮는 것은 이것뿐입니다', () => {
    const slots = layoutDay([
      ev('a', '09:00', '12:00'),
      ev('b', '09:00', '12:00'),
      ev('c', '09:00', '12:00'),
    ])
    for (const s of slots) {
      expect(s.left).toBeCloseTo((s.column * 100) / s.columns, 6)
    }
  })
})

describe('isTimed', () => {
  it('시작 시각이 제대로 있어야 격자에 오른다', () => {
    expect(isTimed(ev('a', '09:00'))).toBe(true)
    expect(isTimed(ev('b', '9:30'))).toBe(true)
    expect(isTimed(ev('c'))).toBe(false)
    expect(isTimed(ev('d', '9시'))).toBe(false)
    expect(isTimed(ev('e', '25:00'))).toBe(false)
  })
})

describe('layoutDay — 자리와 높이', () => {
  it('시작·끝이 그대로 좌표가 된다', () => {
    const [s] = layoutDay([ev('a', '09:00', '10:30')])
    expect(s.top).toBe(9 * HOUR_H)
    expect(s.height).toBe(1.5 * HOUR_H)
    expect(s.column).toBe(0)
    expect(s.columns).toBe(1)
  })

  it('끝이 없으면 한 시간', () => {
    expect(layoutDay([ev('a', '14:00')])[0].height).toBe(HOUR_H)
  })

  it('끝이 시작보다 앞이면 기본 길이 — 음수 높이로 상자가 뒤집히지 않게', () => {
    const [s] = layoutDay([ev('a', '23:00', '01:00')])
    expect(s.height).toBe(HOUR_H)
    expect(s.top + s.height).toBeLessThanOrEqual(24 * HOUR_H + 0.01)
  })

  it('아주 짧아도 제목 한 줄은 보이는 높이', () => {
    const [s] = layoutDay([ev('a', '09:00', '09:05')])
    expect(s.height).toBeGreaterThanOrEqual((24 / 60) * HOUR_H - 0.01)
  })

  it('시각이 깨진 것은 빼고 나머지는 그린다', () => {
    const slots = layoutDay([ev('good', '09:00'), ev('b', '9시'), ev('c', '99:99'), ev('d')])
    expect(slots).toHaveLength(1)
    expect(slots[0].event.id).toBe('good')
    expect(Number.isFinite(slots[0].top)).toBe(true)
  })
})

describe('layoutDay — 겹칠 때', () => {
  it('안 겹치면 각자 폭을 다 쓴다', () => {
    const slots = layoutDay([ev('a', '09:00', '10:00'), ev('b', '10:00', '11:00')])
    expect(slots.every((s) => s.columns === 1)).toBe(true)
    noneOverlap(slots)
  })

  it('둘이 겹치면 반씩', () => {
    const slots = layoutDay([ev('a', '09:00', '11:00'), ev('b', '10:00', '12:00')])
    expect(slots.every((s) => s.columns === 2)).toBe(true)
    expect(by(slots, 'a').column).not.toBe(by(slots, 'b').column)
    noneOverlap(slots)
  })

  it('셋이 겹치면 셋으로', () => {
    const slots = layoutDay([
      ev('a', '09:00', '12:00'),
      ev('b', '09:30', '10:30'),
      ev('c', '10:00', '11:00'),
    ])
    expect(slots.every((s) => s.columns === 3)).toBe(true)
    expect(slots.map((s) => s.column).sort()).toEqual([0, 1, 2])
    noneOverlap(slots)
  })

  it('앞엣것이 끝나면 그 칸을 물려받는다 — 쓸데없이 쪼개지 않게', () => {
    const slots = layoutDay([
      ev('a', '09:00', '10:00'),
      ev('b', '09:30', '11:00'),
      ev('c', '10:15', '11:00'),
    ])
    expect(slots.every((s) => s.columns === 2)).toBe(true)
    expect(by(slots, 'c').column).toBe(by(slots, 'a').column)
    noneOverlap(slots)
  })

  it('떨어진 묶음은 서로 영향이 없다', () => {
    const slots = layoutDay([
      ev('a', '09:00', '10:00'),
      ev('b', '09:00', '10:00'),
      ev('c', '14:00', '15:00'),
    ])
    expect(by(slots, 'a').columns).toBe(2)
    expect(by(slots, 'c').columns).toBe(1)
  })

  it('셋까지는 나란히 선다', () => {
    const slots = layoutDay(Array.from({ length: 3 }, (_, i) => ev(`e${i}`, '09:00', '12:00')))
    expect(slots).toHaveLength(3)
    expect(slots.every((s) => s.columns === MAX_LANES)).toBe(true)
    expect(slots.every((s) => s.more === undefined)).toBe(true)
    noneOverlap(slots)
  })

  it('넘치면 마지막 자리에 접고 몇 개가 더 있는지 말한다', () => {
    // 여섯을 다 세우면 한 칸이 손톱만 해집니다.
    const slots = layoutDay(Array.from({ length: 6 }, (_, i) => ev(`e${i}`, '09:00', '12:00')))
    expect(slots).toHaveLength(MAX_LANES)
    expect(slots.every((s) => s.columns === MAX_LANES)).toBe(true)

    const folded = slots.filter((s) => s.more !== undefined)
    expect(folded).toHaveLength(1)
    // 접힌 자리 하나가 나머지 넷을 대신합니다 — 자기 말고 셋이 더 있습니다.
    expect(folded[0].more).toBe(3)
    expect(folded[0].column).toBe(MAX_LANES - 1)
  })

  it('접힌 자리는 감춘 것들의 처음부터 끝까지를 덮는다', () => {
    const slots = layoutDay([
      ev('a', '09:00', '10:00'),
      ev('b', '09:00', '10:00'),
      ev('c', '09:00', '09:30'),
      ev('d', '09:00', '11:00'),
    ])
    const folded = slots.find((s) => s.more !== undefined)!
    expect(folded.top).toBe((9 / 1) * HOUR_H)
    expect(folded.height).toBe(2 * HOUR_H) // 09:00 – 11:00
  })
})

describe('snapDelta — 끌어 옮긴 거리', () => {
  it('15분 단위로 떨어진다', () => {
    expect(snapDelta(HOUR_H)).toBe(60)
    expect(snapDelta(HOUR_H / 2)).toBe(30)
    expect(snapDelta(HOUR_H / 4)).toBe(15)
    expect(snapDelta(-HOUR_H)).toBe(-60)
  })

  it('가까운 쪽으로 붙는다', () => {
    expect(snapDelta(HOUR_H * 0.1)).toBe(0)
    expect(snapDelta(HOUR_H * 0.2)).toBe(15)
  })
})

describe('movedTimes — 옮기기', () => {
  it('길이를 그대로 두고 통째로 옮긴다', () => {
    expect(movedTimes('09:00', '10:30', 60)).toEqual({ start: '10:00', end: '11:30' })
    expect(movedTimes('09:00', '10:30', -90)).toEqual({ start: '07:30', end: '09:00' })
  })

  it('끝이 없으면 없는 채로', () => {
    expect(movedTimes('09:00', undefined, 30)).toEqual({ start: '09:30', end: undefined })
  })

  it('자정 앞뒤로 넘어가지 않는다', () => {
    expect(movedTimes('00:30', undefined, -600).start).toBe('00:00')
    const late = movedTimes('23:00', '23:30', 600)
    expect(late.end).toBe('24:00')
    expect(late.start).toBe('23:30')
  })
})

describe('resizedEnd — 길이 조절', () => {
  it('끝만 움직인다', () => {
    expect(resizedEnd('09:00', '10:00', 30)).toBe('10:30')
    expect(resizedEnd('09:00', '10:00', -30)).toBe('09:30')
  })

  it('끝이 없으면 기본 한 시간에서 시작한다', () => {
    expect(resizedEnd('09:00', undefined, 30)).toBe('10:30')
  })

  it('시작보다 앞서지 않는다 — 음수 높이면 상자가 뒤집힙니다', () => {
    expect(resizedEnd('09:00', '10:00', -600)).toBe('09:24')
  })

  it('자정을 넘지 않는다', () => {
    expect(resizedEnd('23:00', '23:30', 600)).toBe('24:00')
  })
})

describe('minutesAt / timeAt', () => {
  it('누른 높이를 30분 단위로 맞춘다', () => {
    expect(timeAt(minutesAt(0))).toBe('00:00')
    expect(timeAt(minutesAt(9 * HOUR_H))).toBe('09:00')
    expect(timeAt(minutesAt(9.5 * HOUR_H))).toBe('09:30')
    expect(timeAt(minutesAt(9.2 * HOUR_H))).toBe('09:00')
    expect(timeAt(minutesAt(9.4 * HOUR_H))).toBe('09:30')
  })

  it('하루 밖으로 나가지 않는다', () => {
    expect(timeAt(minutesAt(-500))).toBe('00:00')
    expect(timeAt(minutesAt(999 * HOUR_H))).toBe('23:30')
  })
})
