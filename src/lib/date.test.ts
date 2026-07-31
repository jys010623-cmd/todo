import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  clock,
  daysSince,
  formatMinutes,
  formatTime,
  monthGrid,
  startOfWeek,
  timeToMinutes,
  toISO,
  weekDays,
} from './date'

describe('toISO', () => {
  it('로컬 타임존 기준으로 자릅니다 — UTC 로 바꾸면 하루가 밀립니다', () => {
    // 자정 직후. toISOString() 을 썼다면 시간대에 따라 전날이 됩니다.
    expect(toISO(new Date(2026, 6, 30, 0, 10))).toBe('2026-07-30')
    expect(toISO(new Date(2026, 6, 30, 23, 50))).toBe('2026-07-30')
  })

  it('한 자리 월·일을 채운다', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('달을 넘어간다', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('해를 넘어간다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('윤년 2월', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('addMonths', () => {
  it('그 달에 없는 날짜는 마지막 날로 눌러 준다', () => {
    // 1/31 에서 한 달 뒤가 3/3 이 되면 안 됩니다.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('해를 넘어간다', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('startOfWeek', () => {
  it('월요일 시작', () => {
    // 2026-07-30 은 목요일
    expect(startOfWeek('2026-07-30', 1)).toBe('2026-07-27')
    expect(startOfWeek('2026-07-27', 1)).toBe('2026-07-27')
  })

  it('일요일 시작', () => {
    expect(startOfWeek('2026-07-30', 0)).toBe('2026-07-26')
  })
})

describe('weekDays', () => {
  it('언제나 7일', () => {
    expect(weekDays('2026-07-30', 1)).toHaveLength(7)
  })

  it('첫날부터 이어진다', () => {
    expect(weekDays('2026-07-30', 1)).toEqual([
      '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30',
      '2026-07-31', '2026-08-01', '2026-08-02',
    ])
  })
})

describe('monthGrid', () => {
  it('7의 배수로 떨어진다', () => {
    for (const month of ['2026-01-15', '2026-02-15', '2026-07-15', '2028-02-15']) {
      expect(monthGrid(month, 1).length % 7).toBe(0)
    }
  })

  it('그 달의 첫날과 마지막 날을 모두 담는다', () => {
    const grid = monthGrid('2026-07-15', 1)
    expect(grid).toContain('2026-07-01')
    expect(grid).toContain('2026-07-31')
  })

  it('앞뒤로 이어진 날짜만 채운다', () => {
    const grid = monthGrid('2026-07-15', 1)
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i]).toBe(addDays(grid[i - 1], 1))
    }
  })
})

describe('formatTime', () => {
  it('24시간 표기는 그대로', () => {
    expect(formatTime('09:30', false)).toBe('09:30')
    expect(formatTime('00:00', false)).toBe('00:00')
  })

  it('오전·오후 표기', () => {
    expect(formatTime('09:30', true)).toBe('오전 9:30')
    expect(formatTime('13:05', true)).toBe('오후 1:05')
    expect(formatTime('00:00', true)).toBe('오전 12:00')
    expect(formatTime('12:00', true)).toBe('오후 12:00')
  })

  it('시간이 없으면 빈 문자열', () => {
    expect(formatTime(undefined, false)).toBe('')
  })
})

describe('formatMinutes', () => {
  it('시간과 분으로 나눈다', () => {
    expect(formatMinutes(45)).toBe('45분')
    expect(formatMinutes(60)).toBe('1시간')
    expect(formatMinutes(150)).toBe('2시간 30분')
  })

  it('0 이하는 0분', () => {
    expect(formatMinutes(0)).toBe('0분')
    expect(formatMinutes(-5)).toBe('0분')
  })
})

describe('timeToMinutes', () => {
  it('자정부터의 분', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('daysSince', () => {
  const at = (iso: string) => new Date(iso).getTime()

  it('같은 날이면 0', () => {
    expect(daysSince(at('2026-07-31T01:00'), at('2026-07-31T23:00'))).toBe(0)
  })

  it('밤을 넘기면 시간 차가 적어도 하루', () => {
    // 두 시간 차이지만 사람에게는 어제와 오늘입니다.
    expect(daysSince(at('2026-07-30T23:00'), at('2026-07-31T01:00'))).toBe(1)
  })

  it('날짜만큼 센다', () => {
    expect(daysSince(at('2026-07-01T09:00'), at('2026-07-31T09:00'))).toBe(30)
  })

  it('앞선 시각(미래)이면 0 — 음수 일수는 뜻이 없습니다', () => {
    expect(daysSince(at('2026-08-10T09:00'), at('2026-07-31T09:00'))).toBe(0)
  })
})

describe('clock', () => {
  const s = 1000
  const m = 60 * s

  it('한 시간을 못 넘기면 분:초', () => {
    expect(clock(0)).toBe('00:00')
    expect(clock(9 * s)).toBe('00:09')
    expect(clock(23 * m + 45 * s)).toBe('23:45')
    expect(clock(59 * m + 59 * s)).toBe('59:59')
  })

  it('넘기면 시:분:초 — 앞의 0 은 붙이지 않는다', () => {
    expect(clock(60 * m)).toBe('1:00:00')
    expect(clock(83 * m + 45 * s)).toBe('1:23:45')
  })

  it('초 아래는 버린다 — 올리면 00:00 에서 시작하지 않습니다', () => {
    expect(clock(999)).toBe('00:00')
    expect(clock(1999)).toBe('00:01')
  })

  it('음수는 0 으로 — 뽀모도로가 끝나는 순간 잠깐 넘어갑니다', () => {
    expect(clock(-5000)).toBe('00:00')
  })
})
