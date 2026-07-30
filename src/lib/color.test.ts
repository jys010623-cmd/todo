import { describe, expect, it } from 'vitest'

import { INK, PAPER, contrast, luminance, parseHex, readableOn } from './color'

describe('parseHex', () => {
  it('여섯 자리', () => {
    expect(parseHex('#6366f1')).toEqual([0x63, 0x66, 0xf1])
  })

  it('세 자리도 펴서 읽는다', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('#000')).toEqual([0, 0, 0])
  })

  it('# 이 없어도, 대문자여도', () => {
    expect(parseHex('6366F1')).toEqual([0x63, 0x66, 0xf1])
  })

  it.each(['', '#12345', '#gggggg', 'rebeccapurple', 'rgb(1,2,3)'])('%s 는 못 읽는다', (v) => {
    expect(parseHex(v)).toBeNull()
  })
})

describe('luminance', () => {
  it('흰색이 1, 검정이 0', () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5)
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 5)
  })
})

describe('contrast', () => {
  it('흰색과 검정은 21:1', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1)
  })

  it('순서를 바꿔도 같다', () => {
    expect(contrast('#6366f1', '#ffffff')).toBeCloseTo(contrast('#ffffff', '#6366f1'), 5)
  })

  it('같은 색이면 1:1', () => {
    expect(contrast('#6366f1', '#6366f1')).toBeCloseTo(1, 5)
  })
})

describe('readableOn — 색 위에 얹을 글자색', () => {
  it.each([
    ['인디고', '#4f46e5', PAPER],
    ['블루', '#2563eb', PAPER],
    ['에메랄드', '#10b981', INK],
    ['로즈', '#f43f5e', INK],
    ['앰버', '#f59e0b', INK],
    ['잉크', '#18181b', PAPER],
  ])('%s 위에는 알맞은 글자색', (_name, accent, want) => {
    expect(readableOn(accent)).toBe(want)
  })

  it('고른 글자색이 늘 4.5:1 을 넘긴다', () => {
    const accents = ['#4f46e5', '#2563eb', '#10b981', '#f43f5e', '#f59e0b', '#18181b']
    for (const accent of accents) {
      expect(contrast(accent, readableOn(accent))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('아주 밝은 색에는 먹, 아주 어두운 색에는 흰 글자', () => {
    expect(readableOn('#ffff00')).toBe(INK)
    expect(readableOn('#000080')).toBe(PAPER)
  })

  it('알 수 없는 값이면 흰 글자로 둔다 — 액센트는 대개 중간톤 이상입니다', () => {
    expect(readableOn('nope')).toBe(PAPER)
  })
})
