/// <reference types="vite/client" />
/// <reference types="vite/types/css-modules.d.ts" />

// Глобальный хук для скролла родительской страницы из overlay-guard'а
// над iframe модуля бронирования (Cabins.tsx). Устанавливается в
// src/lib/lenis.ts через `window.__lenisScrollBy = ...`.
interface Window {
  __lenisScrollBy?: (dy: number) => void;
}