import type { ReactNode } from 'react'
import { UndoBar } from '@/components/common/UndoBar'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

interface Props {
  center: ReactNode
  right?: ReactNode
}

/**
 * 15% / 60% / 25% 세 열.
 * 열 사이는 divider 1px 뿐 — 배경색 차이를 두지 않아 한 장의 종이처럼 읽히게 합니다.
 */
export function AppShell({ center, right }: Props) {
  return (
    <div className={styles.shell} data-single={right ? undefined : true}>
      <Sidebar />
      <main className={styles.center}>{center}</main>
      {right ? <aside className={styles.right}>{right}</aside> : null}
      {/* 어느 뷰에서 지웠든 같은 자리에 뜨도록 셸에 둡니다. */}
      <UndoBar />
    </div>
  )
}
