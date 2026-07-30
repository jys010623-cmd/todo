import { describe, expect, it } from 'vitest'

import type { PlannerData, Todo } from '@/types'
import { createInitialData } from './initial'
import { reducer } from './reducer'

const D = '2026-07-30'

const base = (patch: Partial<PlannerData> = {}): PlannerData => ({
  ...createInitialData(),
  ...patch,
})

const td = (id: string, date: string, order: number, done = false): Todo => ({
  id,
  date,
  title: id,
  done,
  order,
})

describe('MOVE_TODOS — 밀린 할 일 이월', () => {
  it('옮긴 것은 그 날 맨 뒤에 붙는다', () => {
    const state = base({
      todos: [td('old1', '2026-07-28', 0), td('old2', '2026-07-29', 0), td('today1', D, 0), td('today2', D, 1)],
    })
    const next = reducer(state, { type: 'MOVE_TODOS', ids: ['old1', 'old2'], date: D })
    const day = next.todos.filter((t) => t.date === D).sort((a, b) => a.order - b.order)

    expect(day.map((t) => t.id)).toEqual(['today1', 'today2', 'old1', 'old2'])
    expect(new Set(day.map((t) => t.order)).size).toBe(day.length)
  })

  it('옮길 때 원래 날짜 순서를 지킨다', () => {
    const state = base({
      todos: [td('c', '2026-07-29', 0), td('a', '2026-07-27', 0), td('b', '2026-07-28', 0)],
    })
    const next = reducer(state, { type: 'MOVE_TODOS', ids: ['a', 'b', 'c'], date: D })
    expect(next.todos.sort((x, y) => x.order - y.order).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('이미 그 날에 있는 것을 옮겨도 번호가 겹치지 않는다', () => {
    const state = base({ todos: [td('x', D, 0), td('y', D, 1), td('z', D, 2)] })
    const next = reducer(state, { type: 'MOVE_TODOS', ids: ['x'], date: D })
    expect(new Set(next.todos.map((t) => t.order)).size).toBe(3)
    expect(next.todos.sort((a, b) => a.order - b.order).map((t) => t.id)).toEqual(['y', 'z', 'x'])
  })

  it('빈 목록이면 상태를 그대로 돌려준다', () => {
    const state = base({ todos: [td('a', '2026-07-28', 0)] })
    expect(reducer(state, { type: 'MOVE_TODOS', ids: [], date: D })).toBe(state)
  })

  it('없는 id 는 무시한다', () => {
    const state = base({ todos: [td('a', '2026-07-28', 0)] })
    const next = reducer(state, { type: 'MOVE_TODOS', ids: ['없음'], date: D })
    expect(next.todos[0].date).toBe('2026-07-28')
  })
})

describe('만다라트', () => {
  const withMandal = () =>
    base({
      mandals: [{
        id: 'm', title: 't', core: '',
        subGoals: Array(8).fill(''),
        actions: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ text: 'a', done: false }))),
      }],
    })

  it('새 만다라트는 빈 칸 64개로 시작한다', () => {
    const next = reducer(base(), { type: 'ADD_MANDAL', title: '새 판' })
    const m = next.mandals[0]
    expect(m.actions).toHaveLength(8)
    expect(m.actions.flat()).toHaveLength(64)
    expect(m.actions.flat().every((a) => a.text === '' && !a.done)).toBe(true)
  })

  it('한 칸만 켜지고 다른 칸은 그대로', () => {
    const on = reducer(withMandal(), { type: 'TOGGLE_MANDAL_ACTION', id: 'm', sub: 2, action: 5 })
    expect(on.mandals[0].actions[2][5].done).toBe(true)
    expect(on.mandals[0].actions[2][4].done).toBe(false)
    expect(on.mandals[0].actions[3].every((a) => !a.done)).toBe(true)
  })

  it('다시 누르면 꺼진다', () => {
    const on = reducer(withMandal(), { type: 'TOGGLE_MANDAL_ACTION', id: 'm', sub: 2, action: 5 })
    const off = reducer(on, { type: 'TOGGLE_MANDAL_ACTION', id: 'm', sub: 2, action: 5 })
    expect(off.mandals[0].actions[2][5].done).toBe(false)
  })

  it('글을 고쳐도 해낸 표시가 지워지지 않는다', () => {
    const on = reducer(withMandal(), { type: 'TOGGLE_MANDAL_ACTION', id: 'm', sub: 2, action: 5 })
    const edited = reducer(on, { type: 'SET_MANDAL_CELL', id: 'm', sub: 2, action: 5, text: '고침' })
    expect(edited.mandals[0].actions[2][5]).toEqual({ text: '고침', done: true })
  })
})

describe('마인드맵 자리 옮기기', () => {
  const withMap = () =>
    base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0 },
      ] }],
    })

  it('반올림해 저장한다', () => {
    const next = reducer(withMap(), { type: 'MOVE_MIND_NODE', mapId: 'm', nodeId: 'a', dx: 12.7, dy: -3.2 })
    const a = next.mindmaps[0].nodes.find((n) => n.id === 'a')!
    expect(a.dx).toBe(13)
    expect(a.dy).toBe(-3)
  })

  it('0 은 들고 있지 않는다', () => {
    const moved = reducer(withMap(), { type: 'MOVE_MIND_NODE', mapId: 'm', nodeId: 'a', dx: 5, dy: 5 })
    const back = reducer(moved, { type: 'MOVE_MIND_NODE', mapId: 'm', nodeId: 'a', dx: 0, dy: 0 })
    const a = back.mindmaps[0].nodes.find((n) => n.id === 'a')!
    expect(a.dx).toBeUndefined()
    expect(a.dy).toBeUndefined()
  })

  it('자동 배치로 되돌려도 노드와 글은 남는다', () => {
    const moved = reducer(withMap(), { type: 'MOVE_MIND_NODE', mapId: 'm', nodeId: 'a', dx: 40, dy: 40 })
    const reset = reducer(moved, { type: 'RESET_MIND_LAYOUT', mapId: 'm' })
    expect(reset.mindmaps[0].nodes.every((n) => n.dx === undefined && n.dy === undefined)).toBe(true)
    expect(reset.mindmaps[0].nodes).toHaveLength(2)
    expect(reset.mindmaps[0].nodes.find((n) => n.id === 'a')!.text).toBe('A')
  })

  it('노드를 지우면 그 아래 가지도 함께 사라진다', () => {
    const state = base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0 },
        { id: 'a1', text: 'A1', parentId: 'a', order: 0 },
        { id: 'b', text: 'B', parentId: 'r', order: 1 },
      ] }],
    })
    const next = reducer(state, { type: 'DELETE_MIND_NODE', mapId: 'm', nodeId: 'a' })
    expect(next.mindmaps[0].nodes.map((n) => n.id).sort()).toEqual(['b', 'r'])
  })

  it('루트는 지울 수 없다 — 나머지가 전부 미아가 됩니다', () => {
    const next = reducer(withMap(), { type: 'DELETE_MIND_NODE', mapId: 'm', nodeId: 'r' })
    expect(next.mindmaps[0].nodes).toHaveLength(2)
  })
})

describe('마인드맵 가지 재배치', () => {
  /** r ─ a ─ a1 ─ a11 / r ─ b */
  const deep = () =>
    base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0, dx: 40, dy: 40 },
        { id: 'a1', text: 'A1', parentId: 'a', order: 0 },
        { id: 'a11', text: 'A11', parentId: 'a1', order: 0 },
        { id: 'b', text: 'B', parentId: 'r', order: 1 },
      ] }],
    })
  const parentOf = (s: PlannerData, id: string) =>
    s.mindmaps[0].nodes.find((n) => n.id === id)?.parentId

  it('다른 노드 밑으로 들어간다', () => {
    const next = reducer(deep(), { type: 'REPARENT_MIND_NODE', mapId: 'm', nodeId: 'a', parentId: 'b' })
    expect(parentOf(next, 'a')).toBe('b')
    // 자손은 따라옵니다 — 부모만 바뀌면 됩니다.
    expect(parentOf(next, 'a1')).toBe('a')
    expect(parentOf(next, 'a11')).toBe('a1')
  })

  it('손으로 밀어 둔 자리는 버린다 — 새 자리는 자동 배치가 잡습니다', () => {
    const next = reducer(deep(), { type: 'REPARENT_MIND_NODE', mapId: 'm', nodeId: 'a', parentId: 'b' })
    const a = next.mindmaps[0].nodes.find((n) => n.id === 'a')!
    expect(a.dx).toBeUndefined()
    expect(a.dy).toBeUndefined()
  })

  it('새 형제들의 맨 뒤로 간다', () => {
    const state = base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'x', text: 'X', parentId: 'r', order: 0 },
        { id: 'p', text: 'P', parentId: 'r', order: 1 },
        { id: 'p1', text: 'P1', parentId: 'p', order: 0 },
      ] }],
    })
    const next = reducer(state, { type: 'REPARENT_MIND_NODE', mapId: 'm', nodeId: 'x', parentId: 'p' })
    const kids = next.mindmaps[0].nodes.filter((n) => n.parentId === 'p').sort((a, b) => a.order - b.order)
    expect(kids.map((n) => n.id)).toEqual(['p1', 'x'])
  })

  it.each([
    ['제 자손 밑으로', 'a', 'a11'],
    ['자기 자신 밑으로', 'a', 'a'],
    ['루트를 옮기려고', 'r', 'b'],
    ['없는 부모로', 'a', '없음'],
  ])('%s 는 무시한다 — 트리가 고리가 되면 배치가 무한히 돕니다', (_name, nodeId, parentId) => {
    const before = deep()
    const next = reducer(before, { type: 'REPARENT_MIND_NODE', mapId: 'm', nodeId, parentId })
    expect(next.mindmaps[0].nodes.map((n) => [n.id, n.parentId])).toEqual(
      before.mindmaps[0].nodes.map((n) => [n.id, n.parentId]),
    )
  })

  it('접힌 곳으로 옮기면 함께 펼친다', () => {
    const state = base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0 },
        { id: 'c', text: 'C', parentId: 'r', order: 1, collapsed: true },
        { id: 'c1', text: 'C1', parentId: 'c', order: 0 },
      ] }],
    })
    const next = reducer(state, { type: 'REPARENT_MIND_NODE', mapId: 'm', nodeId: 'a', parentId: 'c' })
    expect(next.mindmaps[0].nodes.find((n) => n.id === 'c')!.collapsed).toBeFalsy()
  })
})

describe('마인드맵 키보드 편집 — 이어 쓰기', () => {
  /** 루트 아래 a, b, c */
  const withSiblings = () =>
    base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0 },
        { id: 'b', text: 'B', parentId: 'r', order: 1 },
        { id: 'c', text: 'C', parentId: 'r', order: 2 },
      ] }],
    })

  const orderOf = (s: PlannerData) =>
    s.mindmaps[0].nodes
      .filter((n) => n.parentId === 'r')
      .sort((x, y) => x.order - y.order)
      .map((n) => n.id)

  it('넘긴 id 를 그대로 쓴다 — 그래야 방금 만든 노드로 옮겨 갑니다', () => {
    const next = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'new',
    })
    expect(next.mindmaps[0].nodes.some((n) => n.id === 'new')).toBe(true)
  })

  it('빈 노드도 만들어진다 — 자리를 먼저 잡고 그 자리에서 적습니다', () => {
    const next = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'new',
    })
    expect(next.mindmaps[0].nodes.find((n) => n.id === 'new')!.text).toBe('')
  })

  it('afterId 가 있으면 그 형제 바로 뒤에 끼운다', () => {
    const next = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'new', afterId: 'a',
    })
    expect(orderOf(next)).toEqual(['a', 'new', 'b', 'c'])
  })

  it('가운데 끼워도 뒤엣것들의 순서가 유지된다', () => {
    let s = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'n1', afterId: 'a',
    })
    s = reducer(s, { type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'n2', afterId: 'n1' })
    expect(orderOf(s)).toEqual(['a', 'n1', 'n2', 'b', 'c'])
    // 순서 번호가 겹치면 화면에서 뒤죽박죽이 됩니다.
    const orders = s.mindmaps[0].nodes.filter((n) => n.parentId === 'r').map((n) => n.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('afterId 가 없으면 맨 뒤에 붙는다', () => {
    const next = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: '', id: 'new',
    })
    expect(orderOf(next)).toEqual(['a', 'b', 'c', 'new'])
  })

  it('이미 있는 id 는 다시 쓰지 않는다 — 트리가 뒤틀립니다', () => {
    const next = reducer(withSiblings(), {
      type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'r', text: 'x', id: 'a',
    })
    expect(next.mindmaps[0].nodes).toHaveLength(4)
  })

  it('접힌 부모에 붙이면 함께 펼친다 — 방금 쓴 것이 안 보이면 안 됩니다', () => {
    const state = base({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0, collapsed: true },
        { id: 'a1', text: 'A1', parentId: 'a', order: 0 },
      ] }],
    })
    const next = reducer(state, { type: 'ADD_MIND_NODE', mapId: 'm', parentId: 'a', text: '새 가지' })
    expect(next.mindmaps[0].nodes.find((n) => n.id === 'a')!.collapsed).toBeFalsy()
  })
})

describe('스터디 타이머', () => {
  const subjects = [
    { id: 's1', name: '수학', tag: 'blue' as const, weeklyGoalMin: 600 },
    { id: 's2', name: '영어', tag: 'mint' as const, weeklyGoalMin: 300 },
  ]
  const withSubjects = () => base({ subjects })
  const minutesOf = (s: PlannerData, id: string) =>
    s.studyLogs.find((l) => l.subjectId === id && l.date === D)?.minutes ?? 0

  it('시작하면 기록은 아직 안 생긴다', () => {
    const a = reducer(withSubjects(), { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    expect(a.timer).toEqual({ subjectId: 's1', startedAt: 1000 })
    expect(a.studyLogs).toHaveLength(0)
  })

  it('없는 과목은 시작하지 않는다', () => {
    const a = reducer(withSubjects(), { type: 'START_TIMER', subjectId: '없음', startedAt: 1000 })
    expect(a.timer).toBeUndefined()
  })

  it('정지하면 그 자리에서 기록된다', () => {
    const a = reducer(withSubjects(), { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    const b = reducer(a, { type: 'STOP_TIMER', date: D, minutes: 25 })
    expect(b.timer).toBeUndefined()
    expect(minutesOf(b, 's1')).toBe(25)
  })

  it('0분이면 빈 기록을 만들지 않는다', () => {
    const a = reducer(withSubjects(), { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    const b = reducer(a, { type: 'STOP_TIMER', date: D, minutes: 0 })
    expect(b.timer).toBeUndefined()
    expect(b.studyLogs).toHaveLength(0)
  })

  it('버리면 아무것도 쌓이지 않는다', () => {
    const a = reducer(withSubjects(), { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    const b = reducer(a, { type: 'CANCEL_TIMER' })
    expect(b.timer).toBeUndefined()
    expect(b.studyLogs).toHaveLength(0)
  })

  it('타이머와 버튼 기록이 한 줄로 합쳐진다', () => {
    let s = reducer(withSubjects(), { type: 'LOG_STUDY', date: D, subjectId: 's1', minutes: 30 })
    s = reducer(s, { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    s = reducer(s, { type: 'STOP_TIMER', date: D, minutes: 15 })
    expect(minutesOf(s, 's1')).toBe(45)
    expect(s.studyLogs).toHaveLength(1)
  })

  it('과목을 지우면 타이머도 멈춘다 — 없는 과목은 기록할 수 없습니다', () => {
    const s = reducer(withSubjects(), { type: 'START_TIMER', subjectId: 's1', startedAt: 1000 })
    expect(reducer(s, { type: 'DELETE_SUBJECT', id: 's1' }).timer).toBeUndefined()
    expect(reducer(s, { type: 'DELETE_SUBJECT', id: 's2' }).timer?.subjectId).toBe('s1')
  })

  it('안 돌고 있을 때 정지해도 안전하다', () => {
    const s = reducer(withSubjects(), { type: 'STOP_TIMER', date: D, minutes: 30 })
    expect(s.studyLogs).toHaveLength(0)
    expect(s.timer).toBeUndefined()
  })
})

describe('REPLACE — 되돌리기와 가져오기가 쓰는 길', () => {
  it('상태를 통째로 갈아 끼운다', () => {
    const before = base({ todos: [td('a', D, 0)] })
    const after = reducer(before, { type: 'REPLACE', data: base() })
    expect(after.todos).toHaveLength(0)
  })
})
