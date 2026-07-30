import { uid } from '@/lib/id'
import { descendantIds, findRoot } from '@/lib/mindmap'
import type {
  Goal,
  ISODate,
  Mandal,
  MindMap,
  MindNode,
  PlanEvent,
  PlannerData,
  Settings,
  Subject,
  TagColor,
  Todo,
  WishItem,
  WishKind,
} from '@/types'

/** 만다라트는 항상 세부 목표 8개 × 실행 항목 8개의 빈 칸으로 시작합니다. */
function emptyMandal(title: string): Mandal {
  return {
    id: uid('mdl'),
    title,
    core: '',
    subGoals: Array.from({ length: 8 }, () => ''),
    actions: Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ text: '', done: false })),
    ),
  }
}

/** 마인드맵은 언제나 루트 하나로 시작합니다 — 가운데가 없으면 그릴 것이 없습니다. */
function emptyMindMap(title: string): MindMap {
  return {
    id: uid('mm'),
    title,
    nodes: [{ id: uid('mn'), text: title, order: 0 }],
  }
}

export type Action =
  | { type: 'ADD_EVENT'; date: ISODate; title: string; start?: string; end?: string; tag: TagColor }
  | { type: 'UPDATE_EVENT'; id: string; patch: Partial<PlanEvent> }
  | { type: 'DELETE_EVENT'; id: string }
  | { type: 'ADD_TODO'; date: ISODate; title: string }
  | { type: 'TOGGLE_TODO'; id: string }
  | { type: 'UPDATE_TODO'; id: string; patch: Partial<Todo> }
  | { type: 'DELETE_TODO'; id: string }
  /**
   * 할 일을 다른 날로 옮깁니다. 여러 개를 한 번에 받는 것은 '전부 오늘로' 때문입니다 —
   * 하나씩 dispatch 하면 되돌리기가 마지막 한 건만 되살립니다.
   */
  | { type: 'MOVE_TODOS'; ids: string[]; date: ISODate }
  | { type: 'ADD_SUBJECT'; name: string; tag: TagColor; weeklyGoalMin: number }
  | { type: 'UPDATE_SUBJECT'; id: string; patch: Partial<Subject> }
  | { type: 'DELETE_SUBJECT'; id: string }
  /** minutes 는 증분입니다. 같은 날짜+과목 로그는 하나로 합쳐집니다. */
  | { type: 'LOG_STUDY'; date: ISODate; subjectId: string; minutes: number }
  | { type: 'SET_NOTE'; date: ISODate; text: string }
  | { type: 'ADD_GOAL'; title: string; tag: TagColor }
  | { type: 'UPDATE_GOAL'; id: string; patch: Partial<Goal> }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'ADD_GOAL_STEP'; goalId: string; title: string }
  | { type: 'TOGGLE_GOAL_STEP'; goalId: string; stepId: string }
  | { type: 'UPDATE_GOAL_STEP'; goalId: string; stepId: string; title: string }
  | { type: 'DELETE_GOAL_STEP'; goalId: string; stepId: string }
  | { type: 'ADD_WISH'; title: string; kind: WishKind }
  | { type: 'UPDATE_WISH'; id: string; patch: Partial<WishItem> }
  | { type: 'TOGGLE_WISH'; id: string }
  | { type: 'DELETE_WISH'; id: string }
  | { type: 'ADD_MANDAL'; title: string }
  | { type: 'UPDATE_MANDAL'; id: string; patch: Partial<Mandal> }
  | { type: 'DELETE_MANDAL'; id: string }
  /** 만다라트의 한 칸. sub 가 없으면 핵심, action 이 없으면 세부 목표입니다. */
  | { type: 'SET_MANDAL_CELL'; id: string; sub?: number; action?: number; text: string }
  | { type: 'TOGGLE_MANDAL_ACTION'; id: string; sub: number; action: number }
  | { type: 'ADD_MINDMAP'; title: string }
  | { type: 'UPDATE_MINDMAP'; id: string; patch: Partial<Omit<MindMap, 'nodes'>> }
  | { type: 'DELETE_MINDMAP'; id: string }
  | { type: 'ADD_MIND_NODE'; mapId: string; parentId: string; text: string }
  | { type: 'UPDATE_MIND_NODE'; mapId: string; nodeId: string; patch: Partial<MindNode> }
  /** 노드를 지우면 그 아래 가지도 함께 사라집니다. 루트는 지울 수 없습니다. */
  | { type: 'DELETE_MIND_NODE'; mapId: string; nodeId: string }
  | { type: 'TOGGLE_MIND_NODE'; mapId: string; nodeId: string }
  /** 자동 배치 자리에서 얼마나 옮겨 둘지. 절대 좌표가 아닙니다. */
  | { type: 'MOVE_MIND_NODE'; mapId: string; nodeId: string; dx: number; dy: number }
  | { type: 'RESET_MIND_LAYOUT'; mapId: string }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'REPLACE'; data: PlannerData }

export function reducer(state: PlannerData, action: Action): PlannerData {
  switch (action.type) {
    case 'ADD_EVENT': {
      const title = action.title.trim()
      if (!title) return state
      const event: PlanEvent = {
        id: uid('ev'),
        date: action.date,
        title,
        start: action.start,
        end: action.end,
        tag: action.tag,
      }
      return { ...state, events: [...state.events, event] }
    }

    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      }

    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter((e) => e.id !== action.id) }

    case 'ADD_TODO': {
      const title = action.title.trim()
      if (!title) return state
      const order =
        state.todos.filter((t) => t.date === action.date).reduce((max, t) => Math.max(max, t.order), -1) + 1
      const todo: Todo = { id: uid('td'), date: action.date, title, done: false, order }
      return { ...state, todos: [...state.todos, todo] }
    }

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      }

    case 'UPDATE_TODO':
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }

    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) }

    case 'MOVE_TODOS': {
      const moving = new Set(action.ids)
      if (moving.size === 0) return state

      // 옮겨온 것은 그 날의 맨 뒤에 붙습니다. order 를 그대로 두면
      // 원래 있던 할 일과 번호가 겹쳐 순서가 뒤섞입니다.
      let next =
        state.todos
          .filter((t) => t.date === action.date && !moving.has(t.id))
          .reduce((max, t) => Math.max(max, t.order), -1) + 1

      const order = new Map<string, number>()
      // 옮기기 전의 날짜·순서를 유지한 채 번호만 새로 매깁니다.
      for (const t of state.todos
        .filter((t) => moving.has(t.id))
        .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))) {
        order.set(t.id, next++)
      }

      return {
        ...state,
        todos: state.todos.map((t) =>
          moving.has(t.id) ? { ...t, date: action.date, order: order.get(t.id) ?? t.order } : t,
        ),
      }
    }

    case 'ADD_SUBJECT': {
      const name = action.name.trim()
      if (!name) return state
      const subject: Subject = {
        id: uid('sub'),
        name,
        tag: action.tag,
        weeklyGoalMin: action.weeklyGoalMin,
      }
      return { ...state, subjects: [...state.subjects, subject] }
    }

    case 'UPDATE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }

    case 'DELETE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.id),
        studyLogs: state.studyLogs.filter((l) => l.subjectId !== action.id),
      }

    case 'LOG_STUDY': {
      const existing = state.studyLogs.find(
        (l) => l.date === action.date && l.subjectId === action.subjectId,
      )
      if (existing) {
        const minutes = Math.max(0, existing.minutes + action.minutes)
        return {
          ...state,
          studyLogs: state.studyLogs.map((l) =>
            l.id === existing.id ? { ...l, minutes } : l,
          ),
        }
      }
      if (action.minutes <= 0) return state
      return {
        ...state,
        studyLogs: [
          ...state.studyLogs,
          { id: uid('log'), date: action.date, subjectId: action.subjectId, minutes: action.minutes },
        ],
      }
    }

    case 'SET_NOTE': {
      const notes = { ...state.notes }
      if (action.text.trim()) notes[action.date] = action.text
      else delete notes[action.date]
      return { ...state, notes }
    }

    case 'ADD_GOAL': {
      const title = action.title.trim()
      if (!title) return state
      const order = state.goals.reduce((max, g) => Math.max(max, g.order), -1) + 1
      const goal: Goal = {
        id: uid('goal'),
        title,
        status: 'active',
        tag: action.tag,
        order,
        steps: [],
      }
      return { ...state, goals: [...state.goals, goal] }
    }

    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      }

    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id) }

    case 'ADD_GOAL_STEP': {
      const title = action.title.trim()
      if (!title) return state
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, steps: [...g.steps, { id: uid('step'), title, done: false }] }
            : g,
        ),
      }
    }

    case 'TOGGLE_GOAL_STEP':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? {
                ...g,
                steps: g.steps.map((s) =>
                  s.id === action.stepId ? { ...s, done: !s.done } : s,
                ),
              }
            : g,
        ),
      }

    case 'UPDATE_GOAL_STEP': {
      const title = action.title.trim()
      if (!title) return state
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, steps: g.steps.map((s) => (s.id === action.stepId ? { ...s, title } : s)) }
            : g,
        ),
      }
    }

    case 'DELETE_GOAL_STEP':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, steps: g.steps.filter((s) => s.id !== action.stepId) }
            : g,
        ),
      }

    case 'ADD_WISH': {
      const title = action.title.trim()
      if (!title) return state
      const order =
        state.wishes
          .filter((w) => w.kind === action.kind)
          .reduce((max, w) => Math.max(max, w.order), -1) + 1
      const wish: WishItem = { id: uid('wish'), title, kind: action.kind, done: false, order }
      return { ...state, wishes: [...state.wishes, wish] }
    }

    case 'UPDATE_WISH':
      return {
        ...state,
        wishes: state.wishes.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)),
      }

    case 'TOGGLE_WISH':
      return {
        ...state,
        wishes: state.wishes.map((w) => (w.id === action.id ? { ...w, done: !w.done } : w)),
      }

    case 'DELETE_WISH':
      return { ...state, wishes: state.wishes.filter((w) => w.id !== action.id) }

    case 'ADD_MANDAL': {
      const title = action.title.trim()
      if (!title) return state
      return { ...state, mandals: [...state.mandals, emptyMandal(title)] }
    }

    case 'UPDATE_MANDAL':
      return {
        ...state,
        mandals: state.mandals.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      }

    case 'DELETE_MANDAL':
      return { ...state, mandals: state.mandals.filter((m) => m.id !== action.id) }

    case 'SET_MANDAL_CELL': {
      const text = action.text
      return {
        ...state,
        mandals: state.mandals.map((m) => {
          if (m.id !== action.id) return m
          if (action.sub === undefined) return { ...m, core: text }
          if (action.action === undefined) {
            return { ...m, subGoals: m.subGoals.map((s, i) => (i === action.sub ? text : s)) }
          }
          return {
            ...m,
            actions: m.actions.map((row, i) =>
              i === action.sub
                ? row.map((a, j) => (j === action.action ? { ...a, text } : a))
                : row,
            ),
          }
        }),
      }
    }

    case 'TOGGLE_MANDAL_ACTION':
      return {
        ...state,
        mandals: state.mandals.map((m) =>
          m.id === action.id
            ? {
                ...m,
                actions: m.actions.map((row, i) =>
                  i === action.sub
                    ? row.map((a, j) => (j === action.action ? { ...a, done: !a.done } : a))
                    : row,
                ),
              }
            : m,
        ),
      }

    case 'ADD_MINDMAP': {
      const title = action.title.trim()
      if (!title) return state
      return { ...state, mindmaps: [...state.mindmaps, emptyMindMap(title)] }
    }

    case 'UPDATE_MINDMAP':
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      }

    case 'DELETE_MINDMAP':
      return { ...state, mindmaps: state.mindmaps.filter((m) => m.id !== action.id) }

    case 'ADD_MIND_NODE': {
      const text = action.text.trim()
      if (!text) return state
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) => {
          if (m.id !== action.mapId) return m
          if (!m.nodes.some((n) => n.id === action.parentId)) return m

          const order =
            m.nodes
              .filter((n) => n.parentId === action.parentId)
              .reduce((max, n) => Math.max(max, n.order), -1) + 1

          const node: MindNode = { id: uid('mn'), text, parentId: action.parentId, order }
          // 접힌 부모에 자식을 붙이면 방금 쓴 것이 보이지 않아, 함께 펼칩니다.
          const nodes = m.nodes.map((n) =>
            n.id === action.parentId && n.collapsed ? { ...n, collapsed: false } : n,
          )
          return { ...m, nodes: [...nodes, node] }
        }),
      }
    }

    case 'UPDATE_MIND_NODE':
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) =>
          m.id === action.mapId
            ? {
                ...m,
                nodes: m.nodes.map((n) =>
                  n.id === action.nodeId ? { ...n, ...action.patch } : n,
                ),
              }
            : m,
        ),
      }

    case 'DELETE_MIND_NODE':
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) => {
          if (m.id !== action.mapId) return m
          // 루트를 지우면 나머지가 전부 미아가 됩니다 — 맵 자체를 지우는 것이 그 자리의 일입니다.
          if (findRoot(m.nodes)?.id === action.nodeId) return m

          const doomed = new Set([action.nodeId, ...descendantIds(m.nodes, action.nodeId)])
          return { ...m, nodes: m.nodes.filter((n) => !doomed.has(n.id)) }
        }),
      }

    case 'TOGGLE_MIND_NODE':
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) =>
          m.id === action.mapId
            ? {
                ...m,
                nodes: m.nodes.map((n) =>
                  n.id === action.nodeId ? { ...n, collapsed: !n.collapsed } : n,
                ),
              }
            : m,
        ),
      }

    case 'MOVE_MIND_NODE': {
      // 0 은 '안 옮김' 이므로 굳이 들고 있지 않습니다.
      const dx = Math.round(action.dx) || undefined
      const dy = Math.round(action.dy) || undefined
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) =>
          m.id === action.mapId
            ? {
                ...m,
                nodes: m.nodes.map((n) => (n.id === action.nodeId ? { ...n, dx, dy } : n)),
              }
            : m,
        ),
      }
    }

    case 'RESET_MIND_LAYOUT':
      return {
        ...state,
        mindmaps: state.mindmaps.map((m) =>
          m.id === action.mapId
            ? { ...m, nodes: m.nodes.map(({ dx: _dx, dy: _dy, ...rest }) => rest) }
            : m,
        ),
      }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'REPLACE':
      return action.data

    default:
      return state
  }
}
