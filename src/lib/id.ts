let counter = 0

/** 로컬 전용 식별자 — 충돌 회피용 카운터 + 시간 */
export function uid(prefix = 'x'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`
}
