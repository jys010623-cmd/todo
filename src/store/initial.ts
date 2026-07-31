import type { PlannerData, Settings } from '@/types'

/** 설정의 기준값 — 저장된 값이 망가졌을 때 되돌아올 자리이기도 합니다. */
export const DEFAULT_SETTINGS: Settings = {
  // SettingsView 의 ACCENTS 첫 번째와 같아야 합니다 — 다르면 처음 연 사람의 설정에
  // 아무 색도 골라져 있지 않습니다. tokens.test.ts 가 둘이 같은지 봅니다.
  accent: '#4f46e5',
  // 처음에는 기기 설정을 따릅니다 — 고르라고 묻기 전에 이미 맞아 있는 편이 낫습니다.
  theme: 'system',
  // 25분 집중 / 5분 휴식 — 처음 제안된 그대로가 가장 널리 쓰입니다.
  pomodoro: { enabled: false, focusMin: 25, breakMin: 5 },
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
