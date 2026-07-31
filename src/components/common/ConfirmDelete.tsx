import { useEffect, useRef, useState } from 'react'
import styles from './ConfirmDelete.module.css'

/** 물어본 채로 놔두는 시간 — 이만큼 지나면 조용히 × 로 돌아갑니다. */
const ARM_MS = 4000

interface Props {
  /** 무엇을 지우는지 — 읽어 주는 데 씁니다. '2026 하반기 만다라트' 처럼. */
  label: string
  onDelete: () => void
  /** 놓이는 자리마다 크기가 달라, 평소 모습(×)의 꾸밈은 쓰는 쪽이 줍니다. */
  className?: string
}

/**
 * 두 번 눌러야 지워지는 ×.
 *
 * 되돌리기 막대가 있어 대부분의 삭제는 한 번으로 충분합니다. 그런데 만다라트 81칸과
 * 마인드맵 가지는 손이 한 번 미끄러지면 한참 적어 둔 것이 통째로 사라지고, 그 자리가
 * 하필 제목 옆이라 이름을 고치려다 스치기 쉽습니다.
 *
 * 그렇다고 확인 창을 띄우지는 않습니다 — 몇 번 지나면 읽지 않고 누르게 되어 결국
 * 지켜 주지 못합니다. 대신 버튼 자신이 '삭제' 로 바뀌어, 두 번째 누르는 곳이 처음
 * 누른 곳과 같은 자리가 됩니다. 손이 미끄러진 것으로는 같은 자리를 두 번 누를 수
 * 없습니다.
 *
 * 물어본 채로 두지 않습니다. 다른 데를 보거나 잠깐 두면 × 로 돌아갑니다 — 화면에
 * '삭제' 가 남아 있으면 그것이 다음에 누를 것이 되어 버립니다.
 */
export function ConfirmDelete({ label, onDelete, className }: Props) {
  const [armed, setArmed] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_MS)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <button
      ref={ref}
      type="button"
      className={armed ? styles.confirm : className}
      data-armed={armed || undefined}
      aria-label={armed ? `${label} 정말 삭제` : `${label} 삭제`}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setArmed(false)
      }}
      onClick={(e) => {
        /*
         * 이 버튼이 놓이는 자리(마인드맵 노드)는 누르는 것을 자기도 씁니다 —
         * 물어보는 첫 번째 누름이 노드 편집까지 열면 안 됩니다.
         */
        e.stopPropagation()
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        onDelete()
      }}
    >
      {armed ? '삭제' : '×'}
    </button>
  )
}
