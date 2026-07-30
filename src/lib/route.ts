import type { ISODate, ViewId } from '@/types'

/**
 * 주소와 화면을 잇습니다.
 *
 * 해시(#/week/2026-07-30)를 씁니다. GitHub Pages 는 정적 파일만 내주기 때문에
 * /todo/week 같은 경로로 바로 들어오면 404 가 납니다. 해시는 서버가 볼 일이 없어
 * 어디에 올려도 그대로 동작합니다.
 */

const VIEWS: ViewId[] = [
  'home',
  'today',
  'week',
  'month',
  'goals',
  'mandal',
  'mindmap',
  'study',
  'settings',
]

/** 날짜를 주소에 담는 화면 — 나머지는 날짜와 무관합니다. */
const DATED: ViewId[] = ['week', 'month']

export interface Route {
  view: ViewId
  /** 날짜를 쓰지 않는 화면이거나 주소에 없으면 undefined */
  date?: ISODate
}

function isViewId(value: string): value is ViewId {
  return (VIEWS as string[]).includes(value)
}

/** 'YYYY-MM-DD' 이면서 실제로 있는 날짜인지 — 2026-02-31 같은 것을 걸러 냅니다. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** 알 수 없는 주소면 null — 호출부가 기본값을 정합니다. */
export function parseHash(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts.length === 0) return null

  const [view, date] = parts
  if (!isViewId(view)) return null
  if (date && DATED.includes(view) && isDate(date)) return { view, date }
  return { view }
}

export function formatHash(view: ViewId, date: ISODate): string {
  return DATED.includes(view) ? `#/${view}/${date}` : `#/${view}`
}
