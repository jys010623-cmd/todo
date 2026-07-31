import { describe, expect, it } from 'vitest'

import type { PlanEvent, Todo } from '@/types'
import { eventTiming, frequentEvents, timingToPatch, withEnd, withStart } from './entry'
import { anchorFor, expandEvents, expandTodos, occursOn, repeatLabel } from './repeat'

const ev = (patch: Partial<PlanEvent> = {}): PlanEvent => ({
  id: 'e',
  date: '2026-07-30', // 목요일
  title: '회의',
  tag: 'blue',
  ...patch,
})

describe('occursOn', () => {
  it('반복이 없으면 그 날뿐', () => {
    const e = ev()
    expect(occursOn(e, '2026-07-30')).toBe(true)
    expect(occursOn(e, '2026-07-31')).toBe(false)
  })

  it('시작 전에는 오지 않는다', () => {
    const e = ev({ repeat: { freq: 'daily' } })
    expect(occursOn(e, '2026-07-29')).toBe(false)
    expect(occursOn(e, '2026-07-30')).toBe(true)
  })

  it('매일', () => {
    const e = ev({ repeat: { freq: 'daily' } })
    for (const d of ['2026-07-31', '2026-08-01', '2027-01-01']) {
      expect(occursOn(e, d)).toBe(true)
    }
  })

  it('매주는 같은 요일', () => {
    const e = ev({ repeat: { freq: 'weekly' } })
    expect(occursOn(e, '2026-08-06')).toBe(true) // 목
    expect(occursOn(e, '2026-08-13')).toBe(true)
    expect(occursOn(e, '2026-08-05')).toBe(false) // 수
  })

  it('매달은 같은 날짜', () => {
    const e = ev({ repeat: { freq: 'monthly' } })
    expect(occursOn(e, '2026-08-30')).toBe(true)
    expect(occursOn(e, '2026-09-30')).toBe(true)
    expect(occursOn(e, '2026-08-29')).toBe(false)
  })

  it('없는 날짜인 달은 건너뛴다 — 말일로 당기면 적어 둔 것과 달라집니다', () => {
    const e = ev({ date: '2026-01-31', repeat: { freq: 'monthly' } })
    expect(occursOn(e, '2026-02-28')).toBe(false)
    expect(occursOn(e, '2026-03-31')).toBe(true)
  })

  it('건너뛴 날은 오지 않는다', () => {
    const e = ev({ repeat: { freq: 'daily', skip: ['2026-08-01'] } })
    expect(occursOn(e, '2026-07-31')).toBe(true)
    expect(occursOn(e, '2026-08-01')).toBe(false)
    expect(occursOn(e, '2026-08-02')).toBe(true)
  })

  it('시작한 날도 건너뛸 수 있다', () => {
    const e = ev({ repeat: { freq: 'daily', skip: ['2026-07-30'] } })
    expect(occursOn(e, '2026-07-30')).toBe(false)
  })
})

describe('expandEvents', () => {
  const week = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']

  it('반복이 없으면 제 날짜에 하나', () => {
    const out = expandEvents([ev()], week)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: '2026-07-30', sourceId: 'e', virtual: false })
  })

  it('보이는 날짜만큼만 펼친다 — 끝없는 반복을 다 만들 수는 없습니다', () => {
    const out = expandEvents([ev({ repeat: { freq: 'daily' } })], week)
    // 시작일(30)부터 주말(2일)까지 = 4일
    expect(out.map((o) => o.date)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'])
  })

  it('펼쳐 나온 것은 id 가 서로 다르고 원본을 가리킨다', () => {
    const out = expandEvents([ev({ repeat: { freq: 'daily' } })], week)
    expect(new Set(out.map((o) => o.id)).size).toBe(out.length)
    expect(out.every((o) => o.sourceId === 'e')).toBe(true)
    // 시작한 날은 저장된 그 자체입니다.
    expect(out[0].virtual).toBe(false)
    expect(out[1].virtual).toBe(true)
  })

  it('시작한 날이 보이는 범위 밖이어도 제자리에 남는다', () => {
    const out = expandEvents([ev({ date: '2026-01-05', repeat: { freq: 'weekly' } })], week)
    expect(out.map((o) => o.date)).toContain('2026-01-05')
  })

  it('건너뛴 날은 안 나온다', () => {
    const out = expandEvents([ev({ repeat: { freq: 'daily', skip: ['2026-07-31'] } })], week)
    expect(out.map((o) => o.date)).not.toContain('2026-07-31')
  })

  it('제목과 시간은 원본을 따라간다', () => {
    const out = expandEvents([ev({ start: '10:00', end: '11:00', repeat: { freq: 'daily' } })], week)
    expect(out.every((o) => o.start === '10:00' && o.end === '11:00' && o.title === '회의')).toBe(true)
  })
})

describe('반복 — 끝나는 날', () => {
  const weekly = (until?: string) => ev({ repeat: { freq: 'weekly', until } })

  it('끝나는 날까지는 온다', () => {
    // 2026-07-30 은 목요일
    expect(occursOn(weekly('2026-08-13'), '2026-08-13')).toBe(true)
  })

  it('그 다음부터는 오지 않는다', () => {
    expect(occursOn(weekly('2026-08-13'), '2026-08-20')).toBe(false)
  })

  it('없으면 끝없이 간다', () => {
    expect(occursOn(weekly(), '2027-08-19')).toBe(true)
  })
})

describe('반복 — 매주 여러 요일', () => {
  // 2026-07-30 목요일에 시작, 월·수·금
  const e = ev({ repeat: { freq: 'weekly', days: [1, 3, 5] } })

  it('고른 요일에는 온다', () => {
    expect(occursOn(e, '2026-07-31')).toBe(true) // 금
    expect(occursOn(e, '2026-08-03')).toBe(true) // 월
    expect(occursOn(e, '2026-08-05')).toBe(true) // 수
  })

  it('고르지 않은 요일에는 오지 않는다 — 시작한 그 날이라도', () => {
    expect(occursOn(e, '2026-07-30')).toBe(false) // 목, 시작일
    expect(occursOn(e, '2026-08-01')).toBe(false) // 토
  })

  it('비어 있으면 시작한 날의 요일 하나', () => {
    const one = ev({ repeat: { freq: 'weekly', days: [] } })
    expect(occursOn(one, '2026-08-06')).toBe(true) // 목
    expect(occursOn(one, '2026-08-07')).toBe(false) // 금
  })
})

describe('반복 — 간격', () => {
  it('격일', () => {
    const e = ev({ repeat: { freq: 'daily', every: 2 } })
    expect(occursOn(e, '2026-07-30')).toBe(true)
    expect(occursOn(e, '2026-07-31')).toBe(false)
    expect(occursOn(e, '2026-08-01')).toBe(true)
  })

  it('격주는 주 단위로 센다 — 같은 주의 여러 요일이 한 묶음이어야 합니다', () => {
    // 목요일 시작, 월·금, 2주마다
    const e = ev({ repeat: { freq: 'weekly', days: [1, 5], every: 2 } })
    expect(occursOn(e, '2026-07-31')).toBe(true) // 같은 주 금
    expect(occursOn(e, '2026-08-03')).toBe(false) // 다음 주 월 — 쉬는 주
    expect(occursOn(e, '2026-08-10')).toBe(true) // 두 주 뒤 월
    expect(occursOn(e, '2026-08-14')).toBe(true) // 두 주 뒤 금
  })

  it('격달', () => {
    const e = ev({ repeat: { freq: 'monthly', every: 2 } })
    expect(occursOn(e, '2026-08-30')).toBe(false)
    expect(occursOn(e, '2026-09-30')).toBe(true)
  })

  it('1 이하는 매번과 같다', () => {
    expect(occursOn(ev({ repeat: { freq: 'daily', every: 1 } }), '2026-07-31')).toBe(true)
    expect(occursOn(ev({ repeat: { freq: 'daily', every: 0 } }), '2026-07-31')).toBe(true)
  })
})

describe('anchorFor — 요일을 고르면 시작도 따라간다', () => {
  it('시작 요일이 이미 들어 있으면 그대로', () => {
    // 2026-07-30 목(4)
    expect(anchorFor('2026-07-30', [1, 4])).toBe('2026-07-30')
  })

  it('없으면 다음에 오는 첫 번째 맞는 날로', () => {
    expect(anchorFor('2026-07-30', [5])).toBe('2026-07-31') // 목 → 금
    expect(anchorFor('2026-07-30', [1])).toBe('2026-08-03') // 목 → 다음 월
  })

  it('앞으로 당기지 않는다 — 시작하지도 않았던 날이 되살아납니다', () => {
    expect(anchorFor('2026-07-30', [3]) > '2026-07-30').toBe(true) // 수는 다음 주 수로
  })

  it('고른 요일이 없으면 건드리지 않는다', () => {
    expect(anchorFor('2026-07-30', undefined)).toBe('2026-07-30')
    expect(anchorFor('2026-07-30', [])).toBe('2026-07-30')
  })
})

describe('반복 이름표', () => {
  it('간격이 있으면 그것으로 부른다', () => {
    expect(repeatLabel({ freq: 'weekly' })).toBe('매주')
    expect(repeatLabel({ freq: 'weekly', every: 2 })).toBe('2주마다')
    expect(repeatLabel({ freq: 'daily', every: 3 })).toBe('3일마다')
  })

  it('요일을 여러 개 고르면 함께 보여 준다 — 매주만으로는 무슨 요일인지 모릅니다', () => {
    expect(repeatLabel({ freq: 'weekly', days: [1, 3, 5] })).toBe('매주 월·수·금')
    // 하나뿐이면 굳이 붙이지 않습니다.
    expect(repeatLabel({ freq: 'weekly', days: [3] })).toBe('매주')
  })

  it('반복이 없으면 이름표도 없다', () => {
    expect(repeatLabel(undefined)).toBeUndefined()
  })
})

describe('되풀이하는 할 일', () => {
  const td = (patch: Partial<Todo> = {}): Todo => ({
    id: 't',
    date: '2026-07-30', // 목요일
    title: '물 마시기',
    done: false,
    order: 0,
    ...patch,
  })
  const week = ['2026-07-30', '2026-07-31', '2026-08-01']

  it('되풀이가 없으면 제 날에 하나뿐', () => {
    const out = expandTodos([td()], week)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-07-30')
    expect(out[0].virtual).toBe(false)
  })

  it('되풀이하면 날마다 펼쳐진다', () => {
    const out = expandTodos([td({ repeat: { freq: 'daily' } })], week)
    expect(out.map((t) => t.date)).toEqual(week)
  })

  it('끝낸 것은 그 날만 끝난 것 — 오늘 체크가 내일까지 끝내지 않습니다', () => {
    const out = expandTodos([td({ repeat: { freq: 'daily' }, doneOn: ['2026-07-31'] })], week)
    expect(out.map((t) => t.done)).toEqual([false, true, false])
  })

  it('펼쳐진 것은 원본을 가리킨다 — 고치거나 지울 때 씁니다', () => {
    const out = expandTodos([td({ repeat: { freq: 'daily' } })], week)
    expect(out.every((t) => t.sourceId === 't')).toBe(true)
    // 목록 key 가 겹치면 안 됩니다.
    expect(new Set(out.map((t) => t.id)).size).toBe(3)
  })

  it('일정과 같은 규칙을 쓴다 — 요일·마지막 날', () => {
    const out = expandTodos(
      [td({ repeat: { freq: 'weekly', days: [5], until: '2026-08-07' } })],
      ['2026-07-31', '2026-08-01', '2026-08-07', '2026-08-14'],
    )
    // 금요일만, 8/7 까지
    expect(out.map((t) => t.date)).toEqual(['2026-07-31', '2026-08-07'])
  })
})

describe('자주 적은 일정', () => {
  const many = (title: string, dates: string[], patch: Partial<PlanEvent> = {}) =>
    dates.map((date, i) => ev({ id: `${title}${i}`, title, date, ...patch }))

  it('두 번 넘게 적은 것만 올라온다 — 한 번뿐이면 자주가 아닙니다', () => {
    const out = frequentEvents([...many('러닝', ['2026-07-01', '2026-07-08']), ev({ title: '치과' })])
    expect(out.map((p) => p.title)).toEqual(['러닝'])
  })

  it('많이 적은 것이 앞에', () => {
    const out = frequentEvents([
      ...many('러닝', ['2026-07-01', '2026-07-08']),
      ...many('회의', ['2026-07-02', '2026-07-09', '2026-07-16']),
    ])
    expect(out.map((p) => p.title)).toEqual(['회의', '러닝'])
  })

  it('시간과 색은 가장 최근에 적은 것을 따른다 — 습관이 바뀌면 칩도 따라옵니다', () => {
    const out = frequentEvents([
      ev({ id: 'a', title: '러닝', date: '2026-07-01', start: '20:00', end: '21:00', tag: 'blue' }),
      ev({ id: 'b', title: '러닝', date: '2026-07-20', start: '07:00', end: '08:00', tag: 'mint' }),
    ])
    expect(out[0]).toEqual({ title: '러닝', start: '07:00', end: '08:00', tag: 'mint' })
  })

  it('넣은 순서와 상관없이 최근 것을 고른다', () => {
    const out = frequentEvents([
      ev({ id: 'b', title: '러닝', date: '2026-07-20', start: '07:00' }),
      ev({ id: 'a', title: '러닝', date: '2026-07-01', start: '20:00' }),
    ])
    expect(out[0].start).toBe('07:00')
  })

  it('앞뒤 공백만 다른 것은 같은 것으로 센다', () => {
    const out = frequentEvents([ev({ id: 'a', title: '러닝' }), ev({ id: 'b', title: ' 러닝 ' })])
    expect(out.map((p) => p.title)).toEqual(['러닝'])
  })

  it('개수를 넘겨 쏟아내지 않는다', () => {
    const events = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((t) =>
      many(t, ['2026-07-01', '2026-07-08']),
    )
    expect(frequentEvents(events)).toHaveLength(5)
    expect(frequentEvents(events, 2)).toHaveLength(2)
  })

  it('적어 둔 것이 없으면 아무것도 없다', () => {
    expect(frequentEvents([])).toEqual([])
  })
})

describe('시작 시각 고치기', () => {
  it('끝도 같은 길이로 따라간다 — 끌어 옮길 때와 같습니다', () => {
    expect(withStart({ start: '10:00', end: '11:30' }, '14:00')).toEqual({
      start: '14:00',
      end: '15:30',
    })
  })

  it('끝이 없으면 시작만 바뀐다', () => {
    expect(withStart({ start: '10:00' }, '14:00')).toEqual({ start: '14:00' })
    expect(withStart({}, '14:00')).toEqual({ start: '14:00' })
  })

  it('시작을 지우면 끝도 지워진다 — 종일 일정에 끝만 남으면 그릴 자리가 없습니다', () => {
    expect(withStart({ start: '10:00', end: '11:00' }, undefined)).toEqual({
      start: undefined,
      end: undefined,
    })
  })

  it('자정을 넘겨 다음 날로 새지 않는다', () => {
    expect(withStart({ start: '10:00', end: '13:00' }, '23:00').end).toBe('23:59')
  })

  it('반복은 그대로 둔다', () => {
    expect(withStart({ start: '10:00', freq: 'weekly' }, '14:00').freq).toBe('weekly')
  })
})

describe('끝 시각 고치기', () => {
  it('시작보다 뒤여야 받는다', () => {
    expect(withEnd({ start: '10:00' }, '11:00')).toEqual({ start: '10:00', end: '11:00' })
  })

  it('시작보다 앞이거나 같으면 고르기 전으로 되돌아간다', () => {
    const before = { start: '10:00', end: '11:00' }
    expect(withEnd(before, '09:00')).toBe(before)
    expect(withEnd(before, '10:00')).toBe(before)
  })

  it('시작이 없으면 끝만 정할 수 없다', () => {
    const before = {}
    expect(withEnd(before, '11:00')).toBe(before)
  })

  it('지울 수는 있다', () => {
    expect(withEnd({ start: '10:00', end: '11:00' }, undefined)).toEqual({
      start: '10:00',
      end: undefined,
    })
  })
})

describe('일정과 컨트롤 값 왕복', () => {
  it('일정에서 읽어 그대로 돌려준다', () => {
    const e = ev({ start: '10:00', end: '11:00', repeat: { freq: 'weekly' } })
    const timing = eventTiming(e)
    expect(timing).toEqual({ start: '10:00', end: '11:00', freq: 'weekly' })
    expect(timingToPatch(timing, e.repeat)).toMatchObject({
      start: '10:00',
      end: '11:00',
      repeat: { freq: 'weekly' },
    })
  })

  it('반복을 끄면 규칙이 풀린다', () => {
    expect(timingToPatch({ start: '10:00' }).repeat).toBeUndefined()
  })

  it('시간을 고쳐도 건너뛴 날은 지켜진다 — 지난주에 뺀 것이 되살아나면 안 됩니다', () => {
    const patch = timingToPatch({ start: '11:00', freq: 'weekly' }, {
      freq: 'weekly',
      skip: ['2026-08-06'],
    })
    expect(patch.repeat).toEqual({ freq: 'weekly', skip: ['2026-08-06'] })
  })
})
