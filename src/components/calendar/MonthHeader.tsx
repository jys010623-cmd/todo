import { addMonths, formatMonthTitle, isSameMonth, todayISO } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'
import styles from './MonthHeader.module.css'

export function MonthHeader() {
  const { cursorMonth, setCursorMonth, selectDate } = usePlanner()
  const today = todayISO()

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{formatMonthTitle(cursorMonth)}</h1>

      <div className={styles.controls}>
        {/* 달력은 벽에 붙여 두기 좋은 화면이라, 뽑는 자리가 여기 있어야 합니다. */}
        <button
          type="button"
          className={styles.todayBtn}
          aria-label={`${formatMonthTitle(cursorMonth)} 인쇄`}
          onClick={() => window.print()}
        >
          인쇄
        </button>

        {!isSameMonth(cursorMonth, today) && (
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => {
              setCursorMonth(today)
              selectDate(today)
            }}
          >
            오늘
          </button>
        )}

        <button
          type="button"
          className={styles.arrow}
          aria-label="이전 달"
          onClick={() => setCursorMonth(addMonths(cursorMonth, -1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10 3 5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className={styles.arrow}
          aria-label="다음 달"
          onClick={() => setCursorMonth(addMonths(cursorMonth, 1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
