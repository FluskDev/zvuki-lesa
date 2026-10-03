# Hero Slider Design

## Overview

Превратить Hero секцию в автоматический слайдер с crossfade переходами и прогрессивными индикаторами времени.

## Images

1. `/cabin-1.jpg`
2. `/services/rafting/photo_43_2026-04-26_11-45-32.jpg`
3. `/services/jeeping/photo_6_2026-04-26_11-45-32.jpg`
4. `/services/bath-cham/photo_29_2026-04-26_11-45-32.jpg`

## Behavior

- Автоматическая смена каждые 6 секунд
- Crossfade переход (~1 секунда)
- После 4-го слайда — возврат к 1-му (бесконечный цикл)

## Indicator Style

- 4 круга внизу по центру
- Неактивные: белый контур (border)
- Активный: заполнение по часовой стрелке за 6 секунд (SVG circle with stroke-dasharray/dashoffset animation)
- После заполнения — переход к следующему слайду

## Files to Modify

- `src/components/VideoBackground/VideoBackground.tsx` — логика слайдера
- `src/components/VideoBackground/VideoBackground.module.css` — стили и анимации