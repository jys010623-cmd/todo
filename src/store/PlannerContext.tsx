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

import { isSameMonth, timeToMinutes, todayISO } from '@/lib/date'
import { loadData, saveData } from '@/lib/storage'
import type { ISODate, PlanEvent, PlannerData, Subject, Todo, ViewId } from '@/types'
import { createInitialData } from './initial'
import { reducer, type Action } from './reducer'

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

  eventsByDate: Map<ISODate, PlanEvent[]>
  todosByDate: Map<ISODate, Todo[]>
  studyMinutesByDate: Map<ISODate, number>
  subjectById: Map<string, Subject>
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

function init(): PlannerData {
  return loadData() ?? createInitialData()
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, init)

  const [view, setView] = useState<ViewId>('month')
  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO)
  const [cursorMonth, setCursorMonth] = useState<ISODate>(todayISO)

  // 저장은 debounce 300ms — 타이핑 중 매 글자 저장을 피합니다.
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveData(data), 300)
    return () => window.clearTimeout(saveTimer.current)
  }, [data])

  // 액센트 컬러를 CSS 변수로 주입합니다.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', data.settings.accent)
  }, [data.settings.accent])

  const selectDate = useMemo(
    () => (d: ISODate) => {
      setSelectedDate(d)
      setCursorMonth((prev) => (isSameMonth(prev, d) ? prev : d))
    },
    [],
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<ISODate, PlanEvent[]>()
    for (const e of data.events) {
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
  }, [data.events])

  const todosByDate = useMemo(() => {
    const map = new Map<ISODate, Todo[]>()
    for (const t of data.todos) {
      const list = map.get(t.date)
      if (list) list.push(t)
      else map.set(t.date, [t])
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
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
  }

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider')
  return ctx
}
