import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { PageHeader } from '@/components/layout/PageHeader'
import { todayISO } from '@/lib/date'
import { NODE_W, layoutMindMap, type PlacedNode } from '@/lib/mindmap'
import { usePlanner } from '@/store/PlannerContext'
import { TAG_COLORS } from '@/types'
import styles from './MindMapView.module.css'

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

  const layout = useMemo(
    () => (current ? layoutMindMap(current, heights) : null),
    [current, heights],
  )

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
   * 판 전체를 키우고 줄입니다.
   * 노드 높이는 offsetHeight 로 재는데 이 값은 transform 의 영향을 받지 않아,
   * 확대해도 배치 계산은 그대로입니다.
   */
  const [zoom, setZoom] = useState(1)
  const step = (d: number) => setZoom((z) => Math.min(1.6, Math.max(0.6, Math.round((z + d) * 10) / 10)))

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
            <button
              type="button"
              className={styles.zoomLevel}
              aria-label="원래 크기로"
              onClick={() => setZoom(1)}
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
              <button
                type="button"
                className={styles.remove}
                aria-label={`${current.title} 마인드맵 삭제`}
                onClick={() => dispatch({ type: 'DELETE_MINDMAP', id: current.id })}
              >
                ×
              </button>
            </div>

            <div className={styles.canvasScroll}>
              {/* 늘어난 판이 차지할 자리는 바깥이 맡습니다 — 안쪽은 원래 좌표 그대로. */}
              <div
                className={styles.sizer}
                style={{ width: layout.width * zoom, height: layout.height * zoom }}
              >
              <div
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
                    onRename={(text) =>
                      dispatch({
                        type: 'UPDATE_MIND_NODE',
                        mapId: current.id,
                        nodeId: placed.node.id,
                        patch: { text },
                      })
                    }
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

            {sent && (
              <p className={styles.sent} role="status">
                {sent}
              </p>
            )}

            <p className={styles.hint}>
              노드에 올리면 나오는 <b>+</b> 로 가지를 뻗고, <b>→</b> 로 오늘 할 일에 보내고,
              <b>×</b> 로 그 아래를 함께 지웁니다. 가지 끝의 동그라미를 누르면 접힙니다.
              판이 크면 위쪽 <b>+ −</b> 로 키우고 줄입니다.
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
  onRename: (text: string) => void
  onAddChild: (text: string) => void
  onDelete: () => void
  onToggle: () => void
  onSend: () => void
}

function Node({
  placed,
  isRoot,
  adding,
  onAddingChange,
  registerRef,
  onRename,
  onAddChild,
  onDelete,
  onToggle,
  onSend,
}: NodeProps) {
  const { node, x, y, depth, side, childCount } = placed
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

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
      <InlineEdit
        value={node.text || '…'}
        editValue={node.text}
        label={node.text || '빈 노드'}
        className={styles.nodeText}
        onCommit={onRename}
      />

      <div className={styles.tools}>
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
        {!isRoot && (
          <button
            type="button"
            className={styles.tool}
            aria-label={`${node.text} 삭제`}
            onClick={onDelete}
          >
            ×
          </button>
        )}
      </div>

      {childCount > 0 && (
        <button
          type="button"
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
