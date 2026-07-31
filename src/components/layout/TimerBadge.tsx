import { useEffect, useState } from 'react'
import { clock } from '@/lib/date'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import styles from './TimerBadge.module.css'

/**
 * 도는 공부 타이머 — 어느 화면에 있든 메뉴 안 같은 자리에서 보입니다.
 *
 * 시계가 스터디 화면 안에서만 돌면, 켜 두고 다른 화면으로 옮긴 순간부터
 * 재고 있는지 아닌지를 알 방법이 없습니다. 그러면 재는 것을 잊고 하루가 지나거나,
 * 확인하려고 스터디로 다녀오기를 반복하게 됩니다.
 *
 * 여기서 멈출 수는 없습니다 — 지나다니며 누르는 자리라, 잘못 누르면 재던 시간이
 * 그대로 끊깁니다. 누르면 스터디로 갑니다.
 */
export function TimerBadge() {
  const { data, setView } = usePlanner()
  const { timer, subjects } = data

  /*
   * 1초마다 다시 그립니다. 흘러간 시간을 세어 두는 것이 아니라 시작 시각만 들고
   * 있어서, 화면이 멈춰 있던 동안까지 그대로 이어집니다.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer) return
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [timer])

  const subject = timer ? subjects.find((s) => s.id === timer.subjectId) : undefined
  // 과목이 사라졌으면 무엇을 재는 중인지 말할 수 없습니다.
  if (!timer || !subject) return null

  const elapsed = Math.max(0, now - timer.startedAt)
  /** 뽀모도로면 남은 시간, 아니면 흘러간 시간 — 스터디 화면과 같은 규칙입니다. */
  const shown = timer.lengthMin ? Math.max(0, timer.lengthMin * 60_000 - elapsed) : elapsed

  return (
    <button
      type="button"
      className={styles.badge}
      data-resting={timer.resting || undefined}
      aria-label={`${subject.name} ${timer.resting ? '쉬는 중' : '재는 중'} — 스터디 화면으로`}
      onClick={() => setView('study')}
    >
      <span className={styles.dot} style={{ background: tagVar(subject.tag) }} aria-hidden="true" />
      <span className={styles.name}>{timer.resting ? '쉬는 중' : subject.name}</span>
      <span className={styles.clock} role="timer" aria-live="off">
        {clock(shown)}
      </span>
    </button>
  )
}
