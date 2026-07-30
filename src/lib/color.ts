/**
 * 색 위에 얹을 글자색 고르기.
 *
 * 액센트를 전부 '흰 글자가 읽히는 어두운 색' 으로 맞추면 초록·주황이 탁해집니다.
 * 색은 알아보기 쉬운 값 그대로 두고, 글자색을 색에 맞춰 고르는 편이 맞습니다.
 * Material 의 on-primary, iOS 의 label 이 하는 일과 같습니다.
 */

/** 지면과 글자에 쓰는 두 극단 — tokens.css 의 값과 같아야 합니다. */
export const INK = '#18181b'
export const PAPER = '#ffffff'

export function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace('#', '')
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [ra, rb] = [parseHex(a), parseHex(b)]
  if (!ra || !rb) return 1
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 이 색 위에 흰 글자와 먹 글자 중 무엇이 더 잘 읽히는지.
 * 알 수 없는 값이면 흰 글자로 둡니다 — 액센트는 대개 중간톤 이상이라 그편이 안전합니다.
 */
export function readableOn(background: string): string {
  if (!parseHex(background)) return PAPER
  return contrast(background, PAPER) >= contrast(background, INK) ? PAPER : INK
}
