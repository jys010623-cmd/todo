import type { PlannerData, Settings } from '@/types'

/** 설정의 기준값 — 저장된 값이 망가졌을 때 되돌아올 자리이기도 합니다. */
export const DEFAULT_SETTINGS: Settings = {
  accent: '#6e56cf',
  weekStart: 1,
  hour12: false,
}

/**
 * 처음 열었을 때의 상태 — 비어 있습니다.
 * 샘플로 채워 두면 내 것이 아닌 남의 플래너를 보는 기분이라, 빈 지면에서 시작합니다.
 */
export function createInitialData(): PlannerData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    events: [],
    todos: [],
    subjects: [],
    studyLogs: [],
    notes: {},
    goals: [],
    wishes: [],
    mandals: [],
    mindmaps: [],
  }
}
