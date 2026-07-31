import { describe, expect, it } from 'vitest'

import type { Goal, PlanEvent, Todo } from '@/types'
import { streakOf, streaks, tallyGoalSteps, tallyTagMinutes, tallyTodos } from './review'

const td = (patch: Partial<Todo> = {}): Todo => ({
  id: 't',
  date: '2026-07-27',
  title: '물 마시기',
  done: false,
  order: 0,
  ...patch,
})

const ev = (patch: Partial<PlanEvent> = {}): PlanEvent => ({
  id: 'e',
  date: '2026-07-27',
  title: '회의',
  tag: 'blue',
  ...patch,
})

const week = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']

describe('할 일 세기', () => {
  it('그 날들의 것만 센다', () => {
    const todos = [td({ id: 'a', date: '2026-07-27', done: true }), td({ id: 'b', date: '2026-08-10' })]
    expect(tallyTodos(todos, week)).toEqual({ done: 1, total: 1 })
  })

  it('되풀이하는 것은 날마다 하나씩', () => {
    const todos = [td({ repeat: { freq: 'daily' }, doneOn: ['2026-07-27', '2026-07-29'] })]
    expect(tallyTodos(todos, week)).toEqual({ done: 2, total: 5 })
  })

  it('아무것도 없으면 0/0', () => {
    expect(tallyTodos([], week)).toEqual({ done: 0, total: 0 })
  })
})

describe('태그별 시간', () => {
  it('길이를 태그마다 모아 긴 것부터', () => {
    const out = tallyTagMinutes(
      [
        ev({ id: 'a', start: '09:00', end: '10:00', tag: 'blue' }),
        ev({ id: 'b', start: '13:00', end: '15:00', tag: 'mint' }),
        ev({ id: 'c', start: '16:00', end: '16:30', tag: 'blue' }),
      ],
      week,
    )
    expect(out).toEqual([
      { tag: 'mint', minutes: 120 },
      { tag: 'blue', minutes: 90 },
    ])
  })

  it('끝이 없으면 한 시간으로 본다', () => {
    expect(tallyTagMinutes([ev({ start: '09:00' })], week)).toEqual([{ tag: 'blue', minutes: 60 }])
  })

  it('끝이 시작보다 앞서도 한 시간', () => {
    expect(tallyTagMinutes([ev({ start: '09:00', end: '08:00' })], week)).toEqual([
      { tag: 'blue', minutes: 60 },
    ])
  })

  it('종일은 세지 않는다 — 길이가 없어 그것만으로 한 주가 찹니다', () => {
    expect(tallyTagMinutes([ev()], week)).toEqual([])
  })

  it('되풀이하는 것은 오는 날마다 센다', () => {
    const out = tallyTagMinutes([ev({ start: '09:00', end: '10:00', repeat: { freq: 'daily' } })], week)
    expect(out).toEqual([{ tag: 'blue', minutes: 300 }])
  })

  it('보이는 날 밖의 것은 안 센다', () => {
    // 원본이 범위 밖이면 펼치는 쪽이 늘 딸려 보내지만, 셈에는 들어가면 안 됩니다.
    const out = tallyTagMinutes(
      [ev({ date: '2026-06-01', start: '09:00', end: '10:00', repeat: { freq: 'monthly' } })],
      week,
    )
    expect(out).toEqual([])
  })
})

describe('목표 단계', () => {
  const goal = (status: Goal['status'], done: boolean[]): Goal => ({
    id: 'g' + status + done.length,
    title: '가',
    status,
    tag: 'blue',
    order: 0,
    steps: done.map((d, i) => ({ id: `s${i}`, title: '단계', done: d })),
  })

  it('진행 중인 것만 센다', () => {
    expect(tallyGoalSteps([goal('active', [true, false]), goal('done', [true, true])])).toEqual({
      done: 1,
      total: 2,
    })
  })

  it('단계가 없으면 0/0', () => {
    expect(tallyGoalSteps([goal('active', [])])).toEqual({ done: 0, total: 0 })
  })
})

describe('연속 기록', () => {
  const daily = (doneOn: string[]) =>
    td({ date: '2026-07-01', repeat: { freq: 'daily' }, doneOn })

  it('이어 온 날만큼', () => {
    expect(streakOf(daily(['2026-07-29', '2026-07-30', '2026-07-31']), '2026-07-31')).toBe(3)
  })

  it('오늘 것은 아직 안 했어도 끊긴 것으로 보지 않는다', () => {
    // 아침에 열었다고 기록이 0 이 되면 그 숫자를 믿을 수 없게 됩니다.
    expect(streakOf(daily(['2026-07-29', '2026-07-30']), '2026-07-31')).toBe(2)
  })

  it('그 앞에서 하루라도 빠지면 거기서 끊긴다', () => {
    expect(streakOf(daily(['2026-07-27', '2026-07-30', '2026-07-31']), '2026-07-31')).toBe(2)
  })

  it('시작한 날보다 앞으로는 세지 않는다', () => {
    const t = td({ date: '2026-07-30', repeat: { freq: 'daily' }, doneOn: ['2026-07-30', '2026-07-31'] })
    expect(streakOf(t, '2026-07-31')).toBe(2)
  })

  it('오는 날만 센다 — 매주면 그 요일만', () => {
    // 2026-07-31 은 금요일
    const t = td({ date: '2026-07-03', repeat: { freq: 'weekly' }, doneOn: ['2026-07-24', '2026-07-31'] })
    expect(streakOf(t, '2026-07-31')).toBe(2)
  })

  it('되풀이하지 않는 것은 0', () => {
    expect(streakOf(td({ done: true }), '2026-07-31')).toBe(0)
  })

  it('한 번도 못 이은 것은 목록에 없다', () => {
    const list = streaks([daily([]), daily(['2026-07-31'])], '2026-07-31')
    expect(list).toHaveLength(1)
    expect(list[0].days).toBe(1)
  })

  it('긴 것부터', () => {
    const a = td({ id: 'a', date: '2026-07-01', repeat: { freq: 'daily' }, doneOn: ['2026-07-31'] })
    const b = td({
      id: 'b',
      date: '2026-07-01',
      repeat: { freq: 'daily' },
      doneOn: ['2026-07-30', '2026-07-31'],
    })
    expect(streaks([a, b], '2026-07-31').map((s) => s.todo.id)).toEqual(['b', 'a'])
  })
})
