# Telegram-уведомления о новых бронях — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить второй канал уведомлений о новых бронях — Telegram, параллельно с MAX. Сообщение уходит двум фиксированным получателям (владелец + жена) через Cloudflare Worker-релей.

**Architecture:** Новый модуль `backend/src/services/telegramBot.ts` отправляет сообщения через существующий Cloudflare Worker `lemonadka-tg.ivladok01.workers.dev` (тот же, что использует проект «Сайт Вика»). Воркер универсальный: принимает `{ botToken, chatId, text }` в теле и пересылает в `api.telegram.org`. `notifications.ts` вызывает `broadcastBookingToTelegram` параллельно с уже существующим `broadcastBookingToMax` — падение одного канала не валит другой. Формат сообщения — переиспользуем `formatBookingMessage` из `maxBot.ts` без изменений.

**Tech Stack:** TypeScript 5.9, Express 4, Node 22, Vitest, undici fetch (через глобальный `fetch`). Миграция БД не требуется.

**Спека:** `docs/superpowers/specs/2026-07-18-telegram-notifications-design.md`

---
