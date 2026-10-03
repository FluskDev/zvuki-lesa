import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { services } from '../db/schema.js';
export const servicesRouter = Router();
servicesRouter.get('/', async (_req, res) => {
    const all = await db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.position));
    res.json({
        success: true,
        services: all.map((s) => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            description: s.description,
            basePrice: s.basePrice,
            icon: s.icon,
        })),
    });
});
