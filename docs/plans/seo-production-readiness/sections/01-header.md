# SEO Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить SEO-контур к production-сборке: получать prerender-маршруты из PostgreSQL, формировать корректные metadata и JSON-LD для главной и домиков и проверять итоговый статический HTML.

**Architecture:** Root prebuild напрямую и только на чтение запрашивает опубликованные slug из PostgreSQL и формирует manifest для Puppeteer-prerender. React-маршруты владеют своими metadata и Schema.org-разметкой через расширенный `useDocumentHead`; данные отзывов загружаются один раз на главной и используются одновременно UI и структурированными данными. Production-БД и reverse proxy не изменяются — для них формируется проверочный чек-лист.

**Tech Stack:** React 19, React Router 6, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, PostgreSQL 18, `postgres` 3, Puppeteer 25, Schema.org JSON-LD.

---
