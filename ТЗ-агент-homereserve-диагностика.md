# ТЗ для агента: диагностика прокси виджета homereserve

## Что наблюдаем с нашей машины (curl с IP 165.231.104.234)

```
GET https://zvuki-lesa.ru/hr-widget/widget.js       → 200 OK (1.5 сек)
GET https://zvuki-lesa.ru/hr-api/info               → 500 Proxy Error
GET https://zvuki-lesa.ru/hr-widget-api/feEBPdLdgb/info → 401 Unauthorized
                                                       WWW-Authenticate: Basic realm="Authentication Required"
GET https://zvuki-lesa.ru/api/cottages             → 200 OK (бэкенд)
```

Виджет сейчас **полностью мёртв на проде** — даже без VPN. Через VPN то же самое (хотя пользователь говорит «без VPN работало» — видимо, было до того, как кто-то менял прокси).

## Нужна диагностика

### 1. Покажи текущий конфиг прокси

Выгрузи кусок `httpd-vhosts.conf` (или эквивалент — где живут `ProxyPass` / `Location` для `/hr-*` путей):

```bash
grep -n -B2 -A20 "hr-widget\|hr-api\|hr-widget-api" "C:/path/to/httpd-vhosts.conf"
```

Нужны все упоминания `/hr-widget`, `/hr-api`, `/hr-widget-api`. Покажи полные блоки `<Location>` / `ProxyPass` для каждого.

### 2. Проверь upstream'ы с самого сервера

С сервера zvuki-lesa.ru (где стоит Apache) выполни и пришли ответы:

```bash
curl -sLk --max-time 8 -o /dev/null -w "realtycalendar.ru STATUS=%{http_code} TIME=%{time_total}\n" "https://realtycalendar.ru/v2/widget/info"
curl -sLk --max-time 8 -o /dev/null -w "homereserve.ru   STATUS=%{http_code} TIME=%{time_total}\n" "https://homereserve.ru/"
curl -sLk --max-time 8 -o /dev/null -w "feEBPdLdgb/info  STATUS=%{http_code} TIME=%{time_total}\n" "https://realtycalendar.ru/v2/widget/feEBPdLdgb/info"
```

Если STATUS=000 или очень большой TIME — upstream недоступен с сервера. Если 5xx — upstream возвращает ошибку. Если 4xx — upstream отвечает, но с ошибкой авторизации/маршрута.

### 3. Откуда Basic Auth на /hr-widget-api/?

В ответе `https://zvuki-lesa.ru/hr-widget-api/feEBPdLdgb/info` сервер отдаёт `WWW-Authenticate: Basic realm="Authentication Required"` с заголовком от Apache. Это значит в `httpd-vhosts.conf` для этого Location стоит `AuthType Basic` + `AuthName "Authentication Required"`.

**Вопрос:** это сделал ты по моему предыдущему ТЗ, или это было в конфиге до того? Если ты — отмени, вместо Basic Auth должен быть `ProxyPass /hr-widget-api/ https://homereserve.ru/`.

### 4. Проверь reload/recent change

Если ты что-то менял в Apache конфиге по моему предыдущему ТЗ про расширение прокси — покажи что именно применил. Если не применял — тем лучше, ничего не откатываем.

## Что я сделаю по результатам

Жду от тебя:
1. Содержимое `httpd-vhosts.conf` для `/hr-*` блоков
2. Статусы upstream'ов с сервера
3. Ответ по Basic Auth — твоё или чужое
4. Если применял моё предыдущее ТЗ — что именно вписал

Дальше я обновлю ТЗ на починку (убрать Basic Auth, добавить правильные ProxyPass, проверить SSL до upstream).
