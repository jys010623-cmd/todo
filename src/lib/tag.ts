import type { TagColor } from '@/types'

/** 태그 색을 CSS 변수 참조로 변환합니다. 하드코딩된 HEX 를 컴포넌트에 두지 않기 위함입니다. */
export function tagVar(tag: TagColor): string {
  return `var(--tag-${tag})`
}

/** 칩 배경용 옅은 변형 — 글자를 위에 얹어도 읽히는 농도입니다. */
export function tagSoftVar(tag: TagColor): string {
  return `var(--tag-${tag}-soft)`
}

/** soft 배경 위에 올리는 글자색 — solid 를 그대로 쓰면 대비가 모자랍니다. */
export function tagTextVar(tag: TagColor): string {
  return `var(--tag-${tag}-text)`
}
