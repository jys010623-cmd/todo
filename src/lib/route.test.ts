import { describe, expect, it } from 'vitest'

import { formatHash, parseHash } from './route'

describe('parseHash', () => {
  it('화면 이름만 있는 주소', () => {
    expect(parseHash('#/today')).toEqual({ view: 'today' })
    expect(parseHash('#/settings')).toEqual({ view: 'settings' })
  })

  it('앞의 # 과 / 를 어떻게 쓰든 읽는다', () => {
    expect(parseHash('#/month')).toEqual({ view: 'month' })
    expect(parseHash('#month')).toEqual({ view: 'month' })
    expect(parseHash('month')).toEqual({ view: 'month' })
  })

  it('날짜를 쓰는 화면은 날짜까지 읽는다', () => {
    expect(parseHash('#/week/2026-07-30')).toEqual({ view: 'week', date: '2026-07-30' })
    expect(parseHash('#/month/2026-01-01')).toEqual({ view: 'month', date: '2026-01-01' })
  })

  it('날짜를 안 쓰는 화면에 날짜가 붙어 있으면 무시한다', () => {
    expect(parseHash('#/study/2026-07-30')).toEqual({ view: 'study' })
    expect(parseHash('#/goals/2026-07-30')).toEqual({ view: 'goals' })
  })

  it('없는 날짜는 버린다', () => {
    // 2026년 2월은 28일까지입니다.
    expect(parseHash('#/week/2026-02-31')).toEqual({ view: 'week' })
    expect(parseHash('#/week/2026-13-01')).toEqual({ view: 'week' })
    expect(parseHash('#/week/26-7-3')).toEqual({ view: 'week' })
  })

  it('모르는 주소는 null — 호출부가 기본값을 정합니다', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
    expect(parseHash('#/')).toBeNull()
    expect(parseHash('#/없는화면')).toBeNull()
    expect(parseHash('#/todayy')).toBeNull()
  })
})

describe('formatHash', () => {
  it('날짜를 쓰는 화면만 날짜를 담는다', () => {
    expect(formatHash('week', '2026-07-30')).toBe('#/week/2026-07-30')
    expect(formatHash('month', '2026-07-30')).toBe('#/month/2026-07-30')
    expect(formatHash('today', '2026-07-30')).toBe('#/today')
    expect(formatHash('mandal', '2026-07-30')).toBe('#/mandal')
  })

  it('만든 주소는 그대로 다시 읽힌다', () => {
    for (const view of ['today', 'week', 'month', 'goals', 'mandal', 'mindmap', 'study', 'settings'] as const) {
      const hash = formatHash(view, '2026-07-30')
      expect(parseHash(hash)?.view).toBe(view)
    }
  })
})
