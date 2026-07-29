import type { ReactNode } from 'react'
import styles from './SectionHeader.module.css'

interface Props {
  title: string
  meta?: ReactNode
}

export function SectionHeader({ title, meta }: Props) {
  return (
    <div className={styles.row}>
      <h3 className={styles.title}>{title}</h3>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </div>
  )
}
