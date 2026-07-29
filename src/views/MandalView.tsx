import { useEffect, useState } from 'react'

import { InlineAdd } from '@/components/common/InlineAdd'
import { InlineEdit } from '@/components/common/InlineEdit'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePlanner } from '@/store/PlannerContext'
import type { Mandal } from '@/types'
import styles from './MandalView.module.css'

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
  | { kind: 'action'; sub: number; action: number; text: string }

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
  return { kind: 'action', sub, action, text: m.actions[sub][action] }
}

export function MandalView() {
  const { data, dispatch } = usePlanner()
  const { mandals } = data

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const current = mandals.find((m) => m.id === selectedId) ?? mandals[0] ?? null

  // 만다라트를 새로 만들거나 지우면 선택을 따라 옮깁니다.
  useEffect(() => {
    if (mandals.length === 0) setSelectedId(null)
    else if (!mandals.some((m) => m.id === selectedId)) setSelectedId(mandals[0].id)
  }, [mandals, selectedId])

  const filled = current
    ? [current.core, ...current.subGoals, ...current.actions.flat()].filter((t) => t.trim()).length
    : 0

  return (
    <div className={styles.scroll}>
      <PageHeader
        title="만다라트"
        subtitle={
          current ? `${filled}/81 칸 채움` : '가운데 하나를 정하고 여덟 갈래로 펼칩니다'
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
                <div key={block} className={styles.block} data-center={block === 4 || undefined}>
                  {Array.from({ length: 9 }, (_, index) => {
                    const cell = cellAt(current, block, index)
                    const key = `${block}-${index}`

                    // 바깥 블록 가운데는 세부 목표를 다시 보여줄 뿐이라 여기서 고치지 않습니다.
                    if (cell.kind === 'mirror') {
                      return (
                        <div key={key} className={styles.cell} data-mirror>
                          <span className={styles.mirrorText}>{cell.text}</span>
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

                    return (
                      <div
                        key={key}
                        className={styles.cell}
                        data-core={cell.kind === 'core' || undefined}
                        data-sub={cell.kind === 'sub' || undefined}
                        data-empty={!cell.text.trim() || undefined}
                      >
                        <InlineEdit
                          value={cell.text}
                          label={label}
                          className={styles.cellText}
                          onCommit={onCommit}
                        />
                      </div>
                    )
                  })}
                  </div>
                ))}
              </div>
            </div>

            <p className={styles.hint}>
              가운데 칸이 핵심 목표입니다. 그 주위 여덟 칸에 세부 목표를 적으면 바깥 여덟 블록의
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
