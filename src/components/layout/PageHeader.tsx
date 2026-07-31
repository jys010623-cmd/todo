import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface Props {
  title: string
  /** 제목 아래 한 줄 — 주 범위나 날짜 같은 보조 정보 */
  subtitle?: string
  children?: ReactNode
  /**
   * 종이로 뽑을 만한 화면인지.
   *
   * 검색이나 설정은 뽑을 것이 없습니다. 뽑을 수 있는 자리에만 두어야
   * 눌렀을 때 무엇이 나올지 예상이 맞습니다.
   */
  printable?: boolean
}

/** 모든 뷰의 상단을 같은 리듬으로 맞춥니다 (MonthHeader 만 자체 컨트롤을 가집니다). */
export function PageHeader({ title, subtitle, children, printable }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {(children || printable) && (
        <div className={styles.controls}>
          {children}
          {printable && (
            <button
              type="button"
              className={styles.print}
              aria-label={`${title} 인쇄`}
              onClick={() => window.print()}
            >
              인쇄
            </button>
          )}
        </div>
      )}
    </header>
  )
}
