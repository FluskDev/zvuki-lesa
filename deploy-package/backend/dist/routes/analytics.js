import { Router } from 'express';
import { gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analyticsEvents } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { verifyToken } from '../lib/adminAuth.js';
import { z } from 'zod';
export const analyticsRouter = Router();
const eventSchema = z.object({
    sessionId: z.string().min(1).max(64),
    eventType: z.enum(['pageview', 'click']),
    page: z.string().max(500).optional(),
    label: z.string().max(200).optional(),
    referrer: z.string().max(500).optional(),
});
analyticsRouter.post('/event', async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid event', parsed.error.flatten());
    }
    await db.insert(analyticsEvents).values({
        sessionId: parsed.data.sessionId,
        eventType: parsed.data.eventType,
        page: parsed.data.page ?? null,
        label: parsed.data.label ?? null,
        referrer: parsed.data.referrer ?? null,
        userAgent: req.header('user-agent') ?? null,
    });
    res.json({ success: true });
});
function classifyReferrer(ref) {
    if (!ref)
        return 'direct';
    const r = ref.toLowerCase();
    if (/(yandex|google|bing|duckduckgo|mail\.ru|search)/.test(r))
        return 'search';
    if (/(vk\.com|instagram|t\.me|telegram|whatsapp|facebook|twitter|youtube)/.test(r))
        return 'social';
    return 'referral';
}
export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.get('/analytics', async (req, res) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !verifyToken(token)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация');
    }
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 90);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const fromDate = new Date(today.getTime() - (days - 1) * 86_400_000);
    const fromIso = fromDate.toISOString();
    const todayDate = today.toISOString().slice(0, 10);
    const rows = await db
        .select({
        sessionId: analyticsEvents.sessionId,
        eventType: analyticsEvents.eventType,
        page: analyticsEvents.page,
        label: analyticsEvents.label,
        referrer: analyticsEvents.referrer,
        createdAt: analyticsEvents.createdAt,
    })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, fromDate));
    let totalEvents = rows.length;
    const sessions = new Set();
    const byDayMap = new Map();
    const byPageMap = new Map();
    const byClickMap = new Map();
    const byReferrerMap = new Map();
    let eventsToday = 0;
    const sessionsToday = new Set();
    for (const r of rows) {
        sessions.add(r.sessionId);
        // PG `timestamp` возвращается как Date
        const createdAtStr = (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString();
        const date = createdAtStr.slice(0, 10);
        if (date === todayDate) {
            eventsToday++;
            sessionsToday.add(r.sessionId);
        }
        const day = byDayMap.get(date) ?? { events: 0, sessions: new Set() };
        day.events++;
        day.sessions.add(r.sessionId);
        byDayMap.set(date, day);
        if (r.page) {
            const p = byPageMap.get(r.page) ?? { events: 0, sessions: new Set() };
            p.events++;
            p.sessions.add(r.sessionId);
            byPageMap.set(r.page, p);
        }
        if (r.eventType === 'click' && r.label) {
            byClickMap.set(r.label, (byClickMap.get(r.label) ?? 0) + 1);
        }
        const refClass = classifyReferrer(r.referrer);
        byReferrerMap.set(refClass, (byReferrerMap.get(refClass) ?? 0) + 1);
    }
    const byDay = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(fromDate.getTime() + i * 86_400_000).toISOString().slice(0, 10);
        const e = byDayMap.get(d);
        byDay.push({ date: d, events: e?.events ?? 0, sessions: e?.sessions.size ?? 0 });
    }
    const topPages = Array.from(byPageMap.entries())
        .map(([page, v]) => ({ page, events: v.events, sessions: v.sessions.size }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 20);
    const topClicks = Array.from(byClickMap.entries())
        .map(([label, events]) => ({ label, events }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 20);
    const referrers = Array.from(byReferrerMap.entries())
        .map(([source, events]) => ({ source, events }))
        .sort((a, b) => b.events - a.events);
    res.json({
        success: true,
        analytics: {
            windowDays: days,
            summary: {
                totalEvents,
                totalSessions: sessions.size,
                eventsToday,
                sessionsToday: sessionsToday.size,
            },
            byDay,
            topPages,
            topClicks,
            referrers,
        },
    });
});
