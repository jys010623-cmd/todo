import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { PageHeader } from '@/components/layout/PageHeader'
import { todayISO } from '@/lib/date'
import { NODE_W, descendantIds, layoutMindMap, type PlacedNode } from '@/lib/mindmap'
import { MAX_MIND_H, MIN_MIND_H } from '@/lib/storage'
import { uid } from '@/lib/id'
import { usePlanner } from '@/store/PlannerContext'
import { TAG_COLORS, type MindNode } from '@/types'
import styles from './MindMapView.module.css'

/*
 * 배율의 위아래.
 * 아래를 0.35 까지 연 것은 가지가 많은 판을 통째로 담아야 해서입니다 —
 * 그보다 줄이면 글자가 읽히지 않아 담아도 소용이 없습니다.
 */
const MIN_ZOOM = 0.35
const MAX_ZOOM = 1.6

const clampPane = (h: number) => Math.round(Math.min(MAX_MIND_H, Math.max(MIN_MIND_H, h)))

/** 가지마다 색을 돌려 씁니다 — 같은 색이 이웃하지만 않으면 갈래가 구분됩니다. */
function branchTag(branch: number) {
  return TAG_COLORS[branch % TAG_COLORS.length]
}

export function MindMapView() {
  const { data, dispatch } = usePlanner()
  const { mindmaps } = data

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const current = mindmaps.find((m) => m.id === selectedId) ?? mindmaps[0] ?? null

  useEffect(() => {
    if (mindmaps.length === 0) setSelectedId(null)
    else if (!mindmaps.some((m) => m.id === selectedId)) setSelectedId(mindmaps[0].id)
  }, [mindmaps, selectedId])

  /**
   * 노드 높이는 글이 몇 줄로 접히는지에 달려 있어 미리 알 수 없습니다.
   * 그려 놓고 재서 다시 배치합니다 — 첫 프레임은 기본 높이로 잡히고 곧바로 맞춰집니다.
   */
  const [heights, setHeights] = useState<Record<string, number>>({})
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())

  /**
   * 끄는 동안의 자리. 매 움직임마다 dispatch 하면 저장까지 따라와 판이 버벅입니다.
   * 손을 뗄 때 한 번만 넘기고, 그전까지는 여기서 그립니다.
   */
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)

  /** 지금 손에 든 노드를 떨어뜨리면 부모가 될 노드 */
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  /** 끄는 중인 노드만 살아 있는 값으로 갈아 끼워 배치에 넘깁니다. */
  const live = useMemo(() => {
    if (!current || !drag) return current
    return {
      ...current,
      nodes: current.nodes.map((n) =>
        n.id === drag.id ? { ...n, dx: drag.dx, dy: drag.dy } : n,
      ),
    }
  }, [current, drag])

  const layout = useMemo(() => (live ? layoutMindMap(live, heights) : null), [live, heights])

  useLayoutEffect(() => {
    if (!current) return
    const measured: Record<string, number> = {}
    for (const node of current.nodes) {
      const el = nodeRefs.current.get(node.id)
      if (el) measured[node.id] = el.offsetHeight
    }
    // 같은 값을 다시 넣으면 렌더가 끝없이 돕니다.
    const changed =
      Object.keys(measured).length !== Object.keys(heights).length ||
      Object.entries(measured).some(([id, h]) => heights[id] !== h)
    if (changed) setHeights(measured)
  }, [current, heights])

  /** 방금 만든 노드를 바로 고칠 수 있도록, 추가 입력을 연 노드를 기억합니다. */
  const [addingTo, setAddingTo] = useState<string | null>(null)

  /**
   * 판이 담기는 자리의 폭. 여기에 맞춰 처음 배율을 정합니다.
   * 창을 줄이면 따라 좁아지므로 계속 지켜봅니다.
   */
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setPane({ w: entry.contentRect.width, h: entry.contentRect.height }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [current?.id])

  /**
   * 판의 높이. 내용이 아니라 사람이 정합니다.
   *
   * 예전에는 높이를 안 정해 두고 내용만큼 자라게 뒀습니다. 그러면 가지를 하나 펼칠
   * 때마다 판이 자라 아래 글이 밀려 내려가고, 접으면 다시 올라옵니다 — 읽던 자리가
   * 계속 움직입니다. 이제 아래 손잡이를 끌어 정하고, 그 값은 기억해 둡니다.
   *
   * 끄는 동안은 여기서 그립니다. 매 움직임마다 저장까지 부르면 판이 버벅입니다.
   */
  const [dragH, setDragH] = useState<number | null>(null)
  const paneH = dragH ?? data.settings.mindHeight
  /** 끌기 시작한 순간의 높이와 손 위치 — 여기서부터 재야 커서와 판이 어긋나지 않습니다. */
  const gripFrom = useRef<{ from: number; y0: number } | null>(null)

  /**
   * 판 전체를 키우고 줄입니다.
   * 노드 높이는 offsetHeight 로 재는데 이 값은 transform 의 영향을 받지 않아,
   * 확대해도 배치 계산은 그대로입니다.
   */
  const [userZoom, setUserZoom] = useState<number | null>(null)

  /**
   * 아무것도 안 고른 상태의 배율 — 판이 자리에 들어오는 만큼입니다.
   *
   * 마인드맵은 가지가 좌우로 뻗어 금세 화면보다 넓어집니다. 100% 로 시작하면 열자마자
   * 오른쪽 가지가 잘린 채 뜨고, 스크롤바를 없앤 뒤로는 밀 수 있다는 것조차 안 보입니다 —
   * 판을 여는 목적이 '한눈에 보기' 인데 그게 안 됩니다.
   *
   * 넓힐 때는 쓰지 않습니다(1 이 천장). 좁은 판을 늘려 놓으면 글자만 커지고
   * 남는 자리는 그대로라, 보기 좋아지지 않습니다.
   *
   * 세로도 함께 봅니다 — 판 높이를 사람이 정하게 된 뒤로는 가로만 맞추면 아래가
   * 잘립니다. 판을 끌어 키우면 지도도 그만큼 커집니다.
   */
  const fit = useMemo(() => {
    if (!layout || !pane.w || !pane.h || !layout.width || !layout.height) return 1
    const by = Math.min(pane.w / layout.width, pane.h / layout.height)
    if (by >= 1) return 1
    return Math.max(MIN_ZOOM, Math.floor(by * 100) / 100)
  }, [layout, pane])

  const zoom = userZoom ?? fit
  const step = (d: number) =>
    setUserZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((zoom + d) * 10) / 10)))

  // 다른 판으로 옮기면 배율도 그 판에 맞게 다시 잡습니다.
  useEffect(() => setUserZoom(null), [current?.id])

  const hasMoved = current?.nodes.some((n) => n.dx || n.dy) ?? false

  /**
   * 손 아래에 어떤 노드가 있는지 좌표로 찾습니다.
   *
   * elementFromPoint 는 끌고 있는 노드가 늘 손 밑에 있어 자기 자신만 잡힙니다.
   * 배치가 이미 모든 상자를 알고 있으니 그걸로 셈합니다.
   * 자기 자신과 제 자손은 뺍니다 — 거기로 들어가면 트리가 고리가 됩니다.
   */
  const dropTargetAt = (clientX: number, clientY: number, draggedId: string): string | null => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !layout || !current) return null

    const x = (clientX - rect.left) / zoom
    const y = (clientY - rect.top) / zoom
    const banned = new Set([draggedId, ...descendantIds(current.nodes, draggedId)])

    const hit = layout.nodes.find(
      (p) =>
        !banned.has(p.node.id) &&
        x >= p.x &&
        x <= p.x + p.w &&
        y >= p.y &&
        y <= p.y + p.h,
    )
    return hit?.node.id ?? null
  }

  /*
   * 글을 고치는 자리는 뷰가 들고 있습니다.
   * 노드 안에 가둬 두면 Enter·Tab 으로 다음 노드를 만들고 그리로 옮겨 갈 수 없습니다.
   */
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)

  const openEdit = (node: MindNode) => setEditing({ id: node.id, draft: node.text })

  /** 적은 것을 반영하고, 빈 채로 둔 새 노드는 치웁니다. */
  const closeEdit = () => {
    if (!current || !editing) return
    const node = current.nodes.find((n) => n.id === editing.id)
    setEditing(null)
    if (!node) return

    const text = editing.draft.trim()

    /*
     * 빈 노드를 남기면 판에 '…' 만 떠 있게 됩니다.
     * 이 검사가 '안 바뀜' 보다 먼저여야 합니다 — 갓 만든 노드는 적은 것도 원래 글도
     * 둘 다 빈 문자열이라, 뒤에 두면 걸러져서 영영 치워지지 않습니다.
     * 루트와 자식을 거느린 노드는 지우면 아래가 통째로 사라지므로 그대로 둡니다.
     */
    if (!text && node.parentId && !current.nodes.some((n) => n.parentId === node.id)) {
      dispatch({ type: 'DELETE_MIND_NODE', mapId: current.id, nodeId: node.id })
      return
    }

    if (!text || text === node.text) return
    dispatch({ type: 'UPDATE_MIND_NODE', mapId: current.id, nodeId: node.id, patch: { text } })
  }

  /**
   * 적은 것을 반영하고 다음 노드를 만들어 그리로 넘어갑니다.
   * id 를 여기서 지어 넘겨야 방금 만든 노드로 곧바로 옮겨 갈 수 있습니다.
   */
  const editNext = (node: MindNode, kind: 'sibling' | 'child') => {
    if (!current) return
    const text = editing?.draft.trim() ?? ''
    if (text && text !== node.text) {
      dispatch({ type: 'UPDATE_MIND_NODE', mapId: current.id, nodeId: node.id, patch: { text } })
    }

    // 루트는 형제를 가질 수 없습니다 — 자식으로 받습니다.
    const asChild = kind === 'child' || !node.parentId
    const parentId = asChild ? node.id : (node.parentId as string)
    const id = uid('mn')

    dispatch({
      type: 'ADD_MIND_NODE',
      mapId: current.id,
      parentId,
      text: '',
      id,
      afterId: asChild ? undefined : node.id,
    })
    setEditing({ id, draft: '' })
  }

  /** 보낸 것은 다른 화면으로 가 버려, 눌렀는데 아무 일도 없어 보이지 않게 한 줄 남깁니다. */
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => {
    if (!sent) return
    const timer = window.setTimeout(() => setSent(null), 4000)
    return () => window.clearTimeout(timer)
  }, [sent])

  const nodeCount = current ? current.nodes.length : 0

  return (
    <div className={styles.scroll}>
      <PageHeader
        title="마인드맵"
        subtitle={
          current ? `노드 ${nodeCount}개` : '가운데 하나에서 생각을 가지처럼 펼칩니다'
        }
      >
        {hasMoved && (
          <button
            type="button"
            className={styles.reset}
            onClick={() => dispatch({ type: 'RESET_MIND_LAYOUT', mapId: current!.id })}
          >
            자동 배치로
          </button>
        )}

        {current && (
          <div className={styles.zoom}>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label="축소"
              onClick={() => step(-0.2)}
            >
              −
            </button>
            {/* 눌러서 돌아가는 곳이 100% 가 아니라 '자리에 맞는 크기' 입니다. */}
            <button
              type="button"
              className={styles.zoomLevel}
              aria-label="화면에 맞추기"
              onClick={() => setUserZoom(null)}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label="확대"
              onClick={() => step(0.2)}
            >
              +
            </button>
          </div>
        )}

        {mindmaps.length > 1 && (
          <select
            className={styles.picker}
            aria-label="마인드맵 선택"
            value={current?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {mindmaps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      <div className={styles.body}>
        {current && layout ? (
          <>
            <div className={styles.titleRow}>
              <InlineEdit
                value={current.title}
                label={current.title}
                className={styles.title}
                onCommit={(title) =>
                  dispatch({ type: 'UPDATE_MINDMAP', id: current.id, patch: { title } })
                }
              />
              {/* 판 하나가 통째로 사라지는 자리입니다 — 두 번 눌러야 지워집니다. */}
              <ConfirmDelete
                label={`${current.title} 마인드맵`}
                className={styles.remove}
                onDelete={() => dispatch({ type: 'DELETE_MINDMAP', id: current.id })}
              />
            </div>

            <div
              ref={scrollRef}
              className={styles.canvasScroll}
              style={paneH ? { height: paneH } : undefined}
            >
              {/* 늘어난 판이 차지할 자리는 바깥이 맡습니다 — 안쪽은 원래 좌표 그대로. */}
              <div
                className={styles.sizer}
                style={{ width: layout.width * zoom, height: layout.height * zoom }}
              >
              <div
                ref={canvasRef}
                className={styles.canvas}
                style={{
                  width: layout.width,
                  height: layout.height,
                  transform: zoom === 1 ? undefined : `scale(${zoom})`,
                }}
                role="tree"
                aria-label={`${current.title} 마인드맵`}
              >
                <svg
                  className={styles.wires}
                  width={layout.width}
                  height={layout.height}
                  aria-hidden="true"
                >
                  {layout.edges.map((edge) => (
                    <path
                      key={edge.id}
                      d={edge.path}
                      className={styles.wire}
                      data-tag={branchTag(edge.branch)}
                    />
                  ))}
                </svg>

                {layout.nodes.map((placed) => (
                  <Node
                    key={placed.node.id}
                    placed={placed}
                    isRoot={placed.node.id === layout.rootId}
                    adding={addingTo === placed.node.id}
                    onAddingChange={(open) => setAddingTo(open ? placed.node.id : null)}
                    registerRef={(el) => {
                      if (el) nodeRefs.current.set(placed.node.id, el)
                      else nodeRefs.current.delete(placed.node.id)
                    }}
                    onAddChild={(text) =>
                      dispatch({
                        type: 'ADD_MIND_NODE',
                        mapId: current.id,
                        parentId: placed.node.id,
                        text,
                      })
                    }
                    onDelete={() =>
                      dispatch({
                        type: 'DELETE_MIND_NODE',
                        mapId: current.id,
                        nodeId: placed.node.id,
                      })
                    }
                    onToggle={() =>
                      dispatch({
                        type: 'TOGGLE_MIND_NODE',
                        mapId: current.id,
                        nodeId: placed.node.id,
                      })
                    }
                    editing={editing?.id === placed.node.id ? editing.draft : null}
                    onEditStart={() => openEdit(placed.node)}
                    onEditChange={(draft) => setEditing({ id: placed.node.id, draft })}
                    onEditEnd={closeEdit}
                    onEditNext={(kind) => editNext(placed.node, kind)}
                    zoom={zoom}
                    isDropTarget={dropTarget === placed.node.id}
                    onDragMove={(dx, dy, clientX, clientY) => {
                      setDrag({ id: placed.node.id, dx, dy })
                      setDropTarget(dropTargetAt(clientX, clientY, placed.node.id))
                    }}
                    onDragEnd={(dx, dy, clientX, clientY) => {
                      const target = dropTargetAt(clientX, clientY, placed.node.id)
                      setDrag(null)
                      setDropTarget(null)

                      // 다른 노드 위에 떨어뜨렸으면 자리를 미는 대신 그 밑으로 들어갑니다.
                      if (target) {
                        dispatch({
                          type: 'REPARENT_MIND_NODE',
                          mapId: current.id,
                          nodeId: placed.node.id,
                          parentId: target,
                        })
                        setSent(`'${placed.node.text}' 를 옮겼습니다`)
                        return
                      }
                      dispatch({
                        type: 'MOVE_MIND_NODE',
                        mapId: current.id,
                        nodeId: placed.node.id,
                        dx,
                        dy,
                      })
                    }}
                    onSend={() => {
                      dispatch({
                        type: 'ADD_TODO',
                        date: todayISO(),
                        title: placed.node.text,
                      })
                      setSent(`'${placed.node.text}' 를 오늘 할 일로 보냈습니다`)
                    }}
                  />
                ))}
              </div>
              </div>
            </div>

            {/*
             * 판의 아래를 잡아 끌어 높이를 정합니다.
             *
             * 키보드로도 됩니다 — 끌기만 두면 손이 마우스에 없는 사람은 기본 높이에
             * 갇힙니다. 위·아래 화살표로 조금씩, Home·End 로 끝까지.
             */}
            <div
              className={styles.grip}
              role="separator"
              tabIndex={0}
              aria-label="마인드맵 판 높이"
              aria-orientation="horizontal"
              aria-valuenow={Math.round(paneH ?? pane.h)}
              aria-valuemin={MIN_MIND_H}
              aria-valuemax={MAX_MIND_H}
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                const from = scrollRef.current?.getBoundingClientRect().height ?? 0
                const y0 = e.clientY
                setDragH(clampPane(from))
                gripFrom.current = { from, y0 }
              }}
              onPointerMove={(e) => {
                const g = gripFrom.current
                if (!g) return
                setDragH(clampPane(g.from + (e.clientY - g.y0)))
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                gripFrom.current = null
                // 끌기가 끝난 다음에야 저장합니다 — 매 픽셀마다 부르면 판이 버벅입니다.
                if (dragH !== null) dispatch({ type: 'SET_SETTINGS', patch: { mindHeight: dragH } })
                setDragH(null)
              }}
              onKeyDown={(e) => {
                const now = Math.round(paneH ?? pane.h)
                const next =
                  e.key === 'ArrowDown'
                    ? now + 40
                    : e.key === 'ArrowUp'
                      ? now - 40
                      : e.key === 'End'
                        ? MAX_MIND_H
                        : e.key === 'Home'
                          ? MIN_MIND_H
                          : null
                if (next === null) return
                e.preventDefault()
                dispatch({ type: 'SET_SETTINGS', patch: { mindHeight: clampPane(next) } })
              }}
            >
              <span className={styles.gripBar} aria-hidden="true" />
            </div>

            {sent && (
              <p className={styles.sent} role="status">
                {sent}
              </p>
            )}

            <p className={styles.hint}>
              글을 누르면 그 자리에서 고칩니다. 적는 동안 <b>Enter</b> 로 옆 가지,{' '}
              <b>Tab</b> 으로 아래 가지를 이어 만들고 <b>Esc</b> 로 멈춥니다. 노드를 끌어
              빈 자리에 놓으면 그 자리에 두고, <b>다른 노드 위에 놓으면 그 밑으로</b>{' '}
              들어갑니다. 올리면 나오는 <b>→</b> 로 오늘 할 일에 보내고 <b>×</b> 로 그 아래를
              함께 지웁니다. 판은 <b>아래를 잡아 끌어</b> 높이를 정하고, 그만큼 지도가
              맞춰 들어옵니다. 배율을 직접 고르려면 위쪽 <b>+ −</b> 를 씁니다.
            </p>
          </>
        ) : (
          <p className={styles.empty}>아직 만든 마인드맵이 없습니다.</p>
        )}

        <div className={styles.add}>
          <InlineAdd
            label="마인드맵 추가"
            placeholder="무엇에 대한 마인드맵인가요?"
            onSubmit={(title) => dispatch({ type: 'ADD_MINDMAP', title })}
          />
        </div>
      </div>
    </div>
  )
}

interface NodeProps {
  placed: PlacedNode
  isRoot: boolean
  adding: boolean
  onAddingChange: (open: boolean) => void
  registerRef: (el: HTMLDivElement | null) => void
  onAddChild: (text: string) => void
  onDelete: () => void
  onToggle: () => void
  onSend: () => void
  /** 고치는 중이면 그 글, 아니면 null */
  editing: string | null
  onEditStart: () => void
  onEditChange: (draft: string) => void
  onEditEnd: () => void
  onEditNext: (kind: 'sibling' | 'child') => void
  /** 화면 위 움직인 거리를 판 좌표로 되돌리는 데 씁니다. */
  zoom: number
  /** 지금 이 노드 위에 다른 노드를 들고 있는지 */
  isDropTarget: boolean
  onDragMove: (dx: number, dy: number, clientX: number, clientY: number) => void
  onDragEnd: (dx: number, dy: number, clientX: number, clientY: number) => void
}

function Node({
  placed,
  isRoot,
  adding,
  onAddingChange,
  registerRef,
  onAddChild,
  onDelete,
  onToggle,
  onSend,
  editing,
  onEditStart,
  onEditChange,
  onEditEnd,
  onEditNext,
  zoom,
  isDropTarget,
  onDragMove,
  onDragEnd,
}: NodeProps) {
  const editRef = useRef<HTMLInputElement>(null)

  // 새로 생긴 노드로 넘어오면 곧바로 적을 수 있어야 합니다.
  useEffect(() => {
    if (editing === null) return
    const input = editRef.current
    input?.focus()
    input?.select()
  }, [editing !== null])
  const { node, x, y, depth, side, childCount } = placed
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  /**
   * 끌기와 '눌러서 고치기' 가 같은 자리에서 일어납니다.
   * 몇 px 이상 움직였을 때만 끌기로 보고, 그때는 뒤따라오는 click 을 막습니다.
   */
  const grab = useRef<{ x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const offsetOf = (e: React.PointerEvent, from: { x: number; y: number }) => ({
    mx: (e.clientX - from.x) / zoom,
    my: (e.clientY - from.y) / zoom,
  })

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed) onAddChild(trimmed)
    setDraft('')
    // 연속으로 가지를 뻗을 수 있게 열어 둡니다 — InlineAdd 와 같은 방식입니다.
    inputRef.current?.focus()
  }

  return (
    <div
      ref={registerRef}
      className={styles.node}
      style={{ left: x, top: y, width: NODE_W }}
      onPointerDown={(e) => {
        // 버튼과 입력은 제 일을 해야 합니다.
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return
        grab.current = { x: e.clientX, y: e.clientY, dx: node.dx ?? 0, dy: node.dy ?? 0, moved: false }
        // 이미 놓인 포인터면 붙잡기가 실패합니다 — 붙잡지 못해도 끌기는 이어집니다.
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* 무시 */
        }
      }}
      onPointerMove={(e) => {
        const g = grab.current
        if (!g) return
        const { mx, my } = offsetOf(e, g)
        // 손이 조금 떨린 것까지 이동으로 보면 글자를 못 고칩니다.
        if (!g.moved && Math.abs(mx) < 4 && Math.abs(my) < 4) return
        g.moved = true
        onDragMove(g.dx + mx, g.dy + my, e.clientX, e.clientY)
      }}
      onPointerUp={(e) => {
        const g = grab.current
        grab.current = null
        if (!g) return
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* 무시 */
        }
        if (!g.moved) return
        dragged.current = true
        const { mx, my } = offsetOf(e, g)
        onDragEnd(g.dx + mx, g.dy + my, e.clientX, e.clientY)
      }}
      onClickCapture={(e) => {
        // 끌고 나서 손을 떼면 click 이 뒤따라옵니다 — 편집이 열리지 않게 삼킵니다.
        if (!dragged.current) return
        dragged.current = false
        e.stopPropagation()
        e.preventDefault()
      }}
      data-dragging={grab.current?.moved || undefined}
      data-drop={isDropTarget || undefined}
      data-root={isRoot || undefined}
      data-branch={!isRoot && depth === 1 ? '' : undefined}
      data-tag={isRoot ? undefined : branchTag(placed.branch)}
      data-side={side}
      data-empty={!node.text.trim() || undefined}
      role="treeitem"
      /* 노드를 절대 좌표로 흩어 놓느라 DOM 은 평평합니다 — 깊이를 따로 알려 줍니다. */
      aria-level={depth + 1}
      aria-expanded={childCount > 0 ? !node.collapsed : undefined}
      aria-label={node.text || '빈 노드'}
    >
      {editing !== null ? (
        <input
          ref={editRef}
          data-no-drag
          className={`${styles.nodeText} ${styles.editInput}`}
          value={editing}
          aria-label={`${node.text || '빈 노드'} 수정`}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter 는 형제, Tab 은 자식 — 생각나는 순서대로 손을 떼지 않고 이어 씁니다.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onEditNext('sibling')
            } else if (e.key === 'Tab') {
              e.preventDefault()
              onEditNext('child')
            } else if (e.key === 'Escape' || (e.key === 'Enter' && e.shiftKey)) {
              e.preventDefault()
              onEditEnd()
            }
          }}
          onBlur={onEditEnd}
        />
      ) : (
        <button
          type="button"
          className={styles.nodeText}
          aria-label={`${node.text || '빈 노드'} 수정`}
          onClick={onEditStart}
        >
          {node.text || '…'}
        </button>
      )}

      <div className={styles.tools} data-no-drag>
        <button
          type="button"
          className={styles.tool}
          aria-label={`${node.text} 아래에 가지 추가`}
          onClick={() => onAddingChange(!adding)}
        >
          +
        </button>
        {node.text.trim() && (
          <button
            type="button"
            className={styles.tool}
            aria-label={`${node.text} 오늘 할 일로 보내기`}
            onClick={onSend}
          >
            →
          </button>
        )}
        {/* 아래 가지까지 함께 사라지므로 여기도 두 번 눌러야 합니다. */}
        {!isRoot && (
          <ConfirmDelete label={node.text} className={styles.tool} onDelete={onDelete} />
        )}
      </div>

      {childCount > 0 && (
        <button
          type="button"
          data-no-drag
          className={styles.knob}
          aria-label={`${node.text} ${node.collapsed ? '펼치기' : '접기'}`}
          onClick={onToggle}
        >
          {node.collapsed ? childCount : '−'}
        </button>
      )}

      {adding && (
        <input
          ref={inputRef}
          data-no-drag
          className={styles.addInput}
          value={draft}
          placeholder="가지 내용"
          aria-label={`${node.text} 아래에 추가할 내용`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft('')
              onAddingChange(false)
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit()
            onAddingChange(false)
          }}
        />
      )}
    </div>
  )
}
