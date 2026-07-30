/** 'YYYY-MM-DD' — 로컬 타임존 기준 날짜 키 */
export type ISODate = string

/** 'HH:MM' 24시간 표기 */
export type Time = string

export type TagColor = 'mint' | 'blue' | 'lilac' | 'coral' | 'honey'

export const TAG_COLORS: TagColor[] = ['mint', 'blue', 'lilac', 'coral', 'honey']

export interface PlanEvent {
  id: string
  date: ISODate
  start?: Time
  end?: Time
  title: string
  tag: TagColor
}

export interface Todo {
  id: string
  date: ISODate
  title: string
  done: boolean
  order: number
}

export interface Subject {
  id: string
  name: string
  tag: TagColor
  /** 주간 목표 (분) */
  weeklyGoalMin: number
}

export interface StudyLog {
  id: string
  date: ISODate
  subjectId: string
  minutes: number
}

/** 목표는 '언제까지'가 있는 것과 '언젠가'로 미뤄둔 것으로 나뉩니다. */
export type GoalStatus = 'active' | 'someday' | 'done'

export interface GoalStep {
  id: string
  title: string
  done: boolean
}

export interface Goal {
  id: string
  title: string
  /** 목표일 — 없으면 '언젠가' */
  due?: ISODate
  status: GoalStatus
  tag: TagColor
  order: number
  /** 목표를 쪼갠 단계들. 진행률은 이걸로 계산합니다. */
  steps: GoalStep[]
}

/** 배우고 싶은 것과 따고 싶은 자격증 */
export type WishKind = 'learn' | 'cert'

export const WISH_LABEL: Record<WishKind, string> = {
  learn: '배우고 싶은 것',
  cert: '따고 싶은 자격증',
}

export interface WishItem {
  id: string
  title: string
  kind: WishKind
  done: boolean
  order: number
  /** 스터디 과목과 연결하면 공부 시간이 따라옵니다. */
  subjectId?: string
}

/**
 * 만다라트 — 9×9.
 * 가운데 3×3 블록에 핵심 목표와 세부 목표 8개가 들어가고,
 * 바깥 8개 블록이 각 세부 목표를 실행 항목 8개로 펼칩니다.
 * 81칸을 그대로 들고 있으면 가운데와 바깥의 중복을 직접 관리해야 해서,
 * 겹치지 않는 최소 단위만 저장하고 화면에서 펼칩니다.
 */
export interface Mandal {
  id: string
  title: string
  core: string
  /** 세부 목표 8개 */
  subGoals: string[]
  /** subGoals[i] 의 실행 항목 8개 */
  actions: string[][]
}

/**
 * 마인드맵의 노드 하나.
 *
 * 트리를 중첩 구조로 저장하면 노드 하나를 고칠 때마다 조상을 전부 새로 만들어야 해서,
 * 부모를 가리키는 평평한 배열로 둡니다. 화면에 그릴 때만 트리로 세웁니다.
 */
export interface MindNode {
  id: string
  text: string
  /** 루트만 없습니다 */
  parentId?: string
  /** 형제 사이의 순서 */
  order: number
  /** 접힌 노드는 자식을 그리지 않습니다 */
  collapsed?: boolean
}

export interface MindMap {
  id: string
  title: string
  /** 루트를 포함한 모든 노드. 부모 없는 노드가 루트입니다. */
  nodes: MindNode[]
}

export type ViewId =
  | 'today'
  | 'week'
  | 'month'
  | 'goals'
  | 'mandal'
  | 'mindmap'
  | 'study'
  | 'settings'

export interface Settings {
  /** --accent 로 주입되는 HEX */
  accent: string
  /** 0 = 일요일 시작, 1 = 월요일 시작 */
  weekStart: 0 | 1
  hour12: boolean
}

/** localStorage 에 영속되는 도메인 상태 */
export interface PlannerData {
  version: 1
  events: PlanEvent[]
  todos: Todo[]
  subjects: Subject[]
  studyLogs: StudyLog[]
  notes: Record<ISODate, string>
  goals: Goal[]
  wishes: WishItem[]
  mandals: Mandal[]
  mindmaps: MindMap[]
  settings: Settings
}
