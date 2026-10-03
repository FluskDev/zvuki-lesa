### Task 6: Создать корректный Open Graph asset

**Files:**
- Create: `public/og-image.jpg`
- Source asset: `public/cabin-1-enhanced.jpg`

- [ ] **Step 1: Проверить исходный и целевой каталоги**

Run:

```bash
ls "public" && test -f "public/cabin-1-enhanced.jpg"
```

Expected: каталог существует, исходный JPEG найден; `public/og-image.jpg` пока отсутствует либо будет заменён согласованным вариантом.

- [ ] **Step 2: Сгенерировать 1200×630 через уже установленный backend `sharp`**

Run из корня репозитория:

```bash
node --input-type=module -e "import sharp from './backend/node_modules/sharp/dist/index.cjs'; await sharp('public/cabin-1-enhanced.jpg').resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85, mozjpeg: true }).toFile('public/og-image.jpg');"
```

Expected: создан `public/og-image.jpg`. В корневой package не добавляется вторая зависимость `sharp`, а одноразовый helper-файл не создаётся.

- [ ] **Step 3: Проверить формат и размеры программно**

Run:

```bash
node --input-type=module -e "import sharp from './backend/node_modules/sharp/dist/index.cjs'; const m = await sharp('public/og-image.jpg').metadata(); console.log(JSON.stringify({ format: m.format, width: m.width, height: m.height })); if (m.format !== 'jpeg' || m.width !== 1200 || m.height !== 630) process.exit(1);"
```

Expected:

```json
{"format":"jpeg","width":1200,"height":630}
```

- [ ] **Step 4: Проверить ссылки на asset**

Убедиться, что `index.html`, `HomePage.tsx` и `structuredData.ts` используют один абсолютный URL:

```text
https://zvuki-lesa.ru/og-image.jpg
```

Для домиков использовать собственный `mainImage`; `/og-image.jpg` остаётся fallback при пустой строке.

---
