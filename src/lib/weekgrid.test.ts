import { describe, expect, it } from 'vitest'

import type { PlanEvent } from '@/types'
import { HOUR_H, isTimed, layoutDay, minutesAt, timeAt, type TimedSlot } from './weekgrid'

const ev = (id: string, start?: string, end?: string): PlanEvent => ({
  id,
  date: '2026-07-30',
  title: id,
  start,
  end,
  tag: 'blue',
})

const by = (slots: TimedSlot[], id: string) => slots.find((s) => s.event.id === id)!

/** 두 상자가 화면에서 실제로 겹치는가 — 세로도 가로도 */
function overlaps(a: TimedSlot, b: TimedSlot): boolean {
  const vertical = a.top < b.top + b.height - 0.01 && b.top < a.top + a.height - 0.01
  const horizontal =
    a.column / a.columns < (b.column + 1) / b.columns - 0.001 &&
    b.column / b.columns < (a.column + 1) / a.columns - 0.001
  return vertical && horizontal
}

/** 어느 두 개도 겹치지 않아야 합니다 */
function noneOverlap(slots: TimedSlot[]) {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      expect(overlaps(slots[i], slots[j])).toBe(false)
    }
  }
}

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

  it('여섯이 한꺼번에 겹쳐도 모두 보인다', () => {
    const slots = layoutDay(Array.from({ length: 6 }, (_, i) => ev(`e${i}`, '09:00', '12:00')))
    expect(slots.every((s) => s.columns === 6)).toBe(true)
    expect(new Set(slots.map((s) => s.column)).size).toBe(6)
    noneOverlap(slots)
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
