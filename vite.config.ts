import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // server.proxy удалён (Task 2.6): /api и /uploads больше не проксируются на
  // http://localhost:3001 — backend удалён в Task 2.5, все данные приходят из
  // src/data/*.json через sync-импорты (см. src/lib/api.ts shim и
  // src/types/content.ts). /uploads/* ассеты (если есть) читаются напрямую
  // из public/ — без proxy.
  //
  // /hr-widget → https://homereserve.ru — прокси для виджета RealtyCalendar.
  // homereserve.ru имеет гео-блок по IP, с российских адресов работает,
  // с VPN/иностранных — connection timeout. На dev vite делает тот же proxy,
  // что Apache делает на проде (см. ТЗ агенту для httpd-vhosts.conf):
  // iframe из Cabins.tsx грузит /hr-widget-loader.html, внутри идёт
  // /hr-widget/widget.js → прокси → https://homereserve.ru/widget.js.
  // changeOrigin: true сохраняет same-origin, чтобы виджет мог делать
  // fetch'и к /hr-widget/api/* → прокси → homereserve.ru без CORS-проблем.
  server: {
    proxy: {
      "/hr-widget": {
        target: "https://homereserve.ru",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
