import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * 색 토큰의 대비를 지킵니다.
 *
 * 팔레트를 갈아 끼울 때마다 사람 눈으로는 '선명해졌다' 고 느끼지만, 선명한 색일수록
 * 흰 지면에서 대비가 떨어집니다. 눈이 아니라 숫자가 잡아 주도록 여기 둡니다.
 * tokens.css 를 직접 읽으므로 값을 고치면 이 테스트가 바로 따라옵니다.
 */

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

/** :root 또는 :root[data-theme='dark'] 블록에서 --이름: 값 을 뽑습니다. */
function tokensOf(selector: string): Record<string, string> {
  const at = css.indexOf(selector)
  if (at === -1) throw new Error(`${selector} 를 찾지 못했습니다`)
  const body = css.slice(at, css.indexOf('\n}', at))
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim()
  }
  return out
}

const light = tokensOf(':root {')
const dark = tokensOf(":root[data-theme='dark']")

type RGB = [number, number, number]

function parseHex(hex: string): RGB {
  const raw = hex.replace('#', '').trim()
  // #fff 처럼 세 자리로 적은 것도 옵니다 — 펴 주지 않으면 NaN 이 됩니다.
  const s = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB
}

function blend(a: RGB, b: RGB, pct: number): RGB {
  const p = pct / 100
  return a.map((v, i) => v * p + b[i] * (1 - p)) as RGB
}

/** hex 이거나 color-mix(in srgb, X n%, Y) 인 값을 실제 색으로 풉니다. */
function resolve(value: string, scope: Record<string, string>, depth = 0): RGB {
  if (depth > 6) throw new Error(`너무 깊게 참조합니다: ${value}`)
  const v = value.trim()

  if (v.startsWith('#')) return parseHex(v)

  const varMatch = v.match(/^var\((--[\w-]+)\)$/)
  if (varMatch) return resolve(scope[varMatch[1]] ?? light[varMatch[1]], scope, depth + 1)

  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+?)\)$/)
  if (mix) {
    return blend(resolve(mix[1], scope, depth + 1), resolve(mix[3], scope, depth + 1), Number(mix[2]))
  }
  throw new Error(`풀 수 없는 색: ${value}`)
}

function luminance([r, g, b]: RGB): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TAGS = ['mint', 'blue', 'lilac', 'coral', 'honey'] as const

describe.each([
  ['밝은 테마', light],
  ['어두운 테마', dark],
])('%s — 대비', (_name, scope) => {
  const at = (token: string) => resolve(scope[token] ?? light[token], scope)
  const surface = () => at('--surface')

  it.each(['--text-1', '--text-2', '--text-3'])('%s 는 본문으로 읽힌다 (4.5:1)', (token) => {
    expect(contrast(at(token), surface())).toBeGreaterThanOrEqual(4.5)
  })

  it('text-4 는 장식용이라 낮아도 되지만 아주 사라지지는 않는다', () => {
    expect(contrast(at('--text-4'), surface())).toBeGreaterThanOrEqual(1.8)
  })

  it('액센트 위의 글자가 읽힌다', () => {
    expect(contrast(at('--accent-contrast'), at('--accent'))).toBeGreaterThanOrEqual(4.5)
  })

  it('오늘 표식 안의 숫자가 읽힌다', () => {
    expect(contrast(at('--today-contrast'), at('--today'))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(TAGS)('tag-%s 는 점·막대로 형태가 보인다 (3:1)', (tag) => {
    expect(contrast(at(`--tag-${tag}`), surface())).toBeGreaterThanOrEqual(3)
  })

  it.each(TAGS)('tag-%s 칩의 글자가 읽힌다 (4.5:1)', (tag) => {
    expect(contrast(at(`--tag-${tag}-text`), at(`--tag-${tag}-soft`))).toBeGreaterThanOrEqual(4.5)
  })

  it('칩 배경이 지면과 구분된다', () => {
    for (const tag of TAGS) {
      // 너무 옅으면 칩인지 모르고, 너무 진하면 글자가 안 읽힙니다.
      expect(contrast(at(`--tag-${tag}-soft`), surface())).toBeGreaterThan(1.02)
    }
  })
})

describe('팔레트 자체', () => {
  it('설정의 액센트 후보가 모두 흰 글자를 받쳐 준다', () => {
    /*
     * 목록을 여기 베껴 두면 한쪽만 고쳤을 때 그냥 지나갑니다 — 화면 코드에서 읽습니다.
     * 액센트 위에는 흰 글자가 얹히므로, 태그색보다 진해야 합니다.
     */
    const view = readFileSync(
      fileURLToPath(new URL('../views/SettingsView.tsx', import.meta.url)),
      'utf8',
    )
    // 선언부에도 [] 가 있어서(`{ ... }[] = [`) 배열이 열리는 자리부터 잘라야 합니다.
    const from = view.indexOf('= [', view.indexOf('const ACCENTS'))
    const list = view.slice(from, view.indexOf('\n]', from))
    const accents = [...list.matchAll(/value: '(#[0-9a-f]{6})'/g)].map((m) => m[1])

    expect(accents.length).toBeGreaterThanOrEqual(5)
    for (const hex of accents) {
      expect(contrast(parseHex(hex), parseHex('#ffffff'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('지면은 순백이 아니다 — 흰 바탕에 괘선을 그으면 표 계산기처럼 읽힙니다', () => {
    expect(light['--bg']).not.toBe('#ffffff')
    expect(light['--surface']).not.toBe('#ffffff')
  })

  it('어두운 테마는 순검정이 아니다 — 면의 경계가 사라집니다', () => {
    expect(dark['--bg']).not.toBe('#000000')
    expect(dark['--surface']).not.toBe('#000000')
  })
})
