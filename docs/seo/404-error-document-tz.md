# ТЗ для агента на сервере: ErrorDocument 404 → /404/index.html

**Дата:** 2026-09-02
**Сайт:** zvuki-lesa.ru
**Сервер:** Apache (Win64), конфиг в `httpd-vhosts.conf`

---

## 1. Контекст — зачем

Без `ErrorDocument`:
- Реально несуществующие URL (например, `/foo/bar/`) попадают в SPA-fallback
- Apache возвращает HTTP **200** с `index.html` (это и есть «мягкий 404» в глазах Яндекса)
- React Router не сматчит маршрут, но SPA всё равно отдаёт 200
- Яндекс/Google не понимают, что страница не существует → индексируют мусор

С `ErrorDocument 404 /404/index.html`:
- Apache возвращает HTTP **404** + SPA-страница с NotFoundPage
- React Router рендерит `<NotFoundPage />` через catch-all маршрут `*`
- Поисковик видит реальный 404 → быстро убирает URL из индекса
- Пользователь видит полезную страницу с CTA на главную

---

## 2. Предусловие

- На проде уже внедрена Phase 1 (canonical/sitemap единый формат со слэшем)
- В React-коде есть `src/pages/NotFoundPage.tsx` и catch-all `<Route path="*" element={<NotFoundPage />} />` (коммит в `feature/skrolavito`)
- `STATIC_ROUTES = ['/', '/blog', '/404']` — `/404` попадает в prerender → `dist/404/index.html` (проверить после `npm run build`)
- На проде есть `dist/404/index.html` (то есть последний билд содержал `/404`)

---

## 3. Шаги на сервере

### 3.1. Бэкап текущего конфига

```bash
# Найти httpd-vhosts.conf:
find /c/Apache24 -name "httpd-vhosts.conf" 2>/dev/null
find /c/Server -name "httpd-vhosts.conf" 2>/dev/null

# Бэкап:
cp httpd-vhosts.conf httpd-vhosts.conf.bak-$(date +%Y%m%d)
```

### 3.2. Проверить наличие dist/404/index.html

```bash
# Должен существовать после билда с /404 в STATIC_ROUTES:
ls -la "<путь-к-фронтенду>/dist/404/index.html"
# На Windows-сервере обычно E:\ZvukiLesa\public\404\index.html
# (см. server.ts:32 — FRONTEND_PUBLIC = ../public относительно cwd api/)
```

Если файла нет — значит фронт ещё не собран с `/404` в prerender. Не применять правило до того, как соберётся новый билд.

### 3.3. Добавить ErrorDocument

В файле `httpd-vhosts.conf` найти секцию `<VirtualHost>` для `zvuki-lesa.ru` (или `*:443`, если SSL там). Добавить **внутри** этой секции, рядом с другими директивами обработки ошибок (если есть) или сразу после `ServerName`:

```apache
# ─────────────────────────────────────────────────────────────
# SEO (2026-09-02): системная 404-страница.
# React Router catch-all (`<Route path="*" />`) рендерит
# NotFoundPage, который ставит robots=noindex/nofollow.
# Без ErrorDocument Apache отдаёт HTTP 200 на любой URL
# через SPA-fallback → Яндекс считает это «мягким 404» и
# индексирует мусор. С ErrorDocument — реальный HTTP 404.
# ─────────────────────────────────────────────────────────────

ErrorDocument 404 /404/index.html
```

**Важно:** путь `/404/index.html` от корня сайта (не от файловой системы). Apache резолвит его относительно `DocumentRoot`.

### 3.4. Проверить синтаксис и перезапустить

```bash
"C:\Apache24\bin\httpd.exe" -t
# Ожидаем: Syntax OK

"C:\Apache24\bin\httpd.exe" -k restart
# (или через services.msc → Apache2.4 → Restart)
```

### 3.5. Smoke-проверка

```bash
# 1. Несуществующий URL — должен вернуть 404 + SPA-страница:
curl -I https://zvuki-lesa.ru/foo/bar/baz/
# Ожидаем:
#   HTTP/1.1 404 Not Found
#   Content-Type: text/html

# 2. Содержимое страницы должно содержать 404-маркеры:
curl -s https://zvuki-lesa.ru/foo/bar/baz/ | grep -i "404\|страница не найдена"
# Ожидаем: HTML-ответ с текстом «404» и «Страница не найдена»

# 3. Реальные страницы — НЕ должны быть затронуты:
curl -I https://zvuki-lesa.ru/
# Ожидаем: HTTP/1.1 200 OK

curl -I https://zvuki-lesa.ru/blog/
# Ожидаем: HTTP/1.1 200 OK

curl -I https://zvuki-lesa.ru/booking/shale-uyut/
# Ожидаем: HTTP/1.1 200 OK

# 4. 301-редиректы (если уже применены из Phase 2) — тоже не затронуты:
curl -I https://zvuki-lesa.ru/seo/zhivotnye-adygeya-fauna/
# Ожидаем: HTTP/1.1 301 Moved Permanently
#          Location: https://zvuki-lesa.ru/blog/zhivotnye-adygeya-gid/

# 5. Прямой запрос /404/ — должен быть 200 (это реальная страница):
curl -I https://zvuki-lesa.ru/404/
# Ожидаем: HTTP/1.1 200 OK
```

### 3.6. robots.txt

Убедиться, что `robots.txt` НЕ запрещает `/404/` — он там не нужен, но если что — Яндекс его не заиндексирует (он noindex).

Уже настроено правильно (`/admin` и `/api/` запрещены, остальное allow).

---

## 4. Откат

```bash
cp httpd-vhosts.conf.bak-<дата> httpd-vhosts.conf
"C:\Apache24\bin\httpd.exe" -t
"C:\Apache24\bin\httpd.exe" -k restart

# Проверить, что 404 снова возвращают 200:
curl -I https://zvuki-lesa.ru/foo/bar/baz/
# Ожидаем: HTTP/1.1 200 OK (НЕ 404)
```

---

## 5. Чего НЕ делать

- ❌ **НЕ ставить `ErrorDocument 404 https://zvuki-lesa.ru/404/`** — это приведёт к бесконечному циклу редиректов (404 → редирект на /404/ → если Apache считает /404/ тоже 404 → опять редирект). Только **относительный** путь `/404/index.html`.
- ❌ **НЕ использовать `Redirect 404`** — это редирект на 404 код, а не отдача 404 с контентом. Нужен именно `ErrorDocument`.
- ❌ **НЕ ставить ErrorDocument в `.htaccess`** — AllowOverride None, файл игнорируется. Только в `httpd-vhosts.conf`.
- ❌ **НЕ менять логику SPA-fallback на бэке** (`server.ts:80-84`) — там сейчас catch-all GET → отдаёт `index.html`. Это нужно для `/admin/...` (роуты клиента). 404 для статики обрабатывается на уровне Apache выше.
- ❌ **НЕ редиректить 404 на главную (301)** — Яндекс должен видеть реальный 404, иначе он не сможет правильно обработать битые ссылки.

---

## 6. Проверка после внедрения (через 3-5 дней)

В Яндекс.Вебмастере:
- **Мониторинг → Страницы в поиске → Исключённые страницы** — должны появиться 404 URL с пометкой «страница не найдена» (это значит Яндекс увидел HTTP 404)
- **Мониторинг → Переобход страниц** — попробовать отправить битый URL, проверить что робот видит 404
- Если в поиске остаются старые мусорные URL с префиксами типа `/foo/bar/` без нашего контента — это нормально, они будут уходить постепенно (1-2 апа Яндекса)

В Google Search Console (если подключена):
- **Покрытие → Исключено → Not Found (404)** — должны появиться страницы

---

## 7. Порядок внедрения

1. Сначала — Phase 1 (canonical/sitemap) внедрена и переиндексирована (≥ 7 дней)
2. **Это ТЗ — ErrorDocument 404** — можно применять сразу после билда с `/404`
3. После — Phase 2 (301 по дублям, отдельный ТЗ — `phase2-301-redirects-tz.md`)

Можно комбинировать: один раз перезапустить Apache с обоими изменениями (ErrorDocument + 301). Порядок директив внутри VirtualHost не критичен (Apache применяет их все), но логически сначала `ErrorDocument`, потом `RedirectMatch`.

---

**Контакт для вопросов:** [владелец сайта, @Flusk01 в Telegram]
