import { describe, expect, it } from 'vitest'

import type { MindNode, PlannerData } from '@/types'
import { parseData } from './storage'

/** parseData 는 통째로 받으므로, 볼 영역만 넣고 나머지는 비웁니다. */
const raw = (extra: Record<string, unknown>) => ({ version: 1, ...extra })
const parse = (extra: Record<string, unknown>) => parseData(raw(extra)) as PlannerData

describe('parseData — 남의 파일은 거절', () => {
  it.each([
    ['버전 없음', { hello: 'world' }],
    ['버전 다름', { version: 2, todos: [] }],
    ['null', null],
    ['문자열', 'nope'],
    ['배열', [1, 2, 3]],
  ])('%s', (_name, input) => {
    expect(parseData(input)).toBeNull()
  })
})

describe('parseData — 없던 영역', () => {
  it('예전 데이터에도 모든 영역이 배열로 생긴다', () => {
    const d = parse({})
    expect(Array.isArray(d.mindmaps)).toBe(true)
    expect(Array.isArray(d.mandals)).toBe(true)
    expect(Array.isArray(d.goals)).toBe(true)
    expect(d.timer).toBeUndefined()
  })

  it('배열이 아닌 값이 들어와도 배열로 떨어진다', () => {
    expect(parse({ mindmaps: { nope: true } }).mindmaps).toEqual([])
  })
})

describe('마인드맵 — 한 군데만 깨져도 화면에서 사라지므로 트리로 되돌린다', () => {
  const byId = (nodes: MindNode[], id: string) => nodes.find((n) => n.id === id)!

  /** 모든 노드가 부모를 따라 루트 하나에 닿는가 */
  const isTree = (nodes: MindNode[]) => {
    const map = new Map(nodes.map((n) => [n.id, n]))
    const roots = nodes.filter((n) => !n.parentId)
    if (roots.length !== 1) return false
    for (const node of nodes) {
      const seen = new Set([node.id])
      let cur = node
      while (cur.parentId) {
        const parent = map.get(cur.parentId)
        if (!parent || seen.has(parent.id)) return false
        seen.add(parent.id)
        cur = parent
      }
      if (cur.id !== roots[0].id) return false
    }
    return true
  }

  it('멀쩡한 것은 그대로', () => {
    const [m] = parse({
      mindmaps: [{ id: 'm', title: '공부', nodes: [{ id: 'r', text: 'R', order: 0 }, { id: 'a', text: 'A', parentId: 'r', order: 0 }] }],
    }).mindmaps
    expect(m.title).toBe('공부')
    expect(m.nodes).toHaveLength(2)
    expect(isTree(m.nodes)).toBe(true)
  })

  it('미아 노드는 루트에 붙인다 — 버리지 않습니다', () => {
    const [m] = parse({
      mindmaps: [{ id: 'm', title: 't', nodes: [{ id: 'r', text: 'R', order: 0 }, { id: 'x', text: 'X', parentId: '없는id', order: 0 }] }],
    }).mindmaps
    expect(m.nodes).toHaveLength(2)
    expect(byId(m.nodes, 'x').parentId).toBe('r')
    expect(isTree(m.nodes)).toBe(true)
  })

  it.each([
    ['순환', [{ id: 'r', text: 'R', order: 0 }, { id: 'a', text: 'A', parentId: 'b', order: 0 }, { id: 'b', text: 'B', parentId: 'a', order: 0 }]],
    ['자기가 부모', [{ id: 'r', text: 'R', order: 0 }, { id: 's', text: 'S', parentId: 's', order: 0 }]],
    ['루트 둘', [{ id: 'r1', text: 'R1', order: 0 }, { id: 'r2', text: 'R2', order: 0 }]],
    ['루트 없음', [{ id: 'a', text: 'A', parentId: 'b', order: 0 }, { id: 'b', text: 'B', parentId: 'a', order: 1 }]],
  ])('%s 이어도 트리가 된다', (_name, nodes) => {
    const [m] = parse({ mindmaps: [{ id: 'm', title: 't', nodes }] }).mindmaps
    expect(isTree(m.nodes)).toBe(true)
    expect(m.nodes.length).toBe(nodes.length)
  })

  it('빈 목록이면 제목으로 루트를 만든다', () => {
    const [m] = parse({ mindmaps: [{ id: 'm', title: '새 맵', nodes: [] }] }).mindmaps
    expect(m.nodes).toHaveLength(1)
    expect(m.nodes[0].text).toBe('새 맵')
  })

  it('같은 id 는 먼저 것만 남긴다', () => {
    const [m] = parse({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: '먼저', parentId: 'r', order: 0 },
        { id: 'a', text: '나중', parentId: 'r', order: 1 },
      ] }],
    }).mindmaps
    expect(m.nodes).toHaveLength(2)
    expect(byId(m.nodes, 'a').text).toBe('먼저')
  })

  it('망가진 값이 있어도 앱이 멈추지 않는다', () => {
    const [m] = parse({
      mindmaps: [{ id: 'm', title: 42, nodes: [{ id: 'r', text: null, order: 'abc' }, { text: 'id 없음' }, null, 'string'] }],
    }).mindmaps
    expect(typeof m.title).toBe('string')
    expect(m.nodes).toHaveLength(1) // id 없는 것은 버립니다
    expect(typeof m.nodes[0].text).toBe('string')
    expect(Number.isFinite(m.nodes[0].order)).toBe(true)
  })

  it('옮겨 둔 좌표가 깨졌으면 버린다 — NaN 하나로 그 아래가 화면 밖으로 나갑니다', () => {
    const [m] = parse({
      mindmaps: [{ id: 'm', title: 't', nodes: [
        { id: 'r', text: 'R', order: 0 },
        { id: 'a', text: 'A', parentId: 'r', order: 0, dx: NaN, dy: 'abc' },
        { id: 'b', text: 'B', parentId: 'r', order: 1, dx: Infinity, dy: 20 },
      ] }],
    }).mindmaps
    expect(byId(m.nodes, 'a').dx).toBeUndefined()
    expect(byId(m.nodes, 'a').dy).toBeUndefined()
    expect(byId(m.nodes, 'b').dx).toBeUndefined()
    expect(byId(m.nodes, 'b').dy).toBe(20)
  })
})

describe('만다라트 — 실행 항목이 문자열에서 { text, done } 으로 바뀌었다', () => {
  const full = (make: (i: number, j: number) => unknown) => ({
    id: 'm', title: '2026', core: '핵심',
    subGoals: Array.from({ length: 8 }, (_, i) => `세부 ${i + 1}`),
    actions: Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => make(i, j))),
  })

  it('예전 문자열이 그대로 살아난다', () => {
    const [m] = parse({ mandals: [full((i, j) => `실행 ${i + 1}-${j + 1}`)] }).mandals
    expect(m.actions[2][5].text).toBe('실행 3-6')
    expect(m.actions.flat().every((a) => a.done === false)).toBe(true)
    expect(m.subGoals[3]).toBe('세부 4')
  })

  it('새 형식은 done 을 지킨다', () => {
    const [m] = parse({ mandals: [full((i, j) => ({ text: `a${i}${j}`, done: i === 0 && j < 3 }))] }).mandals
    expect(m.actions[0].filter((a) => a.done)).toHaveLength(3)
    expect(m.actions[1].every((a) => !a.done)).toBe(true)
  })

  it('칸 수가 모자라거나 망가져도 8×8 로 채운다', () => {
    const [m] = parse({
      mandals: [{ id: 'm', title: 't', subGoals: ['하나'], actions: [[null, 'string', { text: 42, done: 'yes' }], 'not-an-array'] }],
    }).mandals
    expect(m.actions).toHaveLength(8)
    expect(m.actions.every((row) => row.length === 8)).toBe(true)
    expect(m.actions.flat().every((a) => typeof a.text === 'string' && typeof a.done === 'boolean')).toBe(true)
    expect(m.actions[0][1].text).toBe('string')
    expect(m.actions[0][2].text).toBe('') // 숫자는 글이 아닙니다
    expect(m.actions[0][2].done).toBe(false) // 'yes' 는 true 가 아닙니다
    expect(m.subGoals).toHaveLength(8)
  })
})

describe('타이머 — 멈출 수도 기록할 수도 없는 것은 버린다', () => {
  const subjects = [{ id: 's1', name: '수학', tag: 'blue', weeklyGoalMin: 600 }]

  it('돌던 타이머는 새로고침해도 이어진다', () => {
    const startedAt = Date.now() - 5 * 60_000
    const d = parse({ subjects, timer: { subjectId: 's1', startedAt } })
    expect(d.timer).toEqual({ subjectId: 's1', startedAt })
  })

  it.each([
    ['과목이 없음', { subjectId: '없는과목', startedAt: 1000 }],
    ['시작 시각 없음', { subjectId: 's1' }],
    ['NaN', { subjectId: 's1', startedAt: NaN }],
    ['문자열', { subjectId: 's1', startedAt: '어제' }],
    ['미래에서 시작', { subjectId: 's1', startedAt: Date.now() + 600_000 }],
    ['0 이하', { subjectId: 's1', startedAt: 0 }],
    ['객체가 아님', 'timer'],
    ['null', null],
  ])('%s 이면 버린다', (_name, timer) => {
    expect(parse({ subjects, timer }).timer).toBeUndefined()
  })
})

describe('백업 왕복 — 내보낸 그대로 돌아와야 한다', () => {
  it('모든 영역이 살아남는다', () => {
    const rich = raw({
      events: [{ id: 'e1', date: '2026-07-30', title: '회의', start: '10:00', tag: 'blue' }],
      todos: [{ id: 't1', date: '2026-07-30', title: '할 일', done: false, order: 0 }],
      notes: { '2026-07-30': '메모' },
      goals: [{ id: 'g1', title: '목표', status: 'active', tag: 'mint', order: 0, steps: [{ id: 's1', title: '단계', done: false }] }],
      mandals: [{ id: 'm1', title: '만다라트', core: '핵심', subGoals: Array(8).fill(''), actions: Array.from({ length: 8 }, () => Array(8).fill('')) }],
      mindmaps: [{ id: 'mm1', title: '맵', nodes: [{ id: 'r', text: '루트', order: 0 }] }],
      settings: { accent: '#2b9a66', weekStart: 0, hour12: true },
    })

    // 내보내기가 하는 일 그대로
    const back = parseData(JSON.parse(JSON.stringify(rich)))!

    expect(back.events[0].title).toBe('회의')
    expect(back.todos).toHaveLength(1)
    expect(back.notes['2026-07-30']).toBe('메모')
    expect(back.goals[0].steps).toHaveLength(1)
    expect(back.mandals[0].actions).toHaveLength(8)
    expect(back.mindmaps[0].nodes).toHaveLength(1)
    expect(back.settings).toEqual({ accent: '#2b9a66', weekStart: 0, hour12: true })
  })
})
