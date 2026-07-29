import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface Props {
  title: string
  /** 제목 아래 한 줄 — 주 범위나 날짜 같은 보조 정보 */
  subtitle?: string
  children?: ReactNode
}

/** 모든 뷰의 상단을 같은 리듬으로 맞춥니다 (MonthHeader 만 자체 컨트롤을 가집니다). */
export function PageHeader({ title, subtitle, children }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children ? <div className={styles.controls}>{children}</div> : null}
    </header>
  )
}
