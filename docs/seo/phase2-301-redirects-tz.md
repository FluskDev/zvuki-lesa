# ТЗ для агента на сервере: 301-редиректы seo → blog (Phase 2 SEO)

**Дата:** 2026-09-02
**Сайт:** zvuki-lesa.ru
**Сервер:** Apache (Win64), конфиг в `httpd-vhosts.conf` (НЕ `.htaccess` — AllowOverride None, файлы игнорируются)

---

## 1. Контекст — зачем

После аудита Яндекс.Вебмастера выявлены две пары дублей, которые надо схлопнуть:

| SEO-страница (canonical) | Blog-статья (canonical) | Причина |
|---|---|---|
| `/seo/zhivotnye-adygeya-fauna/` | `/blog/zhivotnye-adygeya-gid/` | Blog-версия на позиции 2 в Яндексе; seo — не ранжируется. Оставляем blog. |
| `/seo/kak-dobratsya-do-dahovskoy/` | `/blog/kak-dobratsya-do-dahovskoy/` | Blog-версия в топе; seo — нет. Оставляем blog. |

**Цель:** SEO-версии должны отвечать `301 Moved Permanently` с `Location:` на blog-версию. Это:
- Склеит вес ссылок и поведенческие на blog-статью
- Уберёт ~27 исключений в Вебмастере (canonical/sitemap конфликт + дубли)
- Усилит позиции blog-страниц (которые и так ранжируются)

**Предусловие:** Phase 1 (canonical/sitemap единый формат со слэшем) уже внедрена на прод ≥ 7 дней назад и переиндексирована Яндексом.

---

## 2. Контентная подготовка (делает владелец, НЕ агент)

До того как ставить 301, нужно перенести в blog-черновики блоки, которых там не хватает. Без этого после 301 blog-страницы станут тоньше, чем были seo.

### 2.1. `/blog/zhivotnye-adygeya-gid/`

Из `/seo/zhivotnye-adygeya-fauna/` перенести в blog-черновик:
- **FAQ-блок** (вопросы-ответы о фауне — типовой набор для туристов)
- **Блок «Трансфер от гостевого дома»** (коммерческий — предлагаем гостям трансфер до мест наблюдения за животными)

Файл blog-черновика: `backend/data/seo-drafts/blog/22-zhivotnye-adygeya-gid.json` (опубликован в БД → редактировать через `/admin/blog-posts` или правкой JSON + `npm run seed:drafts`).

### 2.2. `/blog/kak-dobratsya-do-dahovskoy/`

Из `/seo/kak-dobratsya-do-dahovskoy/` перенести в blog-черновик:
- **Коммерческий блок «Трансфер от гостевого дома»** (заказ трансфера из аэропорта/вокзала)

Файл blog-черновика: `backend/data/seo-drafts/blog/06-kak-dobratsya-do-dahovskoy.json`.

**Важно:** переносить только то, что коммерчески полезно и не дублируется. Просто перекопировать весь seo-текст в blog = создать ещё больший дубль. Цель — усилить blog, а не сделать его толще seo.

### 2.3. После переноса

Опубликовать обновлённые blog-черновики через `/admin/blog-posts`, дождаться пока бэкенд отдаст обновлённый контент, и только потом ставить 301.

---

## 3. Шаги на сервере

### 3.1. Бэкап текущего конфига

```bash
# Найти где лежит httpd-vhosts.conf (обычно C:/Apache24/conf/extra/ или conf/vhosts/)
# Уточнить через: httpd -S  (или apachectl -S на Linux)
find /c/Apache24 -name "httpd-vhosts.conf" 2>/dev/null
find /c/Server -name "httpd-vhosts.conf" 2>/dev/null

# Бэкап:
cp httpd-vhosts.conf httpd-vhosts.conf.bak-$(date +%Y%m%d)
```

### 3.2. Добавить редиректы

В файле `httpd-vhosts.conf` найти секцию `<VirtualHost>` для `zvuki-lesa.ru` (или `*:443`, если SSL там). **До** существующих правил Rewrite/Redirect добавить:

```apache
# ─────────────────────────────────────────────────────────────
# SEO Phase 2 (2026-09-02): схлопывание дублей seo→blog
# После Phase 1 (trailing slash canonical/sitemap), через неделю
# переиндексации. Перед 301 в blog перенесены FAQ и блок
# «трансфер от гостевого дома».
# ─────────────────────────────────────────────────────────────

# /seo/zhivotnye-adygeya-fauna/ → /blog/zhivotnye-adygeya-gid/
# (blog уже на 2-м месте в Яндексе, seo не ранжируется)
RedirectMatch 301 ^/seo/zhivotnye-adygeya-fauna/$ https://zvuki-lesa.ru/blog/zhivotnye-adygeya-gid/

# /seo/kak-dobratsya-do-dahovskoy/ → /blog/kak-dobratsya-do-dahovskoy/
# (blog в топе, seo — нет; в blog предварительно влит
# коммерческий блок про трансфер)
RedirectMatch 301 ^/seo/kak-dobratsya-do-dahovskoy/$ https://zvuki-lesa.ru/blog/kak-dobratsya-do-dahovskoy/
```

### 3.3. Проверить синтаксис и перезапустить

```bash
# Проверка конфигурации (на Windows):
"C:\Apache24\bin\httpd.exe" -t

# Если "Syntax OK" — перезапускаем:
"C:\Apache24\bin\httpd.exe" -k restart
# (или через services.msc → Apache2.4 → Restart)
```

### 3.4. Smoke-проверка

```bash
# Сразу после рестарта:
curl -I https://zvuki-lesa.ru/seo/zhivotnye-adygeya-fauna/
# Ожидаем:
#   HTTP/1.1 301 Moved Permanently
#   Location: https://zvuki-lesa.ru/blog/zhivotnye-adygeya-gid/

curl -I https://zvuki-lesa.ru/seo/kak-dobratsya-do-dahovskoy/
# Ожидаем:
#   HTTP/1.1 301 Moved Permanently
#   Location: https://zvuki-lesa.ru/blog/kak-dobratsya-do-dahovskoy/

# Убедиться, что blog-версии не задеты:
curl -I https://zvuki-lesa.ru/blog/zhivotnye-adygeya-gid/
# Ожидаем: HTTP/1.1 200 OK (НЕ 301)
```

### 3.5. Снять seo-страницы с публикации

После того как 301 заработали и Яндекс начал склейку (через ~2 недели):
1. `/admin/seo-pages` → снять галку `is_published` у двух страниц:
   - `zhivotnye-adygeya-fauna`
   - `kak-dobratsya-do-dahovskoy`
2. Это уберёт их из sitemap (`backend/src/routes/sitemap.ts` фильтрует `where eq(isPublished, true)`)
3. Через неделю после снятия — Яндекс окончательно забудет эти URL

**Альтернатива:** оставить seo-страницы `isPublished=true` и в sitemap, но 301 перебьёт — Яндекс всё равно будет ходить на blog. Однако лучше убрать из sitemap, чтобы не было путаницы в Вебмастере.

---

## 4. Откат

Если что-то пошло не так (ошибка в regex, ломает другие URL, и т.д.):

```bash
# Восстановить бэкап:
cp httpd-vhosts.conf.bak-<дата> httpd-vhosts.conf
"C:\Apache24\bin\httpd.exe" -t
"C:\Apache24\bin\httpd.exe" -k restart

# Проверить что 301 ушли:
curl -I https://zvuki-lesa.ru/seo/zhivotnye-adygeya-fauna/
# Ожидаем: HTTP/1.1 200 OK (НЕ 301)
```

---

## 5. Чего НЕ делать

- ❌ **НЕ править `.htaccess` в репозитории** — он игнорируется Apache (AllowOverride None). Реальный конфиг живёт только в `httpd-vhosts.conf` на сервере.
- ❌ **НЕ использовать `Redirect 301 /seo/...` без regex** — это поймает ВСЕ URL с префиксом `/seo/...`, а нам нужны только две конкретные страницы.
- ❌ **НЕ добавлять редиректы в блок `mod_rewrite.c` с `RewriteRule`** без необходимости — `RedirectMatch` проще и достаточен.
- ❌ **НЕ менять canonical/sitemap на бэке** для склейки — Яндекс понимает 301 сам, а двойная сигнализация (canonical + 301) только запутает.
- ❌ **НЕ делать редирект с http на https внутри этих правил** — если такого редиректа ещё нет, это отдельная задача.
- ❌ **НЕ применять редиректы до того как blog-страницы обновлены** (п. 2) — иначе после 301 blog-страницы станут тоньше seo, Яндекс понизит.

---

## 6. Проверка после внедрения (через неделю)

В Яндекс.Вебмастере:
- **Мониторинг → Исключения** — должно стать меньше на ~4-6 исключений (две пары)
- **Поисковые запросы → топ-страницы** — позиции `zhivotnye-adygeya-gid` и `kak-dobratsya-do-dahovskoy` должны остаться или вырасти (не упасть — это ключевой KPI)
- **Ссылки → Внешние** — вес с seo-страниц должен перейти на blog

Если позиции blog-страниц упали — значит при переносе контента потерялось что-то важное. Откатить редирект → доработать blog-страницы → повторить.

---

## 7. Контекстные ссылки

- Phase 1 (canonical/sitemap единый формат) — код в `src/pages/*` и `backend/src/routes/sitemap.ts`, коммит в `feature/skrolavito`
- Источник правды по структуре сайта — `CLAUDE.md` в корне репо
- Паттерн правок Apache для этого проекта — аналогично `httpd-vhosts.conf` для lemonadka-english (см. заметки во внутренней wiki проекта, если есть)

---

**Контакт для вопросов:** [владелец сайта, @Flusk01 в Telegram]
