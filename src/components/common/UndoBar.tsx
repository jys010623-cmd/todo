import { usePlanner } from '@/store/PlannerContext'
import styles from './UndoBar.module.css'

/**
 * 지운 직후 잠깐 떠 있는 줄.
 * 삭제 때마다 확인을 묻는 대신, 지우고 나서 되돌릴 수 있게 합니다 —
 * 확인 창은 몇 번 지나면 읽지 않고 누르게 되어 결국 지켜 주지 못합니다.
 */
export function UndoBar() {
  const { undoState, undo, dismissUndo } = usePlanner()

  if (!undoState) return null

  return (
    <div className={styles.bar} role="status">
      <span className={styles.label}>{undoState.label}</span>
      <button type="button" className={styles.action} onClick={undo}>
        되돌리기
      </button>
      <button
        type="button"
        className={styles.close}
        aria-label="되돌리기 닫기"
        onClick={dismissUndo}
      >
        ×
      </button>
    </div>
  )
}
