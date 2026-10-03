# ТЗ для серверного агента: расширить прокси для виджета homereserve

## Проблема

Виджет homereserve.ru загружается через прокси `/hr-widget/*` (есть). Но после загрузки `widget.js` шлёт абсолютные запросы на `https://realtycalendar.ru/v2/widget/*` и `https://homereserve.ru/${token}/*` — минуя наш прокси. Когда клиент заходит через VPN с иностранным IP, эти домены гео-блокируют соединение — виджет зависает в "Ожидание" (Pending) на OPTIONS preflight + GET (см. DevTools Network).

Корень: виджет **жёстко зашит на абсолютные origin'ы** в исходнике, относительные URL не использует (`location.origin` в widget.js = 0 вхождений). Нужно на уровне веб-сервера подменить origin'ы на наши прокси-префиксы.

## Цель

Все запросы виджета (включая сам `widget.js`) должны идти на `https://zvuki-lesa.ru` (same-origin для клиента), а Apache пробрасывает их на upstream'ы с нашего российского IP.

## Задачи

### 1. Apache: расширить ProxyPass

В `httpd-vhosts.conf` (или где у нас уже живёт текущий `/hr-widget/*` прокси) добавить:

```apache
# Уже есть — оставляем как есть
ProxyPass        /hr-widget/  https://homereserve.ru/
ProxyPassReverse /hr-widget/  https://homereserve.ru/

# Добавить:
ProxyPass        /hr-api/     https://realtycalendar.ru/v2/widget/
ProxyPassReverse /hr-api/     https://realtycalendar.ru/v2/widget/

ProxyPass        /hr-widget-api/ https://homereserve.ru/
ProxyPassReverse /hr-widget-api/ https://homereserve.ru/
```

Убедиться что `mod_proxy`, `mod_proxy_http` загружены (стандартный набор для существующего `/hr-widget/*`, но проверить). `SSLProxyEngine On` уже должен быть включён — без него не работает upstream.

### 2. Apache: переписать widget.js на лету через mod_substitute

В блоке для `/hr-widget/widget.js` добавить `SetOutputFilter SUBSTITUTE` с двумя регулярками:

```apache
<Location /hr-widget/widget.js>
    SetOutputFilter SUBSTITUTE
    Substitute "s|https://realtycalendar.ru/v2/widget/|/hr-api/|i"
    Substitute "s|https://homereserve.ru/|/hr-widget-api/|i"
</Location>
```

**Проверить** что модуль `mod_substitute` загружен (`LoadModule substitute_module modules/mod_substitute.so`). Стандартный модуль Apache 2.4, обычно уже включён.

### 3. Порядок регулярок важен

Первая подстановка заменяет `realtycalendar.ru/v2/widget/` → `/hr-api/`. Вторая — `homereserve.ru/` → `/hr-widget-api/`. Если поменять местами — `homereserve.ru` тоже зацепится в URL `realtycalendar.ru` (там нет `homereserve`, но на всякий случай — порядок строго как выше).

### 4. Перезагрузить Apache и проверить

```bash
httpd -k restart     # или service httpd restart
```

Тесты:
- `curl -sLk "https://zvuki-lesa.ru/hr-widget/widget.js" | grep -c "https://realtycalendar.ru"` — должен вернуть 0
- `curl -sLk "https://zvuki-lesa.ru/hr-widget/widget.js" | grep -c "https://homereserve.ru"` — должен вернуть 0
- `curl -sL "https://zvuki-lesa.ru/hr-api/info" -o /dev/null -w "%{http_code}\n"` — должен вернуть 200 (upstream работает)
- В браузере (БЕЗ VPN, на текущем сеансе — российский IP) открыть `https://zvuki-lesa.ru/` → виджет должен по-прежнему грузиться (regression-проверка)

### 5. Что НЕ трогать

- Существующий прокси `/hr-widget/*` — оставить как есть.
- Всё, что лежит в `/api/*` (наш бэкенд на Express 3001) — НЕ путать с `/hr-api/*`. Наш `/api` тоже проксируется через Apache, его не трогаем.
- `t.me`, `wa.me`, `api-maps.yandex.ru`, `fonts.googleapis.com` — это уже same-origin или не блокируется, не трогаем.

## Дополнительно (если после деплоя что-то ещё сломается)

Если в DevTools Network через VPN всплывут **другие** абсолютные URL кроме `realtycalendar.ru` и `homereserve.ru` (например, шрифты или картинки с абсолютным origin) — прислать мне список URL и regex, добавлю в подстановки.

## Контекст для диагностики

Виджет загружается в iframe через `/hr-widget-loader.html` на главной. Сайт: `https://zvuki-lesa.ru`. Виджет токен: `feEBPdLdgb`. Текущий файл с настройками iframe: `public/hr-widget-loader.html` (в репо).

`mod_substitute` обрабатывает только ответ от upstream'а, не запрос клиента — поэтому это безопасно и не зацепит ничего кроме `widget.js`.

Применять конфиг через ТЗ в чат (агент на сервере читает и применяет) — **.htaccess не используется** (AllowOverride None).
