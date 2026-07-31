import { DEFAULT_SETTINGS } from '@/store/initial'
import {
  REPEAT_FREQS,
  TAG_COLORS,
  THEME_MODES,
  type Repeat,
  type RepeatFreq,
  type ThemeMode,
  type Goal,
  type Mandal,
  type MandalAction,
  type MindMap,
  type MindNode,
  type PlannerData,
  type Pomodoro,
  type Settings,
  type StudyTimer,
  type Subject,
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

/**
 * 지금까지 기본값이었던 액센트들 — 현재 액센트로 옮겨 줍니다.
 * 기본값은 고른 것이 아니라 주어진 것이라, 팔레트를 갈면 따라와야 합니다.
 */
const LEGACY_ACCENTS = new Set(['#7c6ef6', '#9082cc', '#6e56cf', '#6d5ce7'])

const SUB_GOALS = 8
const ACTIONS = 8

/** 간격의 위 한계 — '13주마다' 는 사람이 세지 않고, 화면에서도 고를 수 없습니다. */
const MAX_EVERY = 12

function migrateTag(tag: unknown): TagColor {
  if (typeof tag === 'string') {
    if (VALID_TAGS.has(tag)) return tag as TagColor
    const mapped = LEGACY_TAG[tag]
    if (mapped) return mapped
  }
  // 알 수 없는 값이면 색이 비어 보이지 않도록 첫 번째 색으로 떨어뜨립니다.
  return TAG_COLORS[0]
}

/** 'HH:MM' — 아니면 시각으로 쓸 수 없습니다. */
function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)
}

/** 배열이 아닌 것이 들어와도 앱이 멈추지 않게 합니다. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 좌표에 쓰는 값 — 숫자가 아니거나 NaN·무한대면 없는 것으로 봅니다. */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
    // 테마가 없던 시절 데이터도 있습니다.
    theme: THEME_MODES.includes(s.theme as ThemeMode) ? (s.theme as ThemeMode) : DEFAULT_SETTINGS.theme,
    pomodoro: migratePomodoro(s.pomodoro),
    weekStart: s.weekStart === 0 || s.weekStart === 1 ? s.weekStart : DEFAULT_SETTINGS.weekStart,
    hour12: typeof s.hour12 === 'boolean' ? s.hour12 : DEFAULT_SETTINGS.hour12,
    /*
     * 없던 시절 데이터에는 아예 없습니다 — 그때는 '한 번도 안 내보낸 것' 으로 봅니다.
     * 미래 시각이면 '며칠 전' 이 음수가 되므로 그것도 없는 것으로 둡니다.
     */
    exportedAt:
      typeof s.exportedAt === 'number' && Number.isFinite(s.exportedAt) && s.exportedAt > 0
        ? Math.min(s.exportedAt, Date.now())
        : undefined,
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
      // NaN 이 하나 섞이면 그 노드부터 아래가 통째로 화면 밖으로 나갑니다.
      dx: finite(n.dx),
      dy: finite(n.dy),
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

/**
 * 모르는 주기가 들어오면 펼치는 쪽에서 아무 날도 안 맞아, 일정이 통째로 사라진 것처럼
 * 보입니다. 규칙을 못 알아보면 반복을 버리고 그 날 하루짜리로 남깁니다.
 */
function migrateRepeat(raw: unknown): Repeat | undefined {
  const r = (raw ?? undefined) as Partial<Repeat> | undefined
  if (!r || typeof r !== 'object') return undefined
  if (!REPEAT_FREQS.includes(r.freq as RepeatFreq)) return undefined

  const isDate = (d: unknown): d is string =>
    typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

  const skip = asArray<unknown>(r.skip).filter(isDate)

  /*
   * 요일은 0..6 정수만 받고 겹치는 것을 걸러 정렬합니다.
   * 하나라도 엉뚱한 값이 섞이면 그 요일에만 안 오거나 매번 오는 식으로 어긋나는데,
   * 화면에서는 규칙이 이상하다는 것을 알아볼 방법이 없습니다.
   */
  const days = [
    ...new Set(
      asArray<unknown>(r.days).filter(
        (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
      ),
    ),
  ].sort((a, b) => a - b)

  // 0 이나 음수면 나머지 연산이 무한·NaN 이 됩니다. 1 은 '매번' 이라 없는 것과 같습니다.
  const every =
    typeof r.every === 'number' && Number.isFinite(r.every) && r.every > 1
      ? Math.min(Math.floor(r.every), MAX_EVERY)
      : undefined

  return {
    freq: r.freq as RepeatFreq,
    skip: skip.length > 0 ? skip : undefined,
    until: isDate(r.until) ? r.until : undefined,
    days: days.length > 0 ? days : undefined,
    every,
  }
}

/**
 * 길이가 0 이하이면 타이머가 켜자마자 끝나 무한히 넘어갑니다.
 * 지나치게 길어도 쓸모가 없어 위아래를 막아 둡니다.
 */
function minutesIn(value: unknown, fallback: number, max: number): number {
  const n = finite(value)
  if (n === undefined) return fallback
  return Math.min(Math.max(Math.round(n), 1), max)
}

function migratePomodoro(raw: unknown): Pomodoro {
  const p = (raw ?? {}) as Partial<Pomodoro>
  return {
    enabled: p.enabled === true,
    focusMin: minutesIn(p.focusMin, DEFAULT_SETTINGS.pomodoro.focusMin, 180),
    breakMin: minutesIn(p.breakMin, DEFAULT_SETTINGS.pomodoro.breakMin, 60),
  }
}

/**
 * 돌던 타이머는 새로고침해도 이어져야 합니다.
 * 다만 시작 시각이 깨졌거나 과목이 사라졌으면 멈출 수도 기록할 수도 없으니 버립니다.
 * 미래에서 시작한 것으로 되어 있으면 흘러간 시간이 음수가 되어 그것도 버립니다.
 */
function migrateTimer(raw: unknown, subjects: Subject[]): StudyTimer | undefined {
  const t = raw as Partial<StudyTimer> | null | undefined
  if (!t || typeof t !== 'object') return undefined

  const startedAt = finite(t.startedAt)
  if (startedAt === undefined || startedAt <= 0 || startedAt > Date.now()) return undefined

  const subjectId = asText(t.subjectId)
  if (!subjectId || !subjects.some((s) => s.id === subjectId)) return undefined

  const lengthMin = finite(t.lengthMin)
  return {
    subjectId,
    startedAt,
    // 0 이하이면 남은 시간이 늘 음수가 되어 화면이 멈춘 것처럼 보입니다.
    lengthMin: lengthMin !== undefined && lengthMin > 0 ? Math.round(lengthMin) : undefined,
    resting: t.resting === true ? true : undefined,
  }
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

    // 타이머가 가리키는 과목이 아직 있는지 확인해야 해서 먼저 만듭니다.
    const subjects = asArray<PlannerData['subjects'][number]>(parsed.subjects).map((s) => ({
      ...s,
      tag: migrateTag(s.tag),
    }))

    return {
      version: 1,
      events: asArray<PlannerData['events'][number]>(parsed.events).map((e) => ({
        ...e,
        tag: migrateTag(e.tag),
        repeat: migrateRepeat(e.repeat),
        note: typeof e.note === 'string' && e.note.trim() ? e.note : undefined,
      })),
      todos: asArray<PlannerData['todos'][number]>(parsed.todos).map((t) => ({
        ...t,
        /*
         * 할 일의 색은 '안 정함' 이 기본이라 일정과 달리 첫 색으로 떨어뜨리지 않습니다.
         * 모르는 값이 오면 색이 없는 것으로 둡니다 — 엉뚱한 색이 칠해지는 것보다 낫습니다.
         */
        tag: t.tag === undefined ? undefined : VALID_TAGS.has(t.tag) ? t.tag : LEGACY_TAG[t.tag],
        time: isTime(t.time) ? t.time : undefined,
      })),
      subjects,
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
      timer: migrateTimer(parsed.timer, subjects),
      settings: migrateSettings(parsed.settings),
    }
  } catch {
    return null
  }
}

const BROKEN_KEY = 'planme:v1:broken'

/**
 * 읽지 못한 기록을 옆으로 치워 둡니다.
 *
 * 못 읽으면 앱은 빈 플래너로 시작하고, 곧바로 그 빈 것을 저장합니다 — 원본은
 * 그 순간 사라집니다. 무엇이 잘못됐는지 보기도 전에 없어지는 것이라, 지우기 전에
 * 글자 그대로 한 벌 떠 둡니다.
 *
 * 이미 치워 둔 것이 있으면 덮지 않습니다. 처음 것이 온전했던 마지막 기록입니다.
 */
function stashBroken(raw: string): void {
  try {
    if (localStorage.getItem(BROKEN_KEY)) return
    localStorage.setItem(BROKEN_KEY, raw)
  } catch {
    // 자리가 없으면 어쩔 수 없습니다 — 앱은 계속 동작해야 합니다.
  }
}

/** 치워 둔 것이 있으면 그 글자 그대로. 없으면 null */
export function readBroken(): string | null {
  try {
    return localStorage.getItem(BROKEN_KEY)
  } catch {
    return null
  }
}

export function clearBroken(): void {
  try {
    localStorage.removeItem(BROKEN_KEY)
  } catch {
    /* 무시 */
  }
}

export function loadData(): PlannerData | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = parseData(JSON.parse(raw))
    if (parsed) return parsed
  } catch {
    // JSON 이 아니거나 읽는 도중 터진 것 — 아래에서 함께 치웁니다.
  }
  if (raw) stashBroken(raw)
  return null
}

export function saveData(data: PlannerData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 용량 초과 등 — 저장 실패해도 앱은 계속 동작합니다.
  }
}
