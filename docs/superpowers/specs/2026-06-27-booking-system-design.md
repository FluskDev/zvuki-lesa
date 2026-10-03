# Booking System Design — Звуки Леса

**Дата:** 2026-06-27
**Статус:** Утверждён
**Заменяет:** `server/` (Flask + PostgreSQL) на `backend/` (Node.js + SQLite)

## Цель

Заменить Python Flask backend на локальный Node.js backend с SQLite (Drizzle ORM + better-sqlite3) для системы бронирования гостевого дома «Звуки Леса». Схема БД должна быть спроектирована так, чтобы переезд на PostgreSQL в будущем был однострочным изменением dialect. На текущей итерации — без админки: данные заполняются seed-скриптами, уведомления менеджеру через запись в БД + console.log.

## Архитектура

```
Браузер (Vite :5173)
   │ /api/* (Vite proxy)
   ▼
Backend Node.js (Express :3001)
   │ Drizzle ORM
   ▼
SQLite (backend/data/zvuki-lesa.db)
```

### Структура файлов

```
backend/
  src/
    server.ts                 # Express app, CORS, JSON, error handling
    db/
      schema.ts               # Drizzle schema (все таблицы)
      client.ts               # better-sqlite3 + drizzle instance
      seed.ts                 # Заполнение начальными данными
      migrate.ts              # Применение миграций
    routes/
      cottages.ts             # GET /api/cottages, GET /api/cottages/:idOrSlug
      availability.ts         # GET /api/cottages/:id/availability
      services.ts             # GET /api/services
      bookings.ts             # POST /api/bookings, GET /api/bookings/:id, POST /api/bookings/:id/cancel
      calendar.ts             # GET /api/calendar/:cottageId
    services/
      pricing.ts              # calculateStayPrice(cottageId, checkIn, checkOut)
      availability.ts         # findAvailableCottages, isDateRangeAvailable
      notifications.ts        # notifyManager(booking) → DB + console.log
    lib/
      validation.ts           # Zod схемы для входящих запросов
      errors.ts               # ApiError класс + middleware
  drizzle/                    # Сгенерированные SQL миграции
  drizzle.config.ts
  vitest.config.ts
  data/                       # .gitkeep, сюда .db файл
  logs/                       # .gitkeep, error.log
  package.json                # type: "module", scripts: dev/migrate/seed/test
```

### Скрипты backend

- `npm run backend:dev` — `tsx watch src/server.ts`
- `npm run backend:migrate` — применить миграции Drizzle
- `npm run backend:seed` — заполнить БД начальными данными
- `npm run backend:test` — Vitest для backend

### Vite proxy

В `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3001',
  },
}
```

## Схема БД

Все таблицы в `backend/src/db/schema.ts` на Drizzle. SQLite-совместимые типы, миграция на Postgres сменит только dialect в `drizzle.config.ts`.

### cottages

```ts
id              integer PK autoincrement
slug            text unique                  // 'shale-uyut'
mapId           text                         // 'Домик1', 'Домик2', 'Домик3'
name            text
shortDescription  text
longDescription   text
basePrice       integer                      // в рублях, базовая цена за ночь
area            integer                      // м²
guests          integer                      // макс. гостей
bedrooms        integer
bedsDouble      integer
bedsSingle      integer
checkInTime     text                         // '15:00 – 23:00'
checkOutTime    text                         // 'до 12:00'
mainImage       text
isActive        integer (boolean)            // 1/0
createdAt       text (ISO datetime)
```

### cottageImages

```ts
id              integer PK
cottageId       integer FK → cottages.id (cascade delete)
url             text
position        integer
```

### amenities

```ts
id              integer PK
name            text                         // 'Wi-Fi', 'Бассейн'
icon            text nullable                // lucide icon name
```

### cottageAmenities

```ts
cottageId       integer FK → cottages.id
amenityId       integer FK → amenities.id
PRIMARY KEY (cottageId, amenityId)
```

### recreationItems

```ts
id              integer PK
cottageId       integer FK → cottages.id
title           text
description     text
photo           text
position        integer
```

### services

```ts
id              integer PK
slug            text unique                  // 'rafting', 'jeeping'
name            text
description     text
basePrice       integer nullable             // null = "по запросу"
icon            text                         // lucide icon name
isActive        integer (boolean)
position        integer
```

### priceRules

```ts
id                integer PK
cottageId         integer nullable FK        // null = правило для всех домиков
name              text                       // 'Новый год', 'Высокий сезон'
startDate         text                       // '2026-12-25'
endDate           text                       // '2026-01-08'
modifierType      text                       // 'percent' | 'fixed'
modifierValue     integer                    // +50 (%) или +2000 (₽)
weekendModifier   integer nullable           // +20 (%) дополнительно к modifier в сб/вс
priority          integer                    // для разрешения конфликтов
```

### bookings

```ts
id              integer PK
cottageId       integer FK → cottages.id
guestName       text
phone           text
email           text nullable
checkInDate     text                          // ISO date
checkOutDate    text
guests          integer
notes           text nullable
nights          integer                        // вычислено при создании
subtotal        integer                        // сумма за проживание (до услуг)
servicesTotal   integer                        // сумма по услугам
totalPrice      integer                        // subtotal + servicesTotal
status          text                           // 'new' | 'confirmed' | 'cancelled'
managerComment  text nullable
createdAt       text (ISO datetime)
```

### bookingServices

```ts
id                integer PK
bookingId         integer FK → bookings.id (cascade)
serviceId         integer FK → services.id
quantity          integer default 1
priceAtBooking    integer nullable            // цена на момент брони
```

### notifications

```ts
id              integer PK
type            text                           // 'new_booking', 'cancellation'
bookingId       integer FK nullable
payload         text (JSON)
createdAt       text (ISO datetime)
sentAt          text nullable                  // null = только залогировано
```

### Индексы

- `cottages.slug` UNIQUE
- `bookings(cottageId, checkInDate, checkOutDate)` — поиск пересечений
- `bookings(status)` — фильтр для будущей админки
- `priceRules(startDate, endDate)` — выборка по диапазону
- `bookingServices(bookingId)` — JOIN
- `cottageImages(cottageId, position)` — сортировка галереи

### Логика занятости

Домик занят, если есть `bookings` со статусом ≠ 'cancelled' и диапазон пересекается. День выезда **свободен** для нового заезда (check-out 12:00, check-in 14:00).

## API контракты

Все эндпоинты под `/api`. Ошибки: `{ success: false, error: string, code?: string }`. Даты ISO 8601.

### GET /api/cottages

Список активных домиков с удобствами, галереей, recreation.

```json
{
  "success": true,
  "cottages": [
    {
      "id": 1,
      "slug": "shale-uyut",
      "mapId": "Домик1",
      "name": "Шале Уют",
      "shortDescription": "...",
      "longDescription": "...",
      "basePrice": 4500,
      "area": 49,
      "guests": 5,
      "bedrooms": 2,
      "beds": { "double": 2, "single": 1 },
      "checkInTime": "15:00 – 23:00",
      "checkOutTime": "до 12:00",
      "mainImage": "/images/cabin1-1.jpg",
      "amenities": ["Площадь: 49 м²", "Бассейн", "Wi-Fi"],
      "gallery": ["/images/cabin1-1.jpg", "/images/cabin1-2.jpg"],
      "recreation": [
        { "id": 1, "title": "Банный чан", "description": "...", "photo": "..." }
      ]
    }
  ]
}
```

### GET /api/cottages/:idOrSlug

Детали одного домика (для `/booking/:cabinId`).

### GET /api/cottages/:id/availability?checkIn=...&checkOut=...

```json
{
  "success": true,
  "available": true,
  "nights": 3,
  "guests": 2,
  "price": {
    "perNight": [{ "date": "2026-06-27", "base": 4500, "final": 6750, "rule": "Высокий сезон" }],
    "subtotal": 20250,
    "minNightsOk": true,
    "warning": null
  }
}
```

### GET /api/availability?checkIn=...&checkOut=...&guests=N

Все доступные домики под даты (для StickyFooter).

```json
{
  "success": true,
  "checkIn": "2026-06-27",
  "checkOut": "2026-06-30",
  "nights": 3,
  "results": [
    {
      "cottageId": 1,
      "name": "Шале Уют",
      "mainImage": "/images/cabin1-1.jpg",
      "subtotal": 20250,
      "guests": 5
    }
  ]
}
```

### GET /api/services

Список активных услуг.

### GET /api/calendar/:cottageId?from=...&to=...

Занятые даты (диапазон до 6 месяцев).

### POST /api/bookings

```json
{
  "cottageId": 1,
  "guestName": "Иван Иванов",
  "phone": "+79282110249",
  "email": "ivan@example.com",
  "checkInDate": "2026-06-27",
  "checkOutDate": "2026-06-30",
  "guests": 2,
  "notes": "Поздний заезд",
  "services": [{ "serviceId": 1, "quantity": 2 }]
}
```

Ответ 201: `{ success: true, booking: { id, status, nights, subtotal, servicesTotal, totalPrice, createdAt } }`.

Возможные ошибки: `400` (валидация, < minNights), `404` (cottage не найден), `409` (`DATES_UNAVAILABLE`).

На успех в транзакции создаётся `booking`, `bookingServices`, `notification`. Сервер логирует в консоль: `[BOOKING #42] New: Иван +7... 2026-06-27→30, 3 ночи, ₽25250`.

### GET /api/bookings/:id

Детали + статус. 404 если не найдено.

### POST /api/bookings/:id/cancel

Смена статуса на `cancelled` (освобождает даты). Доступ открытый в текущей итерации.

### Валидация

Все POST через Zod в `backend/src/lib/validation.ts`. Ошибки → 400 `{ success: false, error, code: "VALIDATION_ERROR", details: [...] }`.

## Изменения на фронтенде

### Vite proxy

```ts
server: { proxy: { '/api': 'http://localhost:3001' } }
```

### src/lib/api.ts

Удаляем хардкод `API_URL = 'http://localhost:5000/api'`. Используем `/api` (относительный путь). Типизированный wrapper:

```ts
type ApiResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };
```

Все существующие методы (`getCottages`, `getServices`, `createBooking`, `checkAvailability`, `getBookedDates`) переписываются под новые API-контракты.

### src/lib/cabins.ts

Тип `Cabin` остаётся. Экспорт `CABINS` удаляется (источник правды — backend). `getCabinById` остаётся как утилита.

### Хуки

Новые в `src/hooks/`:
- `useCottages()` — `{ data, isLoading, error }`
- `useAvailability(cottageId, checkIn, checkOut, guests)` — мемоизированный fetch с `AbortController`

### StickyFooter

Заменяется заглушка: реальный поиск через `GET /api/availability`, диалог со списком доступных домиков, клик открывает `BookingDialog` с предзаполненными параметрами.

### BookingDialog

- Цена подтягивается из `useAvailability`
- Блокируем submit если `available: false` или есть `warning`
- Услуги из `getServices`, цены из БД
- Чек: Проживание + услуги с ценой + итого

### BookingPage

Источник данных: `GET /api/cottages/:slug`. Скелетон пока грузится. 404 — существующий экран.

### CustomCalendar

Логика компонента не меняется. Изменяется источник `bookedDates` — теперь они приходят из `GET /api/calendar/:cottageId?from=...&to=...` (раньше передавались напрямую через пропсы). `BookingDialog` и `BookingPage` сами запрашивают данные и пробрасывают в календарь.

## Тестирование

### Backend (Vitest, отдельный `backend/vitest.config.ts`)

Unit:
- `services/pricing.test.ts` — правила, weekend-модификатор, приоритет
- `services/availability.test.ts` — пересечения, день выезда свободен
- `db/seed.test.ts` — структура seed данных

Integration (in-memory SQLite `:memory:`):
- `routes/bookings.test.ts` — POST транзакция, откат при ошибке
- `routes/availability.test.ts` — занятость после брони
- E2E: создать бронь → даты заняты → отменить → свободны

### Frontend (Vitest + @testing-library, существующий setup)

- `src/hooks/useAvailability.test.ts` — отмена, ошибка
- `src/components/StickyFooter.test.tsx` — "Найти" открывает диалог
- `bookingRules.test.ts` оставляем (логика минимума теперь в backend, тесты — страховка)

## Обработка ошибок

### Backend

- Неперехваченные исключения → 500 `{ success: false, error: "Internal server error" }` + console.error + запись в `logs/error.log`
- Zod ошибки → 400 с `code: "VALIDATION_ERROR", details: [...]`
- Конфликт дат → 409 с `code: "DATES_UNAVAILABLE"`
- Не найдено → 404 с `code: "NOT_FOUND"`

### Frontend

- `apiFetch` ловит network errors → `{ success: false, error: "Нет связи с сервером" }`
- Хуки экспорят `error: string | null`
- UI: `<Alert variant="destructive">` или toast.error (sonner)

## Что удаляем

- `server/app.py`
- `server/app_sqlite.py`
- `server/database.py`
- `server/telegram_bot.py`
- Вся директория `server/`
- `start.bat` переписывается под Node backend
- Из `package.json`: ничего (только добавляем `backend:dev`, `backend:migrate`, `backend:seed`, `backend:test`)

## Что остаётся без изменений

- `src/components/ui/` (shadcn)
- CSS Modules в `HeroCarousel`, `SnapScroll`, `CustomCalendar`, `StickyFooter`
- Tailwind, PostCSS, TS конфиги (только proxy в vite.config.ts)
- `public/` ассеты
- Секции в `src/sections/`, страница `BookingPage` (структура)

## Порядок реализации

1. Инициализация `backend/`, package.json, Drizzle config, миграции
2. Все таблицы в схеме + первая миграция
3. Seed из данных `src/lib/cabins.ts`
4. Backend services: pricing, availability, notifications
5. Backend routes: cottages, services, calendar, bookings
6. Backend тесты
7. Vite proxy + переписать `src/lib/api.ts`
8. Хуки `useCottages`, `useAvailability`
9. StickyFooter: реальная логика поиска
10. BookingDialog: цена + услуги
11. BookingPage: интеграция с API
12. Удаление `server/`, обновление `start.bat`
13. E2E проверка вручную

## Открытые вопросы (НЕ в этом спеке)

- Авторизация админки
- Онлайн-оплата (YooKassa / Tinkoff / CloudPayments — выбирать позже)
- Email-уведомления
- Telegram-бот как отдельный сервис
- Загрузка фото через админку
- Миграция существующих данных из PostgreSQL (`server/app.py` обращается к БД `BD_LesBaza` на `192.168.0.104` — нужно решить, переносить ли историю)