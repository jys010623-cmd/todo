import { TAG_COLORS, type PlanEvent, type TagColor } from '@/types'

/**
 * '10:00 팀 회의' 처럼 앞에 시간을 적으면 시간으로 떼어냅니다.
 * 시간 입력을 위한 별도 필드를 두지 않기 위한 장치입니다.
 */
export function parseTimePrefix(input: string): { start?: string; title: string } {
  const m = input.match(/^(\d{1,2}):(\d{2})\s+(.+)$/)
  if (!m) return { title: input }

  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return { title: input }

  return { start: `${String(h).padStart(2, '0')}:${m[2]}`, title: m[3].trim() }
}

/** 연속으로 추가할 때 색이 겹치지 않도록 그날 일정 수에 따라 돌아가며 씁니다. */
export function nextTag(count: number): TagColor {
  return TAG_COLORS[count % TAG_COLORS.length]
}

/** 일정을 편집할 때 입력창에 담을 문자열 — 추가할 때와 같은 '시간 제목' 형식입니다. */
export function eventToInput(e: Pick<PlanEvent, 'title' | 'start'>): string {
  return e.start ? `${e.start} ${e.title}` : e.title
}

/**
 * 편집 결과를 UPDATE_EVENT 용 patch 로 바꿉니다.
 * 시간을 지우고 저장하면 start 가 undefined 가 되어 '종일'로 돌아갑니다.
 */
export function inputToEventPatch(input: string): Pick<PlanEvent, 'title' | 'start'> {
  const { start, title } = parseTimePrefix(input)
  return { title, start }
}
