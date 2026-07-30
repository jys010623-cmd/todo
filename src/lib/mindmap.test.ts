import { describe, expect, it } from 'vitest'

import type { MindMap, MindNode } from '@/types'
import { NODE_W, descendantIds, findRoot, layoutMindMap, type MindLayout } from './mindmap'

const n = (
  id: string,
  text: string,
  parentId?: string,
  order = 0,
  extra: Partial<MindNode> = {},
): MindNode => ({ id, text, parentId, order, ...extra })

/** 루트 - a(- a1, a2), b */
const tree = (): MindNode[] => [
  n('r', '핵심'),
  n('a', 'A', 'r', 0),
  n('b', 'B', 'r', 1),
  n('a1', 'A1', 'a', 0),
  n('a2', 'A2', 'a', 1),
]
const H = { r: 40, a: 40, b: 40, a1: 40, a2: 40 }
const map = (nodes: MindNode[]): MindMap => ({ id: 'm', title: 't', nodes })
const at = (L: MindLayout, id: string) => L.nodes.find((p) => p.node.id === id)!

describe('findRoot', () => {
  it('부모 없는 노드가 루트', () => {
    expect(findRoot(tree())?.id).toBe('r')
  })

  it('없으면 undefined', () => {
    expect(findRoot([n('a', 'A', 'r')])).toBeUndefined()
  })
})

describe('layoutMindMap — 기본 배치', () => {
  it('루트만 있으면 노드 하나, 가지 없음', () => {
    const L = layoutMindMap(map([n('r', '핵심')]), {})
    expect(L.rootId).toBe('r')
    expect(L.nodes).toHaveLength(1)
    expect(L.edges).toHaveLength(0)
    expect(L.width).toBe(NODE_W)
    expect(L.nodes[0].x).toBe(0)
  })

  it('루트가 없으면 빈 배치 — 그리기가 멈추지 않습니다', () => {
    const L = layoutMindMap(map([n('a', 'A', '없는부모')]), {})
    expect(L.rootId).toBeNull()
    expect(L.nodes).toHaveLength(0)
    expect(L.edges).toHaveLength(0)
  })

  it('루트의 자식은 좌우로 번갈아 놓인다', () => {
    const nodes = [n('r', '핵심'), ...['a', 'b', 'c', 'd'].map((id, i) => n(id, id, 'r', i))]
    const L = layoutMindMap(map(nodes), {})
    expect(at(L, 'a').side).toBe('right')
    expect(at(L, 'b').side).toBe('left')
    expect(at(L, 'c').side).toBe('right')
    expect(at(L, 'd').side).toBe('left')
  })

  it('좌우가 루트에서 같은 거리에 놓인다', () => {
    const nodes = [n('r', '핵심'), n('a', 'A', 'r', 0), n('b', 'B', 'r', 1)]
    const L = layoutMindMap(map(nodes), {})
    const root = at(L, 'r')
    expect(at(L, 'a').x - root.x).toBe(root.x - at(L, 'b').x)
  })

  it('부모는 자식 묶음의 가운데에 온다', () => {
    const nodes = [n('r', '핵심'), n('a', 'A', 'r', 0), ...[0, 1, 2].map((i) => n(`c${i}`, `C${i}`, 'a', i))]
    const L = layoutMindMap(map(nodes), {})
    const cy = (id: string) => at(L, id).y + at(L, id).h / 2
    expect(cy('a')).toBeCloseTo((cy('c0') + cy('c2')) / 2, 5)
    expect(cy('c1')).toBeCloseTo(cy('a'), 5)
  })

  it('형제끼리 겹치지 않는다', () => {
    const nodes = [n('r', '핵심'), ...Array.from({ length: 6 }, (_, i) => n(`k${i}`, `K${i}`, 'r', i))]
    const heights: Record<string, number> = { r: 40 }
    nodes.forEach((x) => (heights[x.id] = x.id === 'k0' ? 80 : 34))
    const L = layoutMindMap(map(nodes), heights)

    for (const side of ['left', 'right'] as const) {
      const list = L.nodes.filter((p) => p.side === side && p.depth === 1).sort((a, b) => a.y - b.y)
      for (let i = 1; i < list.length; i++) {
        expect(list[i].y).toBeGreaterThanOrEqual(list[i - 1].y + list[i - 1].h - 0.01)
      }
    }
  })

  it('접힌 노드의 자식은 그리지 않지만 개수는 안다', () => {
    const nodes = tree().map((x) => (x.id === 'a' ? { ...x, collapsed: true } : x))
    const L = layoutMindMap(map(nodes), H)
    const ids = L.nodes.map((p) => p.node.id)
    expect(ids).not.toContain('a1')
    expect(ids).not.toContain('a2')
    expect(at(L, 'a').childCount).toBe(2)
    expect(L.edges).toHaveLength(2) // a, b 만
  })

  it('열 간격이 일정하고 노드가 겹치지 않는다', () => {
    const nodes = [n('r', '핵심'), n('a', 'A', 'r', 0), n('b', 'B', 'a', 0), n('c', 'C', 'b', 0)]
    const L = layoutMindMap(map(nodes), {})
    const step = at(L, 'a').x - at(L, 'r').x
    expect(at(L, 'b').x - at(L, 'a').x).toBe(step)
    expect(at(L, 'c').x - at(L, 'b').x).toBe(step)
    expect(step).toBeGreaterThanOrEqual(NODE_W)
    expect(at(L, 'c').depth).toBe(3)
  })
})

describe('layoutMindMap — 손으로 옮긴 자리', () => {
  it('옮긴 만큼만 움직인다', () => {
    const base = layoutMindMap(map(tree()), H)
    const moved = tree().map((x) => (x.id === 'b' ? { ...x, dx: 40, dy: 25 } : x))
    const L = layoutMindMap(map(moved), H)

    expect(at(L, 'b').x - at(base, 'b').x).toBe(40)
    expect(at(L, 'b').y - at(base, 'b').y).toBe(25)
    expect(at(L, 'a').x).toBe(at(base, 'a').x)
    expect(at(L, 'a').y).toBe(at(base, 'a').y)
  })

  it('가지를 끌면 자손이 따라온다', () => {
    const base = layoutMindMap(map(tree()), H)
    const moved = tree().map((x) => (x.id === 'a' ? { ...x, dx: -60, dy: 30 } : x))
    const L = layoutMindMap(map(moved), H)
    // 왼쪽으로 나가면 전체가 밀리므로 루트와의 거리로 봅니다.
    const rel = (L2: MindLayout, id: string) => ({
      x: at(L2, id).x - at(L2, 'r').x,
      y: at(L2, id).y - at(L2, 'r').y,
    })
    for (const id of ['a', 'a1', 'a2']) {
      expect(rel(L, id).x - rel(base, id).x).toBe(-60)
      expect(rel(L, id).y - rel(base, id).y).toBe(30)
    }
    expect(rel(L, 'b')).toEqual(rel(base, 'b'))
  })

  it('자식은 조상의 이동에 자기 것을 더한다', () => {
    const base = layoutMindMap(map(tree()), H)
    const moved = tree().map((x) =>
      x.id === 'a' ? { ...x, dx: 20 } : x.id === 'a1' ? { ...x, dx: 15 } : x,
    )
    const L = layoutMindMap(map(moved), H)
    const rel = (L2: MindLayout, id: string) => at(L2, id).x - at(L2, 'r').x
    expect(rel(L, 'a1') - rel(base, 'a1')).toBe(35)
    expect(rel(L, 'a2') - rel(base, 'a2')).toBe(20)
  })

  it('아무리 멀리 옮겨도 판 안에 담긴다', () => {
    for (const [dx, dy] of [[-900, -700], [900, 700], [0, -500]]) {
      const moved = tree().map((x) => (x.id === 'b' ? { ...x, dx, dy } : x))
      const L = layoutMindMap(map(moved), H)
      for (const p of L.nodes) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01)
        expect(p.y).toBeGreaterThanOrEqual(-0.01)
        expect(p.x + p.w).toBeLessThanOrEqual(L.width + 0.01)
        expect(p.y + p.h).toBeLessThanOrEqual(L.height + 0.01)
      }
    }
  })

  it('부모 왼쪽으로 끌면 가지가 가까운 모서리끼리 이어진다', () => {
    const moved = tree().map((x) => (x.id === 'a' ? { ...x, dx: -800 } : x))
    const L = layoutMindMap(map(moved), H)
    const a = at(L, 'a')
    const root = at(L, 'r')
    expect(a.x).toBeLessThan(root.x)

    const path = L.edges.find((e) => e.id === 'a')!.path
    const startX = Number(path.split(' ')[1])
    const endX = Number(path.split(',').pop()!.trim().split(' ')[0])
    expect(startX).toBeCloseTo(root.x, 5) // 루트의 왼쪽 모서리
    expect(endX).toBeCloseTo(a.x + a.w, 5) // a 의 오른쪽 모서리
  })
})

describe('descendantIds', () => {
  it('자손을 모두 모은다', () => {
    const nodes = [...tree(), n('a11', 'A11', 'a1', 0)]
    expect(descendantIds(nodes, 'a').sort()).toEqual(['a1', 'a11', 'a2'])
  })

  it('잎은 자손이 없다', () => {
    expect(descendantIds(tree(), 'b')).toEqual([])
  })
})
