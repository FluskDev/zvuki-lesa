import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initLenis } from '@/lib/lenis'

// Запретить pinch-zoom на мобильных (gesturestart/change/end). Guard на
// наличие document нужен, чтобы тесты Vitest с jsdom не падали на этом
// коде, если кто-то импортирует main.tsx транзитивно.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('gesturestart', (e) => e.preventDefault())
  document.addEventListener('gesturechange', (e) => e.preventDefault())
  document.addEventListener('gestureend', (e) => e.preventDefault())

  document.addEventListener('touchmove', (e) => {
    const touch = (e as TouchEvent & { scale?: number });
    if (touch.scale !== undefined && touch.scale !== 1) {
      e.preventDefault()
    }
  }, { passive: false })
}

// Плавный скролл колесом/тачем через всю сессию. Инициализируем один раз —
// destroyLenis вызывается только в тестах при ручном teardown.
//
// Связь с iframe модуля бронирования: wheel над iframe НЕ доходит до
// window родителя (Chrome focus-iframe забирает событие целиком в документ
// iframe). Поэтому скролл родителя при курсоре над iframe делается ВНУТРИ
// iframe — см. <script> в public/hr-widget-loader.html (capture-listener
// на window iframe-документа форвардит deltaY в parent.scrollBy).
initLenis()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
