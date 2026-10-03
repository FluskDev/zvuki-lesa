# Hero Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать слайдер для Hero секции с drag-свайпом и автопрокруткой

**Architecture:** Embla Carousel с кастомным autoplay и drag-свайпом

**Tech Stack:** embla-carousel-react, React hooks

---

### Task 1: Создать HeroCarousel.tsx

**Files:**
- Create: `src/components/HeroCarousel/HeroCarousel.tsx`
- Create: `src/components/HeroCarousel/HeroCarousel.module.css`

**Context:** HeroCarousel — новый компонент для замены VideoBackground. Использует embla-carousel-react (уже установлен в проекте). Поддерживает drag-свайп и автоматическую прокрутку.

**Requirements:**
- Пропсы: `slides: string[]`, `autoplayInterval?: number` (default 6000ms)
- loop: true (после последнего — первый)
- dragEnabled: true (разрешить свайп мышкой)
- При свайпе пользователем — паузить autoplay
- После каждого свайпа — сбрасывать таймер autoplay
- Индикаторы внизу: круглые точки, активная — белая, неактивные — полупрозрачные

---

### Task 2: Обновить Hero.tsx

**Files:**
- Modify: `src/sections/Hero.tsx`

**Context:** Заменить VideoBackground на HeroCarousel. Слайды те же что были в VideoBackground.

**Requirements:**
- Импортировать HeroCarousel
- Передать слайды:
  - `/cabin-1.jpg`
  - `/services/rafting/photo_43_2026-04-26_11-45-32.jpg`
  - `/services/jeeping/photo_6_2026-04-26_11-45-32.jpg`
  - `/services/bath-cham/photo_29_2026-04-26_11-45-32.jpg`
- autoplayInterval={6000}

---

### Task 3: Удалить VideoBackground

**Files:**
- Delete: `src/components/VideoBackground/VideoBackground.tsx`
- Delete: `src/components/VideoBackground/VideoBackground.module.css`

**Context:** Компонент VideoBackground больше не нужен, заменён на HeroCarousel.

**Requirements:**
- Удалить оба файла
- Удалить папку VideoBackground если пуста