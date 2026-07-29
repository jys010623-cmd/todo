import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { MonthHeader } from '@/components/calendar/MonthHeader'

/** AppShell 의 center 가 flex column 이라 래퍼 없이 그대로 쌓습니다. */
export function MonthView() {
  return (
    <>
      <MonthHeader />
      <MonthCalendar />
    </>
  )
}
