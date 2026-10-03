# SnapScroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать компонент SnapScroll для плавной привязки секций к snap points при прокрутке колёсиком мыши. Заменить Lenis.

**Architecture:** Компонент будет использовать нативный CSS scroll-snap в сочетании с wheel-событиями для плавного перехода между секциями. Кастомная анимация через CSS transitions и IntersectionObserver для определения текущей секции.

**Tech Stack:** React hooks, IntersectionObserver, CSS scroll-snap, requestAnimationFrame

---

## File Structure

- Create: `src/components/SnapScroll/SnapScroll.tsx` — основной компонент
- Create: `src/components/SnapScroll/SnapScroll.css` — стили компонента
- Modify: `src/main.tsx` — подключение SnapScroll вместо initLenis
- Modify: `src/lib/lenis.ts` — отключение (оставить для обратной совместимости)

---

### Task 1: Создать базовый компонент SnapScroll

**Files:**
- Create: `src/components/SnapScroll/SnapScroll.tsx`

- [ ] **Step 1: Создать компонент с базовой логикой**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import './SnapScroll.css';

interface SnapScrollProps {
  children: React.ReactNode;
  snapType?: 'mandatory' | 'proximity';
}

export function SnapScroll({ children, snapType = 'mandatory' }: SnapScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div 
      ref={containerRef}
      className="snap-scroll-container"
      data-snap-type={snapType}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Добавить CSS стили**

```css
.snap-scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}

.snap-scroll-container section {
  min-height: 100vh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

---

### Task 2: Реализовать плавный scroll через wheel-события

**Files:**
- Modify: `src/components/SnapScroll/SnapScroll.tsx`

- [ ] **Step 1: Добавить state для анимации и refs**

```tsx
const [isScrolling, setIsScrolling] = useState(false);
const [targetSection, setTargetSection] = useState(0);
const sectionsRef = useRef<HTMLElement[]>([]);
const containerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Собрать секции через ref**

```tsx
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  
  const sections = Array.from(container.querySelectorAll('section')) as HTMLElement[];
  sectionsRef.current = sections;
  
  // Установить scroll snap на секциях
  sections.forEach((section, index) => {
    section.dataset.snapIndex = String(index);
  });
}, [children]);
```

- [ ] **Step 3: Обработчик wheel-события с плавной анимацией**

```tsx
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  
  if (isScrolling) return;
  
  const direction = e.deltaY > 0 ? 1 : -1;
  const currentScroll = containerRef.current?.scrollTop || 0;
  
  // Найти текущую секцию
  const containerHeight = window.innerHeight;
  const currentSectionIndex = Math.round(currentScroll / containerHeight);
  let nextSectionIndex = currentSectionIndex + direction;
  
  // Ограничить
  const maxSection = (sectionsRef.current.length || 1) - 1;
  nextSectionIndex = Math.max(0, Math.min(nextSectionIndex, maxSection));
  
  if (nextSectionIndex === currentSectionIndex) return;
  
  setIsScrolling(true);
  setTargetSection(nextSectionIndex);
  
  // Прокрутка к секции
  containerRef.current?.scrollTo({
    top: nextSectionIndex * containerHeight,
    behavior: 'smooth'
  });
  
  // Защита от повторного скролла во время анимации
  setTimeout(() => setIsScrolling(false), 1000);
}, [isScrolling]);
```

- [ ] **Step 4: Подключить слушатель событий**

```tsx
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  
  container.addEventListener('wheel', handleWheel, { passive: false });
  
  return () => {
    container.removeEventListener('wheel', handleWheel);
  };
}, [handleWheel]);
```

---

### Task 3: Добавить остановку на секции

**Files:**
- Modify: `src/components/SnapScroll/SnapScroll.tsx`

- [ ] **Step 1: Отслеживать текущую секцию через scroll-событие**

```tsx
const handleScroll = useCallback(() => {
  const container = containerRef.current;
  if (!container || isScrolling) return;
  
  const containerHeight = window.innerHeight;
  const currentScroll = container.scrollScrollTop || container.scrollTop;
  const sectionIndex = Math.round(currentScroll / containerHeight);
  
  if (sectionIndex !== activeSection) {
    setActiveSection(sectionIndex);
  }
}, [isScrolling, activeSection]);
```

- [ ] **Step 2: Добавить scroll listener**

```tsx
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;
  
  container.addEventListener('scroll', handleScroll, { passive: true });
  
  return () => {
    container.removeEventListener('scroll', handleScroll);
  };
}, [handleScroll]);
```

---

### Task 4: Подключить SnapScroll в приложение

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Обновить main.tsx — удалить initLenis**

```tsx
// Удалить import initLenis
// Удалить вызов initLenis()
```

- [ ] **Step 2: Обернуть App в SnapScroll**

```tsx
// В App.tsx
<div className="snap-scroll-wrapper">
  <SnapScroll>
    <Hero />
    <Cabins />
    <Services />
    <About />
    <Reviews />
    <Gallery />
    <Contacts />
    <Footer />
  </SnapScroll>
</div>
```

- [ ] **Step 3: Добавить CSS для wrapper**

```css
.snap-scroll-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

---

### Task 5: Проверить работу навигации

**Files:**
- Modify: `src/sections/Navigation.tsx`
- Modify: `src/sections/Cabins.tsx`
- Modify: `src/lib/lenis.ts` — scrollToElement должен работать

- [ ] **Step 1: Проверить что scrollToElement работает**

Функция scrollToElement в lenis.ts использует lenis.scrollTo(), который теперь отключен. Нужно обновить эту функцию для использования нативного scrollIntoView или scrollTo.

```tsx
export function scrollToElement(href: string) {
  const element = document.querySelector(href) as HTMLElement;
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
```

---

### Task 6: Тестирование

- [ ] **Step 1: Проверить прокрутку колёсиком — каждая секция должна привязываться**
- [ ] **Step 2: Проверить клик по навигации — переход к секции**
- [ ] **Step 3: Проверить на мобильных устройствах**
- [ ] **Step 4: Проверить что Footer достижим**

---

**Plan saved to:** `docs/superpowers/plans/2026-05-08-snap-scroll.md`

**Which execution approach do you prefer?**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task
2. **Inline Execution** — Execute tasks in this session