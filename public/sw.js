/*
 * 오프라인.
 *
 * 기록이 전부 이 기기 안에 있는데 정작 앱은 인터넷이 있어야 열렸습니다 — 지하철에서
 * 오늘 할 일을 못 봤습니다.
 *
 * 미리 받아 둘 목록을 적지 않습니다. 빌드마다 파일 이름에 해시가 붙어 목록을 손으로
 * 맞추면 반드시 어긋나고, 어긋난 순간 앱이 통째로 안 열립니다. 대신 한 번 지나간 것을
 * 그때그때 담아 둡니다 — 처음 한 번은 인터넷이 필요하고, 그 뒤로는 없어도 열립니다.
 */

/** 이 값을 올리면 지난 판의 캐시가 통째로 버려집니다. */
const VERSION = 'planme-v1'

/** 앱 껍데기 — 주소가 무엇이든 결국 이 문서 하나로 들어옵니다(해시 라우팅). */
const SHELL = './index.html'

/**
 * 껍데기가 부르는 것들을 미리 받아 둡니다.
 *
 * 처음 열 때는 이 워커가 페이지를 잡기 전에 JS·CSS 가 이미 받아집니다. 그대로 두면
 * 한 번 보고 바로 인터넷이 끊겼을 때 아무것도 안 열립니다 — 두 번째 방문부터만
 * 오프라인이 되는 셈입니다.
 *
 * 목록을 손으로 적지 않고 껍데기에서 읽어 냅니다. 빌드마다 이름에 해시가 붙어
 * 적어 두면 반드시 어긋납니다.
 */
async function warm(cache) {
  const res = await fetch(SHELL, { cache: 'reload' })
  await cache.put(SHELL, res.clone())

  const html = await res.text()
  const urls = new Set()
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const raw = m[1]
    if (!raw || raw.startsWith('#') || raw.endsWith('.html')) continue

    const url = new URL(raw, self.registration.scope)
    /*
     * 파일만 받습니다. preconnect 처럼 주소만 적힌 것을 받으면 엉뚱한 문서가
     * 그 자리에 담겨, 나중에 그 주소로 온 요청에 그것이 나갑니다.
     */
    if (!url.pathname.split('/').pop()?.includes('.')) continue
    urls.add(url.href)
  }

  /*
   * 하나가 실패해도 나머지는 담습니다 — 오프라인은 덤이지 조건이 아닙니다.
   * no-cors 로 받지 않습니다. 그렇게 받은 것은 읽을 수 없는 응답이라, 스타일시트로는
   * 쓰이지 못한 채 자리만 차지합니다.
   */
  await Promise.all(
    [...urls].map((u) =>
      fetch(u)
        .then((r) => (keepable(r) ? cache.put(u, r) : undefined))
        .catch(() => undefined),
    ),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then(warm))
  // 새 판이 준비되면 기다리지 않고 넘깁니다 — 옛 판이 남아 있으면 고친 것이 안 보입니다.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

/** 이 응답을 담아 둘 만한가 — 부분 응답이나 오류를 담으면 다음에 깨진 것이 나옵니다. */
function keepable(response) {
  return response && (response.status === 200 || response.type === 'opaque')
}

/**
 * 담아 둔 것 찾기 — Vary 는 보지 않습니다.
 *
 * 서버가 응답에 'Vary: Origin' 을 붙이면, 캐시는 담을 때와 찾을 때의 Origin 헤더가
 * 같은지까지 따집니다. 미리 받아 둘 때는 주소만 가지고 담아서 그 헤더가 없는데,
 * 정작 브라우저가 보내는 요청(<script crossorigin>)에는 붙습니다 — 주소가 같은데도
 * 못 찾고, 인터넷이 없으면 그대로 빈 화면이 됩니다.
 *
 * 이 앱은 같은 주소에 한 가지만 내주므로 Vary 를 따질 이유가 없습니다.
 */
function stored(request) {
  return caches.match(request, { ignoreVary: true })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  /*
   * 화면을 여는 것(navigate)은 인터넷을 먼저 봅니다.
   * 캐시를 먼저 보면 새로 배포한 판이 안 보이고, 앱은 고쳐지지 않는 것처럼 됩니다.
   * 인터넷이 없으면 담아 둔 껍데기로 엽니다.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (keepable(res)) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(SHELL, copy))
          }
          return res
        })
        .catch(() => stored(SHELL).then((hit) => hit ?? Response.error())),
    )
    return
  }

  /*
   * 나머지는 담아 둔 것을 먼저 씁니다.
   * 빌드 산출물은 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀝니다 — 같은 이름이면
   * 같은 내용이라 굳이 다시 받을 이유가 없습니다.
   */
  event.respondWith(
    stored(request).then((hit) => {
      if (hit) return hit
      return fetch(request)
        .then((res) => {
          if (keepable(res)) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => hit ?? Response.error())
    }),
  )
})
