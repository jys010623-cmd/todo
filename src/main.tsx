import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/App'
import { PlannerProvider } from '@/store/PlannerContext'
import '@/styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root 엘리먼트를 찾을 수 없습니다.')

createRoot(root).render(
  <StrictMode>
    <PlannerProvider>
      <App />
    </PlannerProvider>
  </StrictMode>,
)

/*
 * 인터넷 없이도 열리게.
 *
 * 개발 중에는 달지 않습니다 — 캐시가 끼면 방금 고친 것이 안 보이고, 그 원인을
 * 찾는 데 시간을 다 씁니다. 배포된 것에서만 돕니다.
 *
 * 등록이 실패해도 앱은 그대로 동작합니다. 오프라인은 덤이지 조건이 아닙니다.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
