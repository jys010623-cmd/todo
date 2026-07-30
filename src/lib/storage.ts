import { DEFAULT_SETTINGS } from '@/store/initial'
import {
  TAG_COLORS,
  type Goal,
  type Mandal,
  type MandalAction,
  type MindMap,
  type MindNode,
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

/**
 * 실행 항목은 원래 문자열이었고 지금은 { text, done } 입니다.
 * 예전에 적어 둔 글이 사라지지 않도록 읽는 시점에 옮깁니다.
 */
function migrateAction(raw: unknown): MandalAction {
  if (typeof raw === 'string') return { text: raw, done: false }
  const a = (raw ?? {}) as Partial<MandalAction>
  return { text: asText(a.text), done: a.done === true }
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
      return Array.from({ length: ACTIONS }, (_, j) => migrateAction(row[j]))
    }),
  }
}

/**
 * 마인드맵은 부모를 id 로 가리키기 때문에, 한 군데만 깨져도 화면에서 통째로 사라지거나
 * 배치가 무한히 돕니다. 읽는 시점에 '루트 하나로 모두 이어진 트리'로 만들어 둡니다.
 */
function migrateMindMap(raw: unknown): MindMap {
  const m = (raw ?? {}) as Partial<MindMap>
  const title = asText(m.title) || '제목 없음'
  const id = asText(m.id) || `mm_${Math.abs(hash(JSON.stringify(raw)))}`

  const cleaned: MindNode[] = asArray<Partial<MindNode>>(m.nodes)
    .filter((n) => typeof n?.id === 'string' && n.id)
    .map((n, i) => ({
      id: n.id as string,
      text: asText(n.text),
      parentId: typeof n.parentId === 'string' ? n.parentId : undefined,
      order: typeof n.order === 'number' && Number.isFinite(n.order) ? n.order : i,
      collapsed: n.collapsed === true ? true : undefined,
    }))

  // 같은 id 가 둘 있으면 뒤엣것이 앞엣것의 부모로 잡히는 등 트리가 뒤틀립니다.
  const unique = new Map<string, MindNode>()
  for (const n of cleaned) if (!unique.has(n.id)) unique.set(n.id, n)
  const nodes = [...unique.values()]

  if (nodes.length === 0) {
    return { id, title, nodes: [{ id: `${id}_root`, text: title, order: 0 }] }
  }

  // 루트는 하나여야 합니다. 없으면 첫 노드를 루트로 세웁니다.
  const root = nodes.find((n) => !n.parentId) ?? nodes[0]
  root.parentId = undefined

  /** 조상을 따라 올라가 루트에 닿는지 봅니다 — 못 닿으면 미아이거나 순환입니다. */
  const reaches = (start: MindNode): boolean => {
    const seen = new Set<string>([start.id])
    let current = start
    while (current.parentId) {
      const parent = unique.get(current.parentId)
      if (!parent || seen.has(parent.id)) return false
      if (parent.id === root.id) return true
      seen.add(parent.id)
      current = parent
    }
    return current.id === root.id
  }

  for (const n of nodes) {
    if (n.id !== root.id && !reaches(n)) n.parentId = root.id
  }

  return { id, title, nodes }
}

/** id 가 비어 있을 때만 쓰는 결정적 대체값 — 새로고침해도 같은 값이 나옵니다. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/**
 * JSON.parse 결과를 온전한 상태로 만듭니다.
 *
 * 저장된 것을 읽을 때와 파일에서 가져올 때가 같은 길을 타야 합니다.
 * 가져오기용 검사를 따로 쓰면 둘이 서서히 어긋나고, 그 틈으로 들어온 값이
 * 저장까지 되어 앱이 열리지 않게 됩니다.
 */
export function parseData(raw: unknown): PlannerData | null {
  try {
    const parsed = raw as Partial<PlannerData> | null
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
      mindmaps: asArray(parsed.mindmaps).map(migrateMindMap),
      settings: migrateSettings(parsed.settings),
    }
  } catch {
    return null
  }
}

export function loadData(): PlannerData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return parseData(JSON.parse(raw))
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
