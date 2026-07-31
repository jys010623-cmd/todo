/*
 * 앱 아이콘을 만듭니다.
 *
 * 홈 화면에 붙이려면 manifest 가 192·512 픽셀 아이콘을 요구합니다. 그림 파일을
 * 저장소에 넣어 두면 팔레트를 갈 때마다 손으로 다시 그려야 해서, 여기서 만듭니다.
 * 색을 바꾸려면 ACCENT 만 고치고 `node scripts/make-icons.mjs` 를 다시 돌리세요.
 *
 * 라이브러리 없이 PNG 를 직접 씁니다 — 아이콘 두 장 때문에 의존성을 늘리지 않습니다.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/** tokens.css 의 --accent-base 와 같은 값 */
const ACCENT = [0x4f, 0x46, 0xe5]
const INK = [0xff, 0xff, 0xff]

const CRC = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return (buf) => {
    let c = -1
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
})()

function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(CRC(body))
  return Buffer.concat([head, body, crc])
}

function png(size, pixel) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 채널당 8비트
  ihdr[9] = 6 // RGBA
  // 각 줄 앞에 필터 바이트 0 — 필터를 안 쓰면 압축은 덜 되지만 계산이 단순합니다.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let at = 0
  for (let y = 0; y < size; y++) {
    raw[at++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      raw[at++] = r
      raw[at++] = g
      raw[at++] = b
      raw[at++] = a
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * 지면 위의 괘선 세 줄.
 *
 * 배경을 꽉 채웁니다 — maskable 아이콘은 기기가 모서리를 잘라내므로, 여백을 두면
 * 둥근 사각형 안에 또 둥근 사각형이 들어간 모양이 됩니다.
 */
function paper(x, y, size) {
  const u = size / 32 // 32칸 격자로 두고 그립니다
  const gx = x / u
  const gy = y / u

  // 괘선 세 줄 — 마지막 줄은 짧게 두어 '적다 만 것' 처럼 보이게 합니다.
  const rules = [
    { y: 11, from: 8, to: 24 },
    { y: 16, from: 8, to: 24 },
    { y: 21, from: 8, to: 18 },
  ]
  for (const r of rules) {
    if (gy >= r.y && gy < r.y + 1.6 && gx >= r.from && gx < r.to) return [...INK, 255]
  }
  return [...ACCENT, 255]
}

const out = fileURLToPath(new URL('../public', import.meta.url))
mkdirSync(out, { recursive: true })

for (const size of [192, 512]) {
  writeFileSync(`${out}/icon-${size}.png`, png(size, paper))
  console.log(`icon-${size}.png`)
}
