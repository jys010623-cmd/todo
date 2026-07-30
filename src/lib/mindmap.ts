import type { MindMap, MindNode } from '@/types'

/**
 * 마인드맵 자동 배치.
 *
 * 노드는 HTML 로 그리고 가지만 SVG 로 그립니다. 그래서 이 파일은 좌표만 계산하고,
 * 실제 크기(줄바꿈된 높이)는 화면에서 재서 넘겨받습니다 — 한글은 글자 폭이 일정하지
 * 않아 글자 수로 높이를 추정하면 한 줄씩 어긋나서 가지가 엉뚱한 데 붙습니다.
 */

/**
 * 노드 폭은 고정입니다. 폭까지 내용에 맞추면 열이 들쭉날쭉해져 트리로 안 읽힙니다.
 * 168px 은 한글 열 몇 자에서 줄이 바뀌어 답답했습니다 — 한 줄에 더 담기게 넓혔습니다.
 */
export const NODE_W = 224

/** 열 사이 — 가지가 휘어질 공간 */
const H_GAP = 60

/** 형제 사이 */
const V_GAP = 12

/** 아직 재기 전의 노드에 쓰는 값. 한 줄짜리 노드의 높이입니다. */
const FALLBACK_H = 40

export type Side = 'left' | 'right'

export interface PlacedNode {
  node: MindNode
  x: number
  y: number
  w: number
  h: number
  /** 루트는 0 */
  depth: number
  side: Side
  /** 접기 버튼을 그릴지 — 자식이 있을 때만 */
  childCount: number
  /** 색을 맞추려고 물려받는, 루트 바로 아래 갈래의 순번. 루트는 -1. */
  branch: number
}

export interface MindEdge {
  id: string
  /** 부모에서 자식으로 휘어지는 3차 베지에 */
  path: string
  side: Side
  /** 가지 색을 위해 — 루트 바로 아래 가지의 순번 */
  branch: number
}

export interface MindLayout {
  nodes: PlacedNode[]
  edges: MindEdge[]
  width: number
  height: number
  /** 루트가 없으면(빈 맵) null */
  rootId: string | null
}

/** 부모 id → 자식들 (order 순) */
function childrenByParent(nodes: MindNode[]): Map<string, MindNode[]> {
  const map = new Map<string, MindNode[]>()
  for (const n of nodes) {
    if (!n.parentId) continue
    const list = map.get(n.parentId)
    if (list) list.push(n)
    else map.set(n.parentId, [n])
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order)
  return map
}

export function findRoot(nodes: MindNode[]): MindNode | undefined {
  return nodes.find((n) => !n.parentId)
}

/** 접힌 노드 아래로는 내려가지 않습니다 — 안 그리는 것을 배치할 필요가 없습니다. */
function visibleChildren(
  node: MindNode,
  kids: Map<string, MindNode[]>,
): MindNode[] {
  if (node.collapsed) return []
  return kids.get(node.id) ?? []
}

export function layoutMindMap(
  map: MindMap,
  heights: Record<string, number>,
): MindLayout {
  const root = findRoot(map.nodes)
  if (!root) return { nodes: [], edges: [], width: 0, height: 0, rootId: null }

  const kids = childrenByParent(map.nodes)
  const ownH = (n: MindNode) => heights[n.id] ?? FALLBACK_H

  /** 자기 자신과 펼쳐진 자손이 세로로 차지하는 높이 */
  const spanCache = new Map<string, number>()
  function span(node: MindNode): number {
    const cached = spanCache.get(node.id)
    if (cached !== undefined) return cached

    const list = visibleChildren(node, kids)
    let value = ownH(node)
    if (list.length > 0) {
      const stacked =
        list.reduce((total, c) => total + span(c), 0) + V_GAP * (list.length - 1)
      // 자식 묶음보다 자기가 더 클 수도 있습니다(긴 글이 잎 하나를 거느릴 때).
      value = Math.max(value, stacked)
    }
    spanCache.set(node.id, value)
    return value
  }

  const placed: PlacedNode[] = []

  /**
   * top 에서 아래로 자식들을 쌓고, 자신은 첫 자식과 마지막 자식의 가운데에 둡니다.
   * 자식이 없으면 그냥 top 에 놓습니다. 반환값은 자기 중심의 y 입니다.
   */
  function place(node: MindNode, depth: number, top: number, side: Side): number {
    const list = visibleChildren(node, kids)
    const h = ownH(node)

    if (list.length === 0) {
      placed.push({
        node,
        x: 0,
        y: top,
        w: NODE_W,
        h,
        depth,
        side,
        childCount: (kids.get(node.id) ?? []).length,
        branch: 0,
      })
      return top + h / 2
    }

    let cursor = top
    let first = 0
    let last = 0
    list.forEach((child, i) => {
      const cy = place(child, depth + 1, cursor, side)
      if (i === 0) first = cy
      if (i === list.length - 1) last = cy
      cursor += span(child) + V_GAP
    })

    const cy = (first + last) / 2
    placed.push({
      node,
      x: 0,
      y: cy - h / 2,
      w: NODE_W,
      h,
      depth,
      side,
      childCount: list.length,
      branch: 0,
    })
    return cy
  }

  // 루트의 자식은 좌우로 번갈아 나눕니다 — 한쪽으로만 뻗으면 가로로 길어져
  // 화면에 들어오지 않고, 마인드맵보다 조직도처럼 보입니다.
  const topLevel = root.collapsed ? [] : (kids.get(root.id) ?? [])
  const right = topLevel.filter((_, i) => i % 2 === 0)
  const left = topLevel.filter((_, i) => i % 2 === 1)

  const sideTotal = (list: MindNode[]) =>
    list.length === 0
      ? 0
      : list.reduce((total, n) => total + span(n), 0) + V_GAP * (list.length - 1)

  const rightTotal = sideTotal(right)
  const leftTotal = sideTotal(left)
  const tallest = Math.max(rightTotal, leftTotal, ownH(root))

  /** 양쪽 가운데를 맞춰야 루트가 한가운데에 옵니다. */
  const runSide = (list: MindNode[], side: Side) => {
    let cursor = (tallest - sideTotal(list)) / 2
    for (const n of list) {
      place(n, 1, cursor, side)
      cursor += span(n) + V_GAP
    }
  }
  runSide(right, 'right')
  runSide(left, 'left')

  const rootH = ownH(root)
  const rootY = tallest / 2 - rootH / 2
  placed.push({
    node: root,
    x: 0,
    y: rootY,
    w: NODE_W,
    h: rootH,
    depth: 0,
    side: 'right',
    childCount: (kids.get(root.id) ?? []).length,
    branch: -1,
  })

  // ── x 는 깊이로만 정해집니다. 왼쪽은 같은 간격으로 반대편에 놓습니다.
  const step = NODE_W + H_GAP
  const depthOf = (side: Side) =>
    placed.reduce((max, p) => (p.side === side && p.depth > max ? p.depth : max), 0)
  // 루트는 side 가 'right' 라 왼쪽 최대 깊이에는 잡히지 않습니다.
  const leftDepth = left.length > 0 ? depthOf('left') : 0

  const rootX = leftDepth * step
  for (const p of placed) {
    p.x = p.node.id === root.id ? rootX : rootX + (p.side === 'right' ? p.depth : -p.depth) * step
  }

  const byId = new Map(placed.map((p) => [p.node.id, p]))

  /**
   * 손으로 옮긴 만큼을 얹습니다.
   * 위에서 아래로 훑으며 조상의 이동을 더해 가므로, 가지를 끌면 그 아래가 함께 갑니다.
   */
  const walk = (node: MindNode, ox: number, oy: number) => {
    const x = ox + (node.dx ?? 0)
    const y = oy + (node.dy ?? 0)
    const p = byId.get(node.id)
    if (p) {
      p.x += x
      p.y += y
    }
    for (const child of visibleChildren(node, kids)) walk(child, x, y)
  }
  walk(root, 0, 0)

  /*
   * 자식이 자기보다 큰 노드는 위로 삐져나가고, 손으로 옮기면 왼쪽으로도 나갑니다.
   * 가지를 긋기 전에 전체를 0 안쪽으로 끌어들입니다.
   */
  const minX = placed.reduce((min, p) => Math.min(min, p.x), 0)
  const minY = placed.reduce((min, p) => Math.min(min, p.y), 0)
  if (minX < 0 || minY < 0) {
    for (const p of placed) {
      p.x -= minX
      p.y -= minY
    }
  }

  /**
   * 루트 바로 아래 갈래마다 색을 달리하려고, 자손에게 조상의 순번을 물려줍니다.
   * placed 의 순서는 부모가 먼저라는 보장이 없어서, 위에서 아래로 따로 훑습니다.
   */
  const branchOf = new Map<string, number>()
  topLevel.forEach((top, i) => {
    const stack = [top]
    while (stack.length > 0) {
      const n = stack.pop() as MindNode
      branchOf.set(n.id, i)
      const p = byId.get(n.id)
      if (p) p.branch = i
      stack.push(...visibleChildren(n, kids))
    }
  })

  // ── 가지. 부모의 바깥쪽 모서리에서 자식의 안쪽 모서리로 잇습니다.
  const edges: MindEdge[] = []
  for (const p of placed) {
    const parentId = p.node.parentId
    if (!parentId) continue
    const parent = byId.get(parentId)
    if (!parent) continue

    /*
     * 손으로 옮기면 자식이 부모보다 왼쪽에 놓일 수도 있습니다.
     * 자리에 상관없이 가까운 쪽 모서리끼리 잇도록, 실제 좌표를 보고 방향을 정합니다.
     */
    const rightward = p.x >= parent.x
    const x1 = rightward ? parent.x + parent.w : parent.x
    const y1 = parent.y + parent.h / 2
    const x2 = rightward ? p.x : p.x + p.w
    const y2 = p.y + p.h / 2
    const dx = (x2 - x1) / 2

    edges.push({
      id: p.node.id,
      path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      side: p.side,
      branch: branchOf.get(p.node.id) ?? 0,
    })
  }

  // 손으로 옮긴 노드가 오른쪽·아래로 나갈 수 있어, 실제 상자에서 판 크기를 구합니다.
  const height = placed.reduce((max, p) => Math.max(max, p.y + p.h), 0)
  const width = placed.reduce((max, p) => Math.max(max, p.x + p.w), 0)

  // 가지가 노드 뒤에서부터 그려지도록 깊이 순으로 정렬해 둡니다.
  placed.sort((a, b) => a.depth - b.depth)

  return { nodes: placed, edges, width, height, rootId: root.id }
}

/** 노드와 그 자손 전부 — 지울 때 씁니다. */
export function descendantIds(nodes: MindNode[], id: string): string[] {
  const kids = childrenByParent(nodes)
  const out: string[] = []
  const walk = (current: string) => {
    for (const child of kids.get(current) ?? []) {
      out.push(child.id)
      walk(child.id)
    }
  }
  walk(id)
  return out
}
