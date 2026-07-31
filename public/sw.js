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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add(SHELL)),
  )
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
        .catch(() => caches.match(SHELL).then((hit) => hit ?? Response.error())),
    )
    return
  }

  /*
   * 나머지는 담아 둔 것을 먼저 씁니다.
   * 빌드 산출물은 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀝니다 — 같은 이름이면
   * 같은 내용이라 굳이 다시 받을 이유가 없습니다.
   */
  event.respondWith(
    caches.match(request).then((hit) => {
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
