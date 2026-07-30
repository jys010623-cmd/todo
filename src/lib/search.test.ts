import { describe, expect, it } from 'vitest'

import { createInitialData } from '@/store/initial'
import type { PlannerData } from '@/types'
import { groupHits, search } from './search'

const data = (patch: Partial<PlannerData> = {}): PlannerData => ({
  ...createInitialData(),
  ...patch,
})

const texts = (hits: ReturnType<typeof search>) => hits.map((h) => h.text)

describe('search — 빈 검색어', () => {
  it.each(['', '   '])('%s 이면 아무것도 안 찾는다', (q) => {
    expect(search(data({ todos: [{ id: 't', date: '2026-07-30', title: '장보기', done: false, order: 0 }] }), q)).toEqual([])
  })
})

describe('search — 어디서 찾는가', () => {
  const full = () =>
    data({
      todos: [{ id: 't1', date: '2026-07-30', title: '수학 문제집', done: false, order: 0 }],
      events: [{ id: 'e1', date: '2026-07-30', title: '수학 과외', start: '15:00', tag: 'blue' }],
      notes: { '2026-07-29': '오늘은 수학이 잘 풀렸다' },
      goals: [{
        id: 'g1', title: '수학 1등급', status: 'active', tag: 'lilac', order: 0,
        steps: [{ id: 's1', title: '수학 개념 정리', done: false }],
      }],
      wishes: [{ id: 'w1', title: '수학 인강', kind: 'learn', done: false, order: 0 }],
      subjects: [{ id: 'sub1', name: '수학', tag: 'blue', weeklyGoalMin: 600 }],
      mandals: [{
        id: 'm1', title: '2026', core: '수학 정복',
        subGoals: ['수학 기초', '', '', '', '', '', '', ''],
        actions: Array.from({ length: 8 }, (_, i) =>
          Array.from({ length: 8 }, (_, j) => ({ text: i === 0 && j === 0 ? '수학 하루 2시간' : '', done: false })),
        ),
      }],
      mindmaps: [{ id: 'mm1', title: '공부', nodes: [{ id: 'r', text: '수학 계획', order: 0 }] }],
    })

  it('모든 영역에서 찾는다', () => {
    const kinds = new Set(search(full(), '수학').map((h) => h.kind))
    expect([...kinds].sort()).toEqual(
      ['event', 'goal', 'mandal', 'mind', 'note', 'subject', 'todo', 'wish'].sort(),
    )
  })

  it('목표의 단계도 따로 찾는다', () => {
    const goals = search(full(), '수학').filter((h) => h.kind === 'goal')
    expect(texts(goals)).toContain('수학 1등급')
    expect(texts(goals)).toContain('수학 개념 정리')
  })

  it('만다라트는 핵심·세부·실행을 모두 본다', () => {
    expect(texts(search(full(), '수학').filter((h) => h.kind === 'mandal')).sort()).toEqual(
      ['수학 기초', '수학 정복', '수학 하루 2시간'].sort(),
    )
  })

  it('없는 말은 안 찾는다', () => {
    expect(search(full(), '물리')).toEqual([])
  })

  it('대소문자를 가리지 않는다', () => {
    const d = data({ todos: [{ id: 't', date: '2026-07-30', title: 'Study Plan', done: false, order: 0 }] })
    expect(texts(search(d, 'study plan'))).toEqual(['Study Plan'])
    expect(texts(search(d, 'STUDY'))).toEqual(['Study Plan'])
  })

  it('빈 칸은 건너뛴다 — 빈 문자열이 모든 검색에 걸리면 안 됩니다', () => {
    const d = data({
      mandals: [{
        id: 'm', title: 't', core: '',
        subGoals: Array(8).fill(''),
        actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ text: '', done: false }))),
      }],
      mindmaps: [{ id: 'mm', title: 't', nodes: [{ id: 'r', text: '', order: 0 }] }],
    })
    expect(search(d, 'ㄱ')).toEqual([])
  })
})

describe('search — 눌렀을 때 갈 곳', () => {
  it('날짜가 있는 것은 날짜를 들고 간다', () => {
    const d = data({
      todos: [{ id: 't', date: '2026-07-28', title: '보고서', done: false, order: 0 }],
      events: [{ id: 'e', date: '2026-07-29', title: '보고서 회의', tag: 'blue' }],
      notes: { '2026-07-27': '보고서 초안' },
    })
    const hits = search(d, '보고서')
    expect(hits.find((h) => h.kind === 'todo')).toMatchObject({ view: 'today', date: '2026-07-28' })
    expect(hits.find((h) => h.kind === 'event')).toMatchObject({ view: 'week', date: '2026-07-29' })
    expect(hits.find((h) => h.kind === 'note')).toMatchObject({ view: 'month', date: '2026-07-27' })
  })

  it('날짜가 없는 것은 화면만 알려 준다', () => {
    const d = data({ subjects: [{ id: 's', name: '영어', tag: 'mint', weeklyGoalMin: 300 }] })
    const [hit] = search(d, '영어')
    expect(hit.view).toBe('study')
    expect(hit.date).toBeUndefined()
  })

  it('id 가 서로 겹치지 않는다 — 목록 key 로 씁니다', () => {
    const d = data({
      todos: [{ id: 'x', date: '2026-07-30', title: '같은 글', done: false, order: 0 }],
      events: [{ id: 'x', date: '2026-07-30', title: '같은 글', tag: 'blue' }],
      subjects: [{ id: 'x', name: '같은 글', tag: 'blue', weeklyGoalMin: 0 }],
    })
    const ids = search(d, '같은 글').map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('search — 메모 조각', () => {
  const long = 'ㄱ'.repeat(200) + ' 찾는말 ' + 'ㄴ'.repeat(200)

  it('찾은 자리 앞뒤만 잘라 낸다', () => {
    const [hit] = search(data({ notes: { '2026-07-30': long } }), '찾는말')
    expect(hit.text).toContain('찾는말')
    expect(hit.text.length).toBeLessThan(100)
    expect(hit.text.startsWith('…')).toBe(true)
    expect(hit.text.endsWith('…')).toBe(true)
  })

  it('짧은 메모는 자르지 않는다', () => {
    const [hit] = search(data({ notes: { '2026-07-30': '짧은 메모' } }), '메모')
    expect(hit.text).toBe('짧은 메모')
  })
})

describe('groupHits', () => {
  it('종류별로 묶고 빈 묶음은 뺀다', () => {
    const d = data({
      todos: [{ id: 't', date: '2026-07-30', title: '가', done: false, order: 0 }],
      subjects: [{ id: 's', name: '가', tag: 'blue', weeklyGoalMin: 0 }],
    })
    const groups = groupHits(search(d, '가'))
    expect(groups.map((g) => g.kind)).toEqual(['todo', 'subject'])
    expect(groups.every((g) => g.hits.length > 0)).toBe(true)
  })

  it('날짜가 있으면 최근 것부터', () => {
    const d = data({
      todos: [
        { id: 'a', date: '2026-07-01', title: '가', done: false, order: 0 },
        { id: 'b', date: '2026-07-30', title: '가', done: false, order: 0 },
        { id: 'c', date: '2026-07-15', title: '가', done: false, order: 0 },
      ],
    })
    const [group] = groupHits(search(d, '가'))
    expect(group.hits.map((h) => h.date)).toEqual(['2026-07-30', '2026-07-15', '2026-07-01'])
  })

  it('너무 많으면 잘라 내고 몇 개 남았는지 알린다', () => {
    const d = data({
      todos: Array.from({ length: 42 }, (_, i) => ({
        id: `t${i}`, date: '2026-07-30', title: '가', done: false, order: i,
      })),
    })
    const [group] = groupHits(search(d, '가'))
    expect(group.hits).toHaveLength(30)
    expect(group.more).toBe(12)
  })

  it('찾은 것이 없으면 빈 배열', () => {
    expect(groupHits([])).toEqual([])
  })
})
