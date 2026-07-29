import { DEFAULT_SETTINGS } from '@/store/initial'
import {
  TAG_COLORS,
  type Goal,
  type Mandal,
  type PlannerData,
  type Settings,
  type TagColor,
} from '@/types'

const KEY = 'planme:v1'

/**
 * 초기 웜톤 팔레트에서 디자인 팔레트로 갈아탈 때의 이름 대응입니다.
 * 이미 저장된 데이터가 색을 잃지 않도록 읽는 시점에 바꿔 줍니다.
 */
const LEGACY_TAG: Record<string, TagColor> = {
  clay: 'blue',
  sage: 'mint',
  sand: 'honey',
  dusk: 'lilac',
  rose: 'coral',
}

const VALID_TAGS = new Set<string>(TAG_COLORS)

/** 지금까지 기본값이었던 액센트들 — 현재 액센트로 옮겨 줍니다. */
const LEGACY_ACCENTS = new Set(['#7c6ef6', '#9082cc'])

const SUB_GOALS = 8
const ACTIONS = 8

function migrateTag(tag: unknown): TagColor {
  if (typeof tag === 'string') {
    if (VALID_TAGS.has(tag)) return tag as TagColor
    const mapped = LEGACY_TAG[tag]
    if (mapped) return mapped
  }
  // 알 수 없는 값이면 색이 비어 보이지 않도록 첫 번째 색으로 떨어뜨립니다.
  return TAG_COLORS[0]
}

/** 배열이 아닌 것이 들어와도 앱이 멈추지 않게 합니다. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 설정은 한 항목만 비어도 날짜 계산이 통째로 NaN 이 됩니다.
 * (weekStart 가 없으면 달력 칸이 0개가 됩니다.)
 * 그래서 통으로 퍼뜨리지 않고 항목마다 확인합니다.
 */
function migrateSettings(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>
  const accent = typeof s.accent === 'string' && s.accent ? s.accent : DEFAULT_SETTINGS.accent

  return {
    accent: LEGACY_ACCENTS.has(accent.toLowerCase()) ? DEFAULT_SETTINGS.accent : accent,
    weekStart: s.weekStart === 0 || s.weekStart === 1 ? s.weekStart : DEFAULT_SETTINGS.weekStart,
    hour12: typeof s.hour12 === 'boolean' ? s.hour12 : DEFAULT_SETTINGS.hour12,
  }
}

/** 만다라트는 칸 수가 고정이라, 모자라거나 넘치면 화면에서 바로 깨집니다. */
function migrateMandal(raw: unknown): Mandal {
  const m = (raw ?? {}) as Partial<Mandal>
  const subGoals = asArray<unknown>(m.subGoals)
  const actions = asArray<unknown>(m.actions)

  return {
    id: asText(m.id) || `mdl_${Math.abs(hash(JSON.stringify(raw)))}`,
    title: asText(m.title) || '제목 없음',
    core: asText(m.core),
    subGoals: Array.from({ length: SUB_GOALS }, (_, i) => asText(subGoals[i])),
    actions: Array.from({ length: SUB_GOALS }, (_, i) => {
      const row = asArray<unknown>(actions[i])
      return Array.from({ length: ACTIONS }, (_, j) => asText(row[j]))
    }),
  }
}

/** id 가 비어 있을 때만 쓰는 결정적 대체값 — 새로고침해도 같은 값이 나옵니다. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function loadData(): PlannerData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PlannerData> | null
    // 버전이 다르면 해석할 수 없으므로 초기 상태로 갑니다.
    if (parsed?.version !== 1) return null

    const notes =
      typeof parsed.notes === 'object' && parsed.notes !== null ? parsed.notes : {}

    return {
      version: 1,
      events: asArray<PlannerData['events'][number]>(parsed.events).map((e) => ({
        ...e,
        tag: migrateTag(e.tag),
      })),
      todos: asArray(parsed.todos),
      subjects: asArray<PlannerData['subjects'][number]>(parsed.subjects).map((s) => ({
        ...s,
        tag: migrateTag(s.tag),
      })),
      studyLogs: asArray(parsed.studyLogs),
      notes,
      // 나중에 추가된 영역들 — 예전에 저장된 데이터에는 아예 없습니다.
      goals: asArray<Goal>(parsed.goals).map((g) => ({
        ...g,
        tag: migrateTag(g.tag),
        steps: asArray(g.steps),
      })),
      wishes: asArray(parsed.wishes),
      mandals: asArray(parsed.mandals).map(migrateMandal),
      settings: migrateSettings(parsed.settings),
    }
  } catch {
    return null
  }
}

export function saveData(data: PlannerData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 용량 초과 등 — 저장 실패해도 앱은 계속 동작합니다.
  }
}
