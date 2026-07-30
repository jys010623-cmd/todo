import { useEffect, useState } from 'react'

import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { PageHeader } from '@/components/layout/PageHeader'
import { todayISO } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import { TAG_COLORS, type Mandal } from '@/types'
import styles from './MandalView.module.css'

/** 갈래마다 색을 돌려 씁니다 — 여덟 블록이 서로 구분되기만 하면 됩니다. */
function branchTag(sub: number) {
  return TAG_COLORS[sub % TAG_COLORS.length]
}

/**
 * 9×9 = 3×3 블록 × 3×3 칸.
 * 블록 4(가운데)의 4번 칸이 핵심 목표, 나머지 8칸이 세부 목표입니다.
 * 바깥 블록 b 의 4번 칸은 그 세부 목표를 다시 보여주고(읽기 전용),
 * 나머지 8칸이 실행 항목입니다.
 *
 * 가운데를 뺀 0~8 을 0~7 로 접는 계산이 반복돼서 여기 한 번만 씁니다.
 */
function withoutCenter(index: number): number {
  return index < 4 ? index : index - 1
}

type Cell =
  | { kind: 'core'; text: string }
  | { kind: 'sub'; sub: number; text: string }
  | { kind: 'mirror'; sub: number; text: string }
  | { kind: 'action'; sub: number; action: number; text: string; done: boolean }

/** (블록, 칸) → 그 자리에 무엇이 오는지 */
function cellAt(m: Mandal, block: number, index: number): Cell {
  if (block === 4) {
    if (index === 4) return { kind: 'core', text: m.core }
    const sub = withoutCenter(index)
    return { kind: 'sub', sub, text: m.subGoals[sub] }
  }
  const sub = withoutCenter(block)
  if (index === 4) return { kind: 'mirror', sub, text: m.subGoals[sub] }
  const action = withoutCenter(index)
  const cell = m.actions[sub][action]
  return { kind: 'action', sub, action, text: cell.text, done: cell.done }
}

/** 적어 둔 것 중 해낸 것 — 빈 칸은 세지 않습니다. 안 적은 것은 못 한 것이 아닙니다. */
function progressOf(row: Mandal['actions'][number]) {
  const filled = row.filter((a) => a.text.trim())
  return { done: filled.filter((a) => a.done).length, total: filled.length }
}

export function MandalView() {
  const { data, dispatch } = usePlanner()
  const { mandals } = data

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const current = mandals.find((m) => m.id === selectedId) ?? mandals[0] ?? null

  /**
   * 보낸 것은 다른 화면으로 가 버려 여기서는 아무 변화가 없습니다.
   * 눌렀는데 아무 일도 안 일어난 것처럼 보이지 않게 한 줄 남깁니다.
   */
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => {
    if (!sent) return
    const timer = window.setTimeout(() => setSent(null), 4000)
    return () => window.clearTimeout(timer)
  }, [sent])

  // 만다라트를 새로 만들거나 지우면 선택을 따라 옮깁니다.
  useEffect(() => {
    if (mandals.length === 0) setSelectedId(null)
    else if (!mandals.some((m) => m.id === selectedId)) setSelectedId(mandals[0].id)
  }, [mandals, selectedId])

  const total = current
    ? current.actions.reduce(
        (sum, row) => {
          const p = progressOf(row)
          return { done: sum.done + p.done, total: sum.total + p.total }
        },
        { done: 0, total: 0 },
      )
    : { done: 0, total: 0 }

  return (
    <div className={styles.scroll}>
      <PageHeader
        title="만다라트"
        subtitle={
          !current
            ? '가운데 하나를 정하고 여덟 갈래로 펼칩니다'
            : total.total > 0
              ? `실행 ${total.done}/${total.total} 완료`
              : '실행 항목을 적으면 여기에 진행률이 나옵니다'
        }
      >
        {mandals.length > 1 && (
          <select
            className={styles.picker}
            aria-label="만다라트 선택"
            value={current?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {mandals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      <div className={styles.body}>
        {current ? (
          <>
            <div className={styles.titleRow}>
              <InlineEdit
                value={current.title}
                label={current.title}
                className={styles.title}
                onCommit={(title) =>
                  dispatch({ type: 'UPDATE_MANDAL', id: current.id, patch: { title } })
                }
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={`${current.title} 만다라트 삭제`}
                onClick={() => dispatch({ type: 'DELETE_MANDAL', id: current.id })}
              >
                ×
              </button>
            </div>

            <div className={styles.boardScroll}>
              <div className={styles.board} role="group" aria-label={`${current.title} 만다라트`}>
              {Array.from({ length: 9 }, (_, block) => (
                <div
                  key={block}
                  className={styles.block}
                  data-center={block === 4 || undefined}
                  data-tag={block === 4 ? undefined : branchTag(withoutCenter(block))}
                >
                  {Array.from({ length: 9 }, (_, index) => {
                    const cell = cellAt(current, block, index)
                    const key = `${block}-${index}`

                    // 바깥 블록 가운데는 세부 목표를 다시 보여줄 뿐이라 여기서 고치지 않습니다.
                    if (cell.kind === 'mirror') {
                      const p = progressOf(current.actions[cell.sub])
                      return (
                        <div key={key} className={styles.cell} data-mirror>
                          <span className={styles.mirrorText}>{cell.text}</span>
                          {p.total > 0 && (
                            <span
                              className={styles.blockCount}
                              data-all={p.done === p.total || undefined}
                            >
                              {p.done}/{p.total}
                            </span>
                          )}
                        </div>
                      )
                    }

                    const onCommit = (text: string) =>
                      dispatch({
                        type: 'SET_MANDAL_CELL',
                        id: current.id,
                        sub: cell.kind === 'core' ? undefined : cell.sub,
                        action: cell.kind === 'action' ? cell.action : undefined,
                        text,
                      })

                    const label =
                      cell.kind === 'core'
                        ? '핵심 목표'
                        : cell.kind === 'sub'
                          ? `세부 목표 ${cell.sub + 1}`
                          : `세부 목표 ${cell.sub + 1} 실행 ${cell.action + 1}`

                    const filled = !!cell.text.trim()

                    return (
                      <div
                        key={key}
                        className={styles.cell}
                        data-core={cell.kind === 'core' || undefined}
                        data-sub={cell.kind === 'sub' || undefined}
                        data-done={(cell.kind === 'action' && cell.done) || undefined}
                        data-empty={!filled || undefined}
                      >
                        <InlineEdit
                          value={cell.text}
                          label={label}
                          className={styles.cellText}
                          onCommit={onCommit}
                        />

                        {/* 해낼 수 있는 것은 실행 항목뿐입니다 — 핵심과 세부는 방향이지 할 일이 아닙니다. */}
                        {cell.kind === 'action' && filled && (
                          <button
                            type="button"
                            className={styles.check}
                            aria-label={`${cell.text} ${cell.done ? '완료 취소' : '완료'}`}
                            aria-pressed={cell.done}
                            onClick={() =>
                              dispatch({
                                type: 'TOGGLE_MANDAL_ACTION',
                                id: current.id,
                                sub: cell.sub,
                                action: cell.action,
                              })
                            }
                          />
                        )}

                        {filled && cell.kind !== 'core' && (
                          <button
                            type="button"
                            className={styles.send}
                            aria-label={
                              cell.kind === 'sub'
                                ? `${cell.text} 목표로 보내기`
                                : `${cell.text} 오늘 할 일로 보내기`
                            }
                            onClick={() => {
                              if (cell.kind === 'sub') {
                                dispatch({
                                  type: 'ADD_GOAL',
                                  title: cell.text,
                                  tag: branchTag(cell.sub),
                                })
                                setSent(`'${cell.text}' 를 목표로 보냈습니다`)
                              } else {
                                dispatch({ type: 'ADD_TODO', date: todayISO(), title: cell.text })
                                setSent(`'${cell.text}' 를 오늘 할 일로 보냈습니다`)
                              }
                            }}
                          >
                            →
                          </button>
                        )}
                      </div>
                    )
                  })}
                  </div>
                ))}
              </div>
            </div>

            {sent && (
              <p className={styles.sent} role="status">
                {sent}
              </p>
            )}

            <p className={styles.hint}>
              칸에 올리면 나오는 동그라미로 해낸 것을 표시하고, <b>→</b> 로 세부 목표는 목표에,
              실행 항목은 오늘 할 일에 보냅니다. 가운데 칸이 핵심 목표입니다. 그 주위 여덟 칸에 세부 목표를 적으면 바깥 여덟 블록의
              가운데에 그대로 옮겨지고, 각 블록의 나머지 여덟 칸이 그 세부 목표의 실행 항목이
              됩니다.
            </p>
          </>
        ) : (
          <p className={styles.empty}>아직 만든 만다라트가 없습니다.</p>
        )}

        <div className={styles.add}>
          <InlineAdd
            label="만다라트 추가"
            placeholder="무엇에 대한 만다라트인가요?"
            onSubmit={(title) => dispatch({ type: 'ADD_MANDAL', title })}
          />
        </div>
      </div>
    </div>
  )
}
