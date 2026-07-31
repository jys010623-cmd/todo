import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'

import { readableOn } from '@/lib/color'
import { isSameMonth, monthGrid, timeToMinutes, todayISO, weekDays } from '@/lib/date'
import { expandEvents } from '@/lib/repeat'
import { formatHash, parseHash } from '@/lib/route'
import { loadData, saveData } from '@/lib/storage'
import type { EventOccurrence, ISODate, PlannerData, Subject, Todo, ViewId } from '@/types'
import { createInitialData } from './initial'
import { reducer, type Action } from './reducer'

/**
 * 되돌릴 수 있게 해 둘 동작들.
 *
 * 삭제 버튼은 전부 × 하나라 손이 미끄러지기 쉽고, 만다라트 81칸이나 마인드맵 가지처럼
 * 한 번에 많이 사라지는 것도 있습니다. 지울 때마다 묻는 대신 되돌릴 수 있게 했습니다 —
 * 이 앱은 모달을 쓰지 않고, 확인 창은 결국 습관적으로 넘기게 됩니다.
 */
const UNDOABLE: Partial<Record<Action['type'], string>> = {
  DELETE_EVENT: '일정을 지웠습니다',
  /*
   * 반복 일정의 × 는 그 날 하나만 뺍니다. 지우기와 같은 자리, 같은 모양의 버튼인데
   * 이것만 되돌릴 수 없으면 손이 미끄러진 그 날이 그대로 사라집니다 —
   * 건너뛴 날을 되살리는 자리도 따로 없습니다.
   */
  SKIP_OCCURRENCE: '이 날을 건너뛰었습니다',
  DELETE_TODO: '할 일을 지웠습니다',
  DELETE_SUBJECT: '과목을 지웠습니다',
  DELETE_GOAL: '목표를 지웠습니다',
  DELETE_GOAL_STEP: '단계를 지웠습니다',
  DELETE_WISH: '위시리스트 항목을 지웠습니다',
  DELETE_MANDAL: '만다라트를 지웠습니다',
  DELETE_MINDMAP: '마인드맵을 지웠습니다',
  DELETE_MIND_NODE: '가지를 지웠습니다',
  MOVE_TODOS: '할 일을 옮겼습니다',
  REPLACE: '기록을 바꿨습니다',

  /*
   * 고친 것도 되돌립니다.
   *
   * 지우는 것만 되돌릴 수 있으면, 주간에서 일정을 잘못 끌어 옮겼을 때 원래 시각이
   * 어디였는지 알 방법이 없습니다. 지운 것보다 오히려 찾기 어렵습니다 —
   * 사라지지 않고 엉뚱한 자리에 그대로 있어서 잘못된 줄도 모르고 지나갑니다.
   *
   * 한 번에 하나씩 끝나는 것만 넣습니다. 글자를 칠 때마다 오는 것(SET_NOTE)이나
   * 다시 눌러 되돌아가는 것(TOGGLE_*, SET_SETTINGS)은 넣지 않습니다 —
   * 앞의 것은 한 글자마다 막대가 뜨고, 뒤의 것은 되돌릴 것이 이미 눈앞에 있습니다.
   */
  UPDATE_EVENT: '일정을 고쳤습니다',
  UPDATE_TODO: '할 일을 고쳤습니다',
  UPDATE_SUBJECT: '과목을 고쳤습니다',
  UPDATE_GOAL: '목표를 고쳤습니다',
  UPDATE_GOAL_STEP: '단계를 고쳤습니다',
  UPDATE_WISH: '위시리스트 항목을 고쳤습니다',
  UPDATE_MANDAL: '만다라트를 고쳤습니다',
  SET_MANDAL_CELL: '만다라트 칸을 고쳤습니다',
  UPDATE_MINDMAP: '마인드맵을 고쳤습니다',
  UPDATE_MIND_NODE: '가지를 고쳤습니다',
  MOVE_MIND_NODE: '가지를 옮겼습니다',
  REPARENT_MIND_NODE: '가지를 옮겨 붙였습니다',
  RESET_MIND_LAYOUT: '배치를 처음으로 되돌렸습니다',
}

/** 사라진 줄 모르고 지나칠 만큼 짧지 않게, 방해되지 않을 만큼 길지 않게. */
const UNDO_MS = 8000

export interface UndoState {
  /** 동작 직전의 상태 전체 */
  data: PlannerData
  label: string
}

interface PlannerContextValue {
  data: PlannerData
  dispatch: Dispatch<Action>

  view: ViewId
  setView: (v: ViewId) => void

  /** 오른쪽 Planner 와 모든 뷰가 공유하는 기준 날짜 */
  selectedDate: ISODate
  selectDate: (d: ISODate) => void

  /** 월간 달력이 보여주는 달 (해당 달의 임의의 날짜) */
  cursorMonth: ISODate
  setCursorMonth: (d: ISODate) => void

  /** 반복이 펼쳐진 뒤의 모습 — 지우거나 고칠 때는 sourceId 를 씁니다. */
  eventsByDate: Map<ISODate, EventOccurrence[]>
  todosByDate: Map<ISODate, Todo[]>
  studyMinutesByDate: Map<ISODate, number>
  subjectById: Map<string, Subject>

  /** 오늘 이전에 적혔는데 아직 안 끝난 할 일 — 오래된 것부터 */
  overdueTodos: Todo[]

  /** 되돌릴 것이 없으면 null */
  undoState: UndoState | null
  undo: () => void
  dismissUndo: () => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

function init(): PlannerData {
  return loadData() ?? createInitialData()
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [data, rawDispatch] = useReducer(reducer, undefined, init)

  // 처음 열 때는 주소가 먼저입니다 — 북마크나 새로고침으로 들어와도 그 화면이 나와야 합니다.
  const initial = parseHash(window.location.hash)
  const [view, setView] = useState<ViewId>(initial?.view ?? 'home')
  const [selectedDate, setSelectedDate] = useState<ISODate>(initial?.date ?? todayISO)
  const [cursorMonth, setCursorMonth] = useState<ISODate>(initial?.date ?? todayISO)

  // 저장은 debounce 300ms — 타이핑 중 매 글자 저장을 피합니다.
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveData(data), 300)
    return () => window.clearTimeout(saveTimer.current)
  }, [data])

  /*
   * 화면이 바뀌면 주소도 따라갑니다.
   *
   * 화면을 옮길 때는 기록을 쌓고(push), 같은 화면에서 날짜만 바꿀 때는 덮어씁니다
   * (replace). 날짜마다 기록을 쌓으면 뒤로가기를 열 번 눌러야 앞 화면으로 돌아갑니다.
   */
  const lastView = useRef(view)
  useEffect(() => {
    const next = formatHash(view, selectedDate)
    if (window.location.hash === next) return
    if (lastView.current === view) window.history.replaceState(null, '', next)
    else window.history.pushState(null, '', next)
    lastView.current = view
  }, [view, selectedDate])

  // 어디서 무엇을 하고 있든 찾기로 갑니다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'k' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      setView('search')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 뒤로·앞으로 가기 — 모바일에서 뒤로가기가 앱을 나가 버리지 않게 합니다.
  useEffect(() => {
    const onHashChange = () => {
      const route = parseHash(window.location.hash)
      if (!route) return
      lastView.current = route.view
      setView(route.view)
      if (route.date) {
        setSelectedDate(route.date)
        setCursorMonth((prev) => (isSameMonth(prev, route.date as ISODate) ? prev : route.date!))
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  /*
   * 액센트를 CSS 변수로 주입합니다. --accent 는 테마가 이 값에서 계산합니다.
   * 그 위에 얹을 글자색도 함께 넘깁니다 — 색마다 흰 글자가 맞을 때도, 먹 글자가
   * 맞을 때도 있습니다(에메랄드·앰버는 먹). CSS 만으로는 밝기를 보고 고를 수 없습니다.
   */
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent-base', data.settings.accent)
    root.style.setProperty('--accent-contrast-base', readableOn(data.settings.accent))
  }, [data.settings.accent])

  /*
   * 테마를 :root 의 data-theme 로 걸어 둡니다.
   * 'system' 이면 기기 설정을 따라가되, 설정이 바뀌는 순간에도 따라가야 하므로
   * 한 번 읽고 마는 것이 아니라 계속 듣습니다 — 밤에 저절로 어두워집니다.
   */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = data.settings.theme === 'system' ? media.matches : data.settings.theme === 'dark'
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      // 모바일 브라우저의 주소창까지 지면 색에 맞춥니다.
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', dark ? '#131315' : '#f7f7f6')
    }

    apply()
    if (data.settings.theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [data.settings.theme])

  const selectDate = useMemo(
    () => (d: ISODate) => {
      setSelectedDate(d)
      setCursorMonth((prev) => (isSameMonth(prev, d) ? prev : d))
    },
    [],
  )

  // ── 되돌리기 ────────────────────────────────────────────
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)

  // dispatch 를 memo 로 감싸도 스냅샷은 늘 최신이어야 해서 ref 로 들고 있습니다.
  const latest = useRef(data)
  latest.current = data

  // 되돌릴 때 setState 업데이터 안에서 dispatch 하면 StrictMode 에서 두 번 실행됩니다.
  const pending = useRef<UndoState | null>(null)

  const helpers = useMemo(() => {
    const clearTimer = () => window.clearTimeout(undoTimer.current)

    const remember = (next: UndoState | null) => {
      pending.current = next
      setUndoState(next)
      clearTimer()
      if (next) undoTimer.current = window.setTimeout(() => remember(null), UNDO_MS)
    }

    return {
      dispatch: (action: Action) => {
        const label = UNDOABLE[action.type]
        if (label) remember({ data: latest.current, label })
        rawDispatch(action)
      },
      undo: () => {
        const snapshot = pending.current
        // 되돌리기 자체가 또 되돌릴 거리를 만들지 않도록 원래 dispatch 를 씁니다.
        if (snapshot) rawDispatch({ type: 'REPLACE', data: snapshot.data })
        remember(null)
      },
      dismissUndo: () => remember(null),
      clearTimer,
    }
  }, [])

  const { dispatch, undo, dismissUndo } = helpers
  useEffect(() => helpers.clearTimer, [helpers])

  /**
   * 반복은 규칙만 저장돼 있어 그릴 때 펼쳐야 합니다.
   * 끝없이 반복되는 것을 다 만들 수는 없으니, 지금 화면이 그릴 날짜만 물어봅니다 —
   * 이번 달 격자, 선택한 주, 그리고 오늘.
   */
  const visibleDates = useMemo(() => {
    const dates = new Set<ISODate>([
      ...monthGrid(cursorMonth, data.settings.weekStart),
      ...weekDays(selectedDate, data.settings.weekStart),
      selectedDate,
      todayISO(),
    ])
    return dates
  }, [cursorMonth, selectedDate, data.settings.weekStart])

  const eventsByDate = useMemo(() => {
    const map = new Map<ISODate, EventOccurrence[]>()
    for (const e of expandEvents(data.events, visibleDates)) {
      const list = map.get(e.date)
      if (list) list.push(e)
      else map.set(e.date, [e])
    }
    // 시간순 — 시간 없는 일정은 뒤로
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (!a.start && !b.start) return 0
        if (!a.start) return 1
        if (!b.start) return -1
        return timeToMinutes(a.start) - timeToMinutes(b.start)
      })
    }
    return map
  }, [data.events, visibleDates])

  const todosByDate = useMemo(() => {
    const map = new Map<ISODate, Todo[]>()
    for (const t of data.todos) {
      const list = map.get(t.date)
      if (list) list.push(t)
      else map.set(t.date, [t])
    }
    /*
     * 시각을 정한 것이 먼저, 이른 것부터. 안 정한 것은 적은 순서대로 뒤에 붙습니다.
     * 시각이 있는 것과 없는 것을 섞어 놓으면 '오늘 몇 시에 뭘 하기로 했더라' 를
     * 목록 전체에서 찾아야 합니다.
     */
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.time && b.time) return timeToMinutes(a.time) - timeToMinutes(b.time)
        if (a.time) return -1
        if (b.time) return 1
        return a.order - b.order
      })
    }
    return map
  }, [data.todos])

  const studyMinutesByDate = useMemo(() => {
    const map = new Map<ISODate, number>()
    for (const l of data.studyLogs) {
      map.set(l.date, (map.get(l.date) ?? 0) + l.minutes)
    }
    return map
  }, [data.studyLogs])

  const subjectById = useMemo(
    () => new Map(data.subjects.map((s) => [s.id, s])),
    [data.subjects],
  )

  /**
   * 지난 날짜의 안 끝난 할 일.
   * 이게 없으면 하루가 지나는 순간 어느 화면에도 나오지 않아, 달력을 거슬러 올라가야만
   * 다시 만납니다. 'YYYY-MM-DD' 는 사전순이 곧 날짜순이라 그대로 비교합니다.
   */
  const overdueTodos = useMemo(() => {
    const today = todayISO()
    return data.todos
      .filter((t) => !t.done && t.date < today)
      .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
  }, [data.todos])

  const value: PlannerContextValue = {
    data,
    dispatch,
    view,
    setView,
    selectedDate,
    selectDate,
    cursorMonth,
    setCursorMonth,
    eventsByDate,
    todosByDate,
    studyMinutesByDate,
    subjectById,
    overdueTodos,
    undoState,
    undo,
    dismissUndo,
  }

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}
