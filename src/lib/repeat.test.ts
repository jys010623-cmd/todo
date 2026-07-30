import { describe, expect, it } from 'vitest'

import type { PlanEvent } from '@/types'
import { eventToInput, inputToEventPatch, inputToNewEvent } from './entry'
import { expandEvents, occursOn, parseRepeatSuffix, repeatSuffix } from './repeat'

const ev = (patch: Partial<PlanEvent> = {}): PlanEvent => ({
  id: 'e',
  date: '2026-07-30', // 목요일
  title: '회의',
  tag: 'blue',
  ...patch,
})

describe('parseRepeatSuffix', () => {
  it.each([
    ['매일', 'daily'],
    ['날마다', 'daily'],
    ['매주', 'weekly'],
    ['주마다', 'weekly'],
    ['매달', 'monthly'],
    ['매월', 'monthly'],
    ['달마다', 'monthly'],
  ])('%s 를 떼어 낸다', (word, freq) => {
    expect(parseRepeatSuffix(`팀 회의 ${word}`)).toEqual({ title: '팀 회의', freq })
  })

  it('꼬리표가 없으면 제목 그대로', () => {
    expect(parseRepeatSuffix('팀 회의')).toEqual({ title: '팀 회의' })
    expect(parseRepeatSuffix('팀 회의 준비')).toEqual({ title: '팀 회의 준비' })
  })

  it('제목이 통째로 반복어면 제목으로 둔다 — 지울 것이 없습니다', () => {
    expect(parseRepeatSuffix('매주')).toEqual({ title: '매주' })
  })

  it('가운데 있는 말은 건드리지 않는다', () => {
    expect(parseRepeatSuffix('매주 회의')).toEqual({ title: '매주 회의' })
  })
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

describe('입력 글과 왕복', () => {
  it('적은 대로 읽힌다', () => {
    expect(inputToNewEvent('10:00 팀 회의 매주')).toEqual({
      title: '팀 회의',
      start: '10:00',
      repeat: { freq: 'weekly' },
    })
  })

  it('반복만, 시간만도 된다', () => {
    expect(inputToNewEvent('팀 회의 매일')).toMatchObject({ title: '팀 회의', repeat: { freq: 'daily' } })
    expect(inputToNewEvent('10:00 팀 회의')).toMatchObject({ title: '팀 회의', start: '10:00', repeat: undefined })
  })

  it('편집창에 담았다 그대로 돌아온다', () => {
    const e = ev({ start: '10:00', title: '팀 회의', repeat: { freq: 'weekly' } })
    const text = eventToInput(e)
    expect(text).toBe('10:00 팀 회의 매주')
    expect(inputToEventPatch(text)).toMatchObject({ title: '팀 회의', start: '10:00', repeat: { freq: 'weekly' } })
  })

  it('꼬리표를 지우면 반복이 풀린다', () => {
    expect(inputToEventPatch('10:00 팀 회의').repeat).toBeUndefined()
  })

  it('제목을 고쳐도 건너뛴 날은 지켜진다 — 지난주에 뺀 것이 되살아나면 안 됩니다', () => {
    const patch = inputToEventPatch('팀 회의 매주', { freq: 'weekly', skip: ['2026-08-06'] })
    expect(patch.repeat).toEqual({ freq: 'weekly', skip: ['2026-08-06'] })
  })

  it('반복이 없으면 꼬리표도 없다', () => {
    expect(repeatSuffix(undefined)).toBe('')
    expect(eventToInput(ev({ title: '회의' }))).toBe('회의')
  })
})
