# Админка бронирований — дизайн

Дата: 2026-07-10
Проект: «Звуки леса» — гостевой дом (React + Vite фронт, Express + SQLite/Drizzle бэк)

## Цель

Дать владельцу закрытую паролем админку, где он может:
- видеть все брони (с сайта и заведённые вручную), их статусы и занятость домиков;
- подтверждать заявки, пришедшие с сайта;
- сам заводить брони по звонку «со стороны» — без ограничений сайта;
- редактировать и отменять брони.

## Ключевые решения (из брейншторминга)

1. **Авторизация** — один общий пароль + сессия. Заходит только владелец.
2. **Механизм сессии** — подписанный Bearer-токен в `localStorage` (не cookie).
3. **Ручная бронь** — полная свобода: можно ставить поверх занятых дат и на 1 ночь; создаётся сразу со статусом `confirmed`; `source='manual'`.
4. **Цена ручной брони** — считается автоматически как подсказка, итог можно перебить вручную (`priceOverride`).
5. **Удаление броней** — только мягкая отмена (`status='cancelled'`): даты освобождаются, запись остаётся, доступна фильтром. Жёсткого удаления нет.
6. **Редактирование** — полное: даты, гости, имя, телефон, email, заметки, сумма, комментарий менеджера.
7. **Вид админки** — календарь занятости (сверху) + список заявок с фильтрами (снизу).

## 1. Авторизация и безопасность

### Переменные окружения (бэкенд `.env`)
- `ADMIN_PASSWORD` — пароль входа (сравнивается напрямую).
- `ADMIN_TOKEN_SECRET` — секрет для подписи токена.

Добавить `backend/.env.example` с этими ключами (без значений).

### Токен
- `POST /api/admin/login` принимает `{ password }`.
  - Неверный пароль → `401 UNAUTHORIZED`.
  - Верный → `{ success: true, token }`.
- Формат токена: `base64url(payload).base64url(hmacSHA256(payload, secret))`, где `payload = { exp }` (срок 30 дней). Реализация на `node:crypto` — **без новых зависимостей**.
- Middleware `requireAdmin`:
  - читает `Authorization: Bearer <token>`;
  - проверяет подпись и `exp`;
  - при отсутствии/ошибке/протухании → `401`.
- Применяется ко всем `/api/admin/*`, кроме `/api/admin/login`.

### Закрытие текущих дыр
Сейчас публичны и небезопасны:
- `POST /api/bookings/:id/cancel` — любой по id может отменить чужую бронь. **Удалить** (отмена переезжает в админку).
- `GET /api/bookings/:id` — отдаёт телефон/данные гостя без авторизации. **Удалить** (во фронте публично не используется).

Публичный `POST /api/bookings` (заявки с сайта) остаётся; ему проставляется `status='new'`, `source='site'`.

## 2. Бэкенд — эндпоинты `/api/admin`

Новый роутер `backend/src/routes/admin.ts`, смонтирован на `/api/admin`, за `requireAdmin` (кроме login).

| Метод | Путь | Назначение |
|-------|------|-----------|
| POST | `/login` | Вход по паролю, выдаёт токен |
| GET | `/bookings?status=&from=&to=&cottageId=` | Список броней с именем домика, сортировка по дате заезда |
| GET | `/calendar?from=&to=` | Занятость по всем домикам для сетки календаря |
| POST | `/bookings` | Ручная бронь (без проверок, `confirmed`, `manual`, `priceOverride?`) |
| PATCH | `/bookings/:id` | Редактирование полей брони |
| POST | `/bookings/:id/confirm` | Статус → `confirmed` |
| POST | `/bookings/:id/cancel` | Статус → `cancelled` |

### Детали
- `GET /bookings`:
  - `status` ∈ `new|confirmed|cancelled|all` (по умолчанию `all`).
  - `from`/`to`/`cottageId` — необязательные фильтры.
  - Ответ включает: id, cottageId, cottageName, guestName, phone, email, checkInDate, checkOutDate, guests, nights, subtotal, servicesTotal, totalPrice, status, source, notes, managerComment, createdAt.
- `GET /calendar`:
  - Возвращает по каждому домику массив занятых интервалов `{ bookingId, guestName, status, checkInDate, checkOutDate }` (исключая `cancelled`), фронт рисует сетку.
- `POST /bookings` (ручная):
  - Валидация zod: те же поля, что у сайта, плюс `priceOverride?: number`.
  - **Не вызывает** `isDateRangeAvailable` и проверку минимума ночей.
  - Считает `subtotal`/`servicesTotal` через `pricing.ts`; `totalPrice = priceOverride ?? (subtotal + servicesTotal)`.
  - `status='confirmed'`, `source='manual'`.
- `PATCH /bookings/:id`:
  - Любое подмножество полей: guestName, phone, email, checkInDate, checkOutDate, guests, notes, managerComment, totalPrice, status.
  - При изменении дат пересчитывает `nights`.
  - **Сумма (`totalPrice`) сама не пересчитывается**: меняется только если передана явно. Так сохраняется философия ручного перебивания цены и нет сюрпризов при правке дат.
  - Без принудительной проверки занятости (свобода админа).
- `confirm`/`cancel` — простое обновление статуса, `404` если брони нет.

Переиспользуются `services/pricing.ts` и `services/availability.ts`. Логика праздников/минимума ночей не дублируется.

## 3. Изменения в БД

- Новая колонка `bookings.source`: `text`, enum `'site' | 'manual'`, `NOT NULL DEFAULT 'site'`.
- Миграция генерируется `cd backend && npx drizzle-kit generate`, применяется `npm run backend:migrate`.
- Статусы (`new/confirmed/cancelled`) и `managerComment` уже есть в схеме — новых полей больше не требуется.

## 4. Фронтенд — админка

### Маршруты (`src/App.tsx`)
- `/admin/login` — страница входа.
- `/admin` — дашборд, обёрнут в гвард.
- Гвард `RequireAdmin`: нет валидного токена → редирект на `/admin/login`.

Админка рендерится **вне** лендинга со `SnapScroll` — отдельный обычный прокручиваемый экран, свой layout, без `StickyFooter` и навигации сайта.

### API-клиент
`src/lib/adminApi.ts`:
- методы: `login`, `getBookings`, `getCalendar`, `createBooking`, `updateBooking`, `confirmBooking`, `cancelBooking`;
- автоподстановка `Authorization: Bearer <token>` из `localStorage`;
- при `401` — очистка токена и редирект на вход.

### Компоненты (`src/pages/admin/`)
- `AdminLogin` — поле пароля → `login` → сохранить токен → перейти на `/admin`.
- `AdminDashboard` — сверху `OccupancyCalendar`, снизу `BookingsList`.
- `OccupancyCalendar` — 3 домика (строки) × дни (колонки) выбранного диапазона; цветные полосы броней по статусу; клик по пустой клетке открывает `BookingFormDialog` с подставленными домиком и датой.
- `BookingsList` — вкладки-фильтры (Все / Новые / Подтверждённые / Отменённые); строки: гость, домик, даты, сумма, бейдж статуса, метка источника (сайт/вручную); кнопки Подтвердить / Отменить / Редактировать; клик по строке → редактирование.
- `BookingFormDialog` — общий для создания и редактирования; выбор домика, диапазон дат через существующий `CustomCalendar`, число гостей, имя, телефон, email, заметки, комментарий менеджера, поле цены (автоподсчёт + ручной перебив).

Переиспользуются ui-компоненты shadcn (Dialog, Input, Button, Badge, Tabs, Select) и `CustomCalendar`.

## 5. Тестирование

### Бэкенд (Vitest + supertest)
- Логин: верный пароль → токен; неверный → 401.
- `requireAdmin`: запрос к защищённому пути без/с битым токеном → 401.
- Список: фильтрация по `status`, `cottageId`, диапазону дат.
- Ручная бронь: успешно создаётся поверх занятых дат и на 1 ночь; статус `confirmed`, source `manual`; `priceOverride` учитывается.
- `confirm`/`cancel`: корректные переходы статуса; отменённая бронь освобождает даты (не участвует в проверке занятости сайта).
- `PATCH`: смена дат пересчитывает `nights`.

### Фронтенд (Vitest + Testing Library)
- `adminApi`: подстановка токена в заголовок, очистка при 401.
- `RequireAdmin`: редирект без токена.

## 6. Конфиг и документация
- `backend/.env.example` с `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`.
- Обновить `CLAUDE.md`: раздел про админку, новые эндпоинты, переменные окружения, колонку `source`.

## Вне объёма (YAGNI)
- Мультипользовательские учётки, роли.
- Уведомления гостю при подтверждении (нет email/SMS-инфраструктуры).
- Управление ценовыми правилами и услугами из админки.
- Жёсткое удаление броней.
