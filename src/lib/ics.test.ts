import { describe, expect, it } from 'vitest'

import type { PlanEvent } from '@/types'
import { icsNow, toICS } from './ics'

const NOW = icsNow(new Date('2026-07-31T00:00:00Z').getTime())

const ev = (patch: Partial<PlanEvent> = {}): PlanEvent => ({
  id: 'e1',
  date: '2026-07-31',
  title: '팀 회의',
  tag: 'blue',
  ...patch,
})

/** 한 줄씩 보는 편이 어긋난 자리를 바로 짚어 줍니다. */
const lines = (events: PlanEvent[]) => toICS(events, NOW).split('\r\n')

describe('ICS — 껍데기', () => {
  it('달력 문서의 앞뒤가 맞는다', () => {
    const out = lines([])
    expect(out[0]).toBe('BEGIN:VCALENDAR')
    expect(out).toContain('VERSION:2.0')
    expect(out[out.length - 2]).toBe('END:VCALENDAR')
  })

  it('줄 끝은 CRLF — 이걸 LF 로 쓰면 못 읽는 달력이 있습니다', () => {
    expect(toICS([ev()], NOW)).toContain('\r\n')
  })

  it('제목이 빈 것은 내보내지 않는다', () => {
    expect(lines([ev({ title: '   ' })])).not.toContain('BEGIN:VEVENT')
  })
})

describe('ICS — 시각', () => {
  it('시작과 끝을 그대로 적는다', () => {
    const out = lines([ev({ start: '09:30', end: '10:45' })])
    expect(out).toContain('DTSTART:20260731T093000')
    expect(out).toContain('DTEND:20260731T104500')
  })

  it('끝이 없으면 한 시간 — 길이 0 이면 달력에서 선 하나로 사라집니다', () => {
    const out = lines([ev({ start: '09:30' })])
    expect(out).toContain('DTEND:20260731T103000')
  })

  it('끝이 시작보다 앞서도 한 시간으로 둔다', () => {
    const out = lines([ev({ start: '09:30', end: '08:00' })])
    expect(out).toContain('DTEND:20260731T103000')
  })

  it('종일은 날짜만, 끝은 다음 날 — ICS 규칙입니다', () => {
    const out = lines([ev()])
    expect(out).toContain('DTSTART;VALUE=DATE:20260731')
    expect(out).toContain('DTEND;VALUE=DATE:20260801')
  })
})

describe('ICS — 반복', () => {
  it('규칙 그대로 옮긴다 — 날짜를 다 펼치면 따로따로인 수백 개가 됩니다', () => {
    expect(lines([ev({ start: '09:00', repeat: { freq: 'weekly' } })])).toContain(
      'RRULE:FREQ=WEEKLY',
    )
  })

  it('간격과 요일', () => {
    const out = lines([ev({ start: '09:00', repeat: { freq: 'weekly', every: 2, days: [1, 3, 5] } })])
    expect(out).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR')
  })

  it('마지막 날은 그 날 끝까지 포함한다', () => {
    const out = lines([ev({ start: '09:00', repeat: { freq: 'daily', until: '2026-08-10' } })])
    expect(out).toContain('RRULE:FREQ=DAILY;UNTIL=20260810T235959')
  })

  it('건너뛴 날은 빼 준다 — 안 그러면 받는 쪽에 다시 나타납니다', () => {
    const out = lines([
      ev({ start: '09:00', repeat: { freq: 'daily', skip: ['2026-08-03'] } }),
    ])
    expect(out).toContain('EXDATE:20260803T090000')
  })

  it('종일 일정의 건너뛴 날은 날짜로', () => {
    const out = lines([ev({ repeat: { freq: 'daily', skip: ['2026-08-03'] } })])
    expect(out).toContain('EXDATE;VALUE=DATE:20260803')
  })
})

describe('ICS — 글자', () => {
  it('쉼표·세미콜론·줄바꿈을 감싼다 — 메모 한 줄이 파일을 깨뜨립니다', () => {
    const out = lines([ev({ title: '회의, 준비', note: '2층;정문\n김밥' })])
    expect(out).toContain('SUMMARY:회의\\, 준비')
    expect(out).toContain('DESCRIPTION:2층\\;정문\\n김밥')
  })

  it('메모가 없으면 줄도 없다', () => {
    expect(lines([ev()]).some((l) => l.startsWith('DESCRIPTION'))).toBe(false)
  })
})
