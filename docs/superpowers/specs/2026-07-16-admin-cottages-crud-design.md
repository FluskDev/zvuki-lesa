# Admin Cottages CRUD — Дизайн

**Дата:** 2026-07-16
**Статус:** Готов к плану реализации
**Задача:** Добавить возможность создавать и удалять домики через админ-панель `/admin/cottages`.

## Контекст

Сейчас в админке `/admin/cottages` уже есть список (`CottagesList.tsx`) и редактор (`CottageEditor.tsx`), но только для существующих домиков. Создание и удаление отсутствуют — соответствующих эндпоинтов нет в `backend/src/routes/cottages.ts`, а в `CottageEditor` режим создания не реализован.

Задача — добавить `POST` и `DELETE` для домиков, поддержать режим create в редакторе, добавить кнопки «Создать» и «Удалить» в списке.

## Решения, согласованные с пользователем

1. **Удаление при наличии броней — жёсткий запрет.** Бэкенд возвращает 409 `HAS_BOOKINGS`, в UI — информационный баннер с предложением скрыть через `isActive=false`. Никакого каскадного удаления броней.
2. **`slug` и `mapId` — оба поля в форме.** Slug автогенерируется транслитерацией из названия и редактируемый; mapId — текстовое поле с подсказкой формата `ДомикN`.

## Архитектура

### Backend

Два новых эндпоинта в существующем `cottagesAdminRouter` (уже под `requireAdmin`):

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/api/admin/cottages` | Создать домик |
| `DELETE` | `/api/admin/cottages/:id` | Удалить домик |

**Zod-схема для создания** (`cottageCreateSchema` в `backend/src/routes/cottages.ts`):

```ts
const slugRegex = /^[a-z0-9-]+$/;

const cottageCreateSchema = z.object({
  slug: z.string().min(1).max(80).regex(slugRegex),
  mapId: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  shortDescription: z.string().min(1).max(300),
  longDescription: z.string().min(1).max(2000),
  description: z.string().max(8000).optional().nullable(),
  houseRules: z.string().max(8000).optional().nullable(),
  basePrice: z.number().int().nonnegative(),
  area: z.number().int().positive(),
  guests: z.number().int().positive(),
  bedrooms: z.number().int().nonnegative(),
  bedsDouble: z.number().int().nonnegative().default(0),
  bedsSingle: z.number().int().nonnegative().default(0),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
  mainImage: z.string().min(1).max(500),
  isActive: z.boolean().default(true),
  amenityIds: z.array(z.number().int().positive()).optional(),
});
```

**Обработка коллизии slug.** Констрейнт уникальности уже есть на уровне БД (`slug: text('slug').notNull().unique()`). При попытке вставить дубликат PG бросает ошибку с кодом `23505`. Оборачиваем `db.insert` в try/catch и преобразуем в `ApiError(409, 'CONFLICT', 'Slug already exists')` (паттерн из `blogPosts.ts:91` и `seoPages.ts:69`). Уникальное значение `code` для cottages не нужно — фронт различает ситуации по `error` либо по `code === 'CONFLICT'` + отдельный запрос статуса.

**Алгоритм удаления:**

```ts
const hasBookings = (await db
  .select({ id: bookings.id })
  .from(bookings)
  .where(eq(bookings.cottageId, id))
  .limit(1)).length > 0;
if (hasBookings) {
  throw new ApiError(409, 'CONFLICT',
    'Невозможно удалить: у домика есть бронирования. Скройте его через isActive=false.');
}
await db.delete(cottages).where(eq(cottages.id, id));
res.json({ success: true });
```

Каскад на уровне БД (`onDelete: 'cascade'` уже есть в `cottageImages`, `cottageAmenities`, `recreationItems`, `priceRules`) снесёт связанные записи автоматически. `bookings.cottageId` ссылается без каскада — именно поэтому удаление блокируется при их наличии.

### Frontend

**Маршруты (без изменений в `App.tsx`):**

- `/admin/cottages` — список
- `/admin/cottages/new` — создание (новое использование `:id`)
- `/admin/cottages/:id` — редактирование

**Файлы:**

| Файл | Изменение |
|---|---|
| `src/lib/adminApi.ts` | Добавить `createAdminCottage`, `deleteAdminCottage` |
| `src/lib/translit.ts` (новый) | Утилита транслитерации RU → slug |
| `src/pages/admin/CottagesList.tsx` | Кнопка «Создать» в `AdminNav`, кнопка «Удалить» с `useConfirm`, обработка 409 `HAS_BOOKINGS` |
| `src/pages/admin/CottageEditor.tsx` | Режим create при отсутствии `:id`, поля `slug` и `mapId` в форме, разветвление save() |

### Поток create

```
1. Пользователь на /admin/cottages кликает [+ Создать домик]
2. → Link to /admin/cottages/new
3. CottageEditor монтируется, useParams() → id=undefined
4. useEffect: if (!id) → setCottage(null), setForm(emptyForm), loading=false
5. Пользователь заполняет форму. Slug авто-заполняется транслитерацией имени
   (пока пользователь не редактировал slug вручную — флаг slugTouched).
6. Клик «Создать» → POST /api/admin/cottages
7. Успех → nav('/admin/cottages/<id>', { replace: true }), toast.success
8. CottageEditor перемонтируется в режим edit, дальнейшие изменения через PATCH
```

### Поток delete

```
1. На /admin/cottages пользователь кликает [🗑️] в строке
2. useConfirm → диалог «Удалить домик «{name}»? Это действие нельзя отменить. Все фото и удобства домика также будут удалены.»
3. Подтверждение → DELETE /api/admin/cottages/:id
4. Успех → load(), toast.success 'Удалено'
5. 409 HAS_BOOKINGS → toast.error + информационный баннер:
   «У домика есть бронирования. Скройте его через редактирование → Активен.»
6. Любая другая ошибка → toast.error + setError для баннера сверху
```

## Транслитерация

Новый файл `src/lib/translit.ts` экспортирует `transliterate(input: string): string`:

- Нижний регистр, замена букв RU → EN по таблице (ё→yo, й→y, ц→ts, щ→sch и т. д.).
- Все не-буквенно-цифровые символы → `-`.
- Схлопывание повторяющихся `-`, обрезка по краям.
- Длина ограничена 80 символами.
- Покрывается unit-тестом `src/lib/translit.test.ts` (набор «Шале Уют» → `shale-uyut`, «Дом у реки №3» → `dom-u-reki-3`).

Без новых npm-зависимостей.

## UI-детали

**`CottagesList.tsx`:**
- В шапке `AdminNav` через `children` — `<Button asChild><Link to="/admin/cottages/new">+ Создать домик</Link></Button>` (паттерн из `BlogList.tsx:124`).
- В колонке «Действия» рядом с `Pencil` добавляется `Trash2` (паттерн из `BlogList.tsx:178-187`).
- Импортируется `useConfirm` из `./ConfirmDialog` и `adminApi.delete`.
- При `r.code === 'CONFLICT'` и `r.error.includes('бронирован')` — toast.error + короткий баннер сверху таблицы на 5 секунд с текстом «Нельзя удалить: есть бронирования. [Перейти к редактированию]».

**`CottageEditor.tsx`:**
- В `useEffect` ветка `if (!id)` устанавливает `setCottage(null)`, `setForm(emptyForm)`, `setSelectedAmenityIds(new Set())`, `setLoading(false)`. Возвращаемый `load()` далее не вызывается (это синхронная установка стейта).
- Импортируется `createAdminCottage` из `adminApi`.
- `save()` разветвляется:
  - `if (cottage)` → существующая PATCH-логика.
  - `else` → сборка payload из form + slug + mapId + amenityIds → `createAdminCottage(payload)` → `nav('/admin/cottages/<id>', { replace: true })`.
- В `DescriptionTab` добавляется секция «Идентификаторы» с двумя полями:
  - `slug` — Input, `placeholder="shale-uyut"`. Значение отслеживается флагом `slugTouched`; если `false` — обновляется через `useMemo(() => transliterate(form.name), [form.name])` при каждом изменении имени.
  - `mapId` — Input, `placeholder="Домик4"`. Без автогенерации.
- В секции «Основное» добавляется поле `mainImage` (Input, `placeholder="/images/cottage-main.jpg"`). Это обязательное `NOT NULL` поле в БД. На создании пользователь вставляет URL/путь вручную; загрузка файла в PhotosTab остаётся для редактирования (там уже есть upload). Если поле пустое — кнопка «Создать» заблокирована с подсказкой «Укажите URL главного фото».
- Состояние `slugTouched` поднимается в `CottageEditor` (через пропс `slugTouched` + `onSlugChange` в `DescriptionTab`) или держится локально в `DescriptionTab` с пробросом наверх через коллбэк. **Решение:** храним в `CottageEditor` рядом с `form`, передаём setSlugTouched в `DescriptionTab`.

## Обработка ошибок

| Ситуация | HTTP / Код | Frontend |
|---|---|---|
| Slug занят | 409 `CONFLICT` | toast.error + красный баннер, поле slug подсвечивается через ring |
| Невалидный payload | 400 `VALIDATION_ERROR` | toast.error + баннер с `details.fieldErrors` |
| Есть брони при удалении | 409 `CONFLICT` | Информационный баннер с кнопкой «К редактированию» (различаем по тексту ошибки) |
| Cottage не найден | 404 `NOT_FOUND` | toast.error + редирект на /admin/cottages |
| Нет токена / протух | 401 | adminFetch чистит токен, редирект на /admin/login (уже есть) |
| Сеть | catch в adminFetch | toast.error «Нет связи с сервером» (уже есть) |

## Тестирование

**Backend** — vitest + supertest в `backend/src/routes/cottages-admin.test.ts` (co-located):

1. `POST /cottages` с валидным payload → 200, `{success:true, cottage:{...}}`, строка в БД.
2. `POST /cottages` с дублем slug → 409 `CONFLICT`, error содержит 'Slug already exists'.
3. `POST /cottages` с невалидным slug (заглавные, спецсимволы) → 400 `VALIDATION_ERROR`.
4. `POST /cottages` с отрицательной ценой → 400 `VALIDATION_ERROR`.
5. `POST /cottages` без токена → 401.
6. `DELETE /cottages/:id` без броней → 200, каскадно удалены связанные `cottage_images`, `cottage_amenities`, `recreation_items`, `price_rules`.
7. `DELETE /cottages/:id` с активной бронью → 409 `CONFLICT`, ничего не удалено.
8. `DELETE /cottages/:id` несуществующий → 200 (no-op) или 404 — тест закрепит ожидаемое поведение.

**Frontend utils** — vitest:

- `src/lib/translit.test.ts`: набор пар RU → slug.

Smoke-тесты UI не пишем (уже есть `RequireAdmin.test.tsx`; добавление сложной формы потребует mocks всего `adminApi` — out of scope).

## Структура файлов после реализации

```
backend/src/routes/cottages.ts        # + POST, DELETE handlers, + schemas
backend/src/routes/cottages-admin.test.ts  # новый (co-located)
src/lib/adminApi.ts                   # + createAdminCottage, deleteAdminCottage
src/lib/translit.ts                   # новый
src/lib/translit.test.ts              # новый
src/pages/admin/CottagesList.tsx      # + кнопка Создать, + кнопка Удалить
src/pages/admin/CottageEditor.tsx     # + режим create, + поля slug/mapId
```

## Out of scope (явно)

- Синхронизация с `src/lib/cabins.ts` — статический контент для страниц `/booking/*`. Это архитектурная особенность (уже существует для текущего редактирования). Если потребуется, отдельная задача.
- Каскад по `bookings` при удалении — пользователь явно запретил.
- Wizard / multi-step форма создания.
- Редактирование `slug`/`mapId` (можно сделать позже — БД-уровень поддерживает через PATCH).
- SEO-индексация новых домиков (sitemap пересоберётся на следующем `npm run build`).
- Фронтенд-тесты для форм.

## Открытые вопросы

Нет. Все ключевые решения согласованы с пользователем.