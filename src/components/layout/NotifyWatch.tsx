import { useEffect, useRef } from 'react'

import { formatTime, timeToMinutes, todayISO } from '@/lib/date'
import { usePlanner } from '@/store/PlannerContext'

/** 얼마마다 살펴볼지 — 분 단위 알림에 30초면 늦지 않습니다. */
const TICK_MS = 30_000

/**
 * 다가온 일정을 알립니다.
 *
 * 웹 알림은 이 앱이 열려 있는 동안에만 뜹니다 — 서버가 없어서 닫힌 뒤에는 아무도
 * 대신 깨워 주지 않습니다. 그래서 기본은 꺼져 있고, 설정에서 그 사실을 먼저 말합니다.
 *
 * 그려 낼 것이 없어 화면에는 아무것도 두지 않습니다.
 */
export function NotifyWatch() {
  const { data, eventsByDate } = usePlanner()
  const notify = data.settings.notify

  /*
   * 이미 알린 것.
   *
   * 30초마다 살펴보므로 표시해 두지 않으면 같은 일정이 10분 내내 스무 번 울립니다.
   * 새로고침하면 비워집니다 — 그때는 '지난 것' 검사가 대신 막아 줍니다.
   */
  const told = useRef(new Set<string>())

  const enabled = notify?.enabled === true
  const leadMin = notify?.leadMin ?? 10

  useEffect(() => {
    if (!enabled) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const look = () => {
      const now = new Date()
      const today = todayISO()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      for (const e of eventsByDate.get(today) ?? []) {
        if (!e.start) continue
        const left = timeToMinutes(e.start) - nowMin
        // 이미 지난 것과 아직 먼 것은 건너뜁니다.
        if (left < 0 || left > leadMin) continue
        if (told.current.has(e.id)) continue

        told.current.add(e.id)
        try {
          new Notification(e.title, {
            body: left <= 0 ? `지금 ${formatTime(e.start, false)}` : `${left}분 뒤 · ${formatTime(e.start, false)}`,
            tag: e.id,
            icon: `${import.meta.env.BASE_URL}icon-192.png`,
          })
        } catch {
          // 알림이 막혔거나 기기가 안 받아 줘도 앱은 그대로 돕니다.
        }
      }
    }

    look()
    const timer = window.setInterval(look, TICK_MS)
    return () => window.clearInterval(timer)
  }, [enabled, leadMin, eventsByDate])

  return null
}
