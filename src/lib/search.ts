import { formatDateShort } from '@/lib/date'
import type { ISODate, PlannerData, ViewId } from '@/types'

/**
 * 적어 둔 모든 것에서 글자를 찾습니다.
 *
 * 쌓일수록 '그거 어디 적었더라' 가 되는데, 지금은 화면을 하나씩 열어 보는 수밖에
 * 없습니다. 찾은 것을 누르면 그 화면의 그 날짜로 갑니다.
 */

export type SearchKind = 'event' | 'todo' | 'note' | 'goal' | 'wish' | 'mandal' | 'mind' | 'subject'

/** 화면에 묶어 보여줄 순서와 이름 */
export const KIND_LABEL: Record<SearchKind, string> = {
  event: '일정',
  todo: '할 일',
  note: '메모',
  goal: '목표',
  wish: '위시리스트',
  mandal: '만다라트',
  mind: '마인드맵',
  subject: '과목',
}

export const KIND_ORDER: SearchKind[] = [
  'todo',
  'event',
  'goal',
  'note',
  'mandal',
  'mind',
  'wish',
  'subject',
]

export interface SearchHit {
  /** 목록의 key — 같은 글이 여러 곳에 있어도 서로 다릅니다 */
  id: string
  kind: SearchKind
  /** 찾은 글 (메모는 앞뒤를 잘라낸 조각) */
  text: string
  /** 어디에 있던 것인지 — 날짜나 상위 항목 이름 */
  context?: string
  view: ViewId
  /** 날짜가 있는 것은 그 날로 데려갑니다 */
  date?: ISODate
}

/** 한 종류가 화면을 다 덮지 않도록. 넘치면 몇 개 더 있는지만 알립니다. */
const PER_KIND = 30

function has(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle)
}

/**
 * 메모는 통째로 보여주면 목록이 무너집니다.
 * 찾은 자리 앞뒤만 잘라 내고, 잘린 쪽에 말줄임을 붙입니다.
 */
function snippet(text: string, needle: string, span = 34): string {
  const at = text.toLowerCase().indexOf(needle)
  if (at === -1) return text.slice(0, span * 2)

  const from = Math.max(0, at - span)
  const to = Math.min(text.length, at + needle.length + span)
  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`
}

export function search(data: PlannerData, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const hits: SearchHit[] = []
  const push = (hit: SearchHit) => hits.push(hit)

  for (const t of data.todos) {
    if (has(t.title, needle)) {
      push({ id: `todo:${t.id}`, kind: 'todo', text: t.title, context: formatDateShort(t.date), view: 'today', date: t.date })
    }
  }

  for (const e of data.events) {
    if (has(e.title, needle)) {
      const when = e.start ? `${formatDateShort(e.date)} ${e.start}` : formatDateShort(e.date)
      push({ id: `event:${e.id}`, kind: 'event', text: e.title, context: when, view: 'week', date: e.date })
    }
  }

  for (const g of data.goals) {
    if (has(g.title, needle)) {
      push({ id: `goal:${g.id}`, kind: 'goal', text: g.title, context: g.due ? `${formatDateShort(g.due)}까지` : '언젠가', view: 'goals' })
    }
    for (const s of g.steps) {
      if (has(s.title, needle)) {
        push({ id: `step:${s.id}`, kind: 'goal', text: s.title, context: `${g.title}의 단계`, view: 'goals' })
      }
    }
  }

  for (const [date, text] of Object.entries(data.notes)) {
    if (has(text, needle)) {
      push({ id: `note:${date}`, kind: 'note', text: snippet(text, needle), context: formatDateShort(date), view: 'month', date })
    }
  }

  for (const m of data.mandals) {
    if (has(m.core, needle)) {
      push({ id: `mandal:${m.id}:core`, kind: 'mandal', text: m.core, context: `${m.title}의 핵심`, view: 'mandal' })
    }
    m.subGoals.forEach((sub, i) => {
      if (sub && has(sub, needle)) {
        push({ id: `mandal:${m.id}:sub:${i}`, kind: 'mandal', text: sub, context: `${m.title}의 세부 목표`, view: 'mandal' })
      }
    })
    m.actions.forEach((row, i) =>
      row.forEach((a, j) => {
        if (a.text && has(a.text, needle)) {
          push({
            id: `mandal:${m.id}:act:${i}:${j}`,
            kind: 'mandal',
            text: a.text,
            context: `${m.subGoals[i] || m.title}의 실행${a.done ? ' · 완료' : ''}`,
            view: 'mandal',
          })
        }
      }),
    )
  }

  for (const map of data.mindmaps) {
    for (const node of map.nodes) {
      if (node.text && has(node.text, needle)) {
        push({ id: `mind:${map.id}:${node.id}`, kind: 'mind', text: node.text, context: map.title, view: 'mindmap' })
      }
    }
  }

  for (const w of data.wishes) {
    if (has(w.title, needle)) {
      push({ id: `wish:${w.id}`, kind: 'wish', text: w.title, context: w.done ? '완료' : undefined, view: 'goals' })
    }
  }

  for (const s of data.subjects) {
    if (has(s.name, needle)) {
      push({ id: `subject:${s.id}`, kind: 'subject', text: s.name, context: '과목', view: 'study' })
    }
  }

  return hits
}

export interface SearchGroup {
  kind: SearchKind
  hits: SearchHit[]
  /** 잘라내고 남은 개수 — 0 이면 다 보여준 것입니다 */
  more: number
}

/** 종류별로 묶고, 날짜가 있는 것은 최근 것부터 보여줍니다. */
export function groupHits(hits: SearchHit[]): SearchGroup[] {
  return KIND_ORDER.map((kind) => {
    const all = hits
      .filter((h) => h.kind === kind)
      .sort((a, b) => (a.date && b.date ? b.date.localeCompare(a.date) : 0))
    return { kind, hits: all.slice(0, PER_KIND), more: Math.max(0, all.length - PER_KIND) }
  }).filter((g) => g.hits.length > 0)
}
