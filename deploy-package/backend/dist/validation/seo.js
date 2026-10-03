import { z } from 'zod';
const slugRegex = /^[a-z0-9-]+$/;
export const seoPageInputSchema = z.object({
    slug: z.string().regex(slugRegex, 'Только a-z, 0-9 и дефис'),
    title: z.string().min(50).max(70),
    description: z.string().min(150).max(160),
    h1: z.string().min(10).max(120),
    body: z.string().min(500).max(8000),
    metaImage: z.string().url().optional().nullable(),
    intent: z.string().min(2).max(50),
    schemaJson: z.string().refine((v) => {
        try {
            JSON.parse(v);
            return true;
        }
        catch {
            return false;
        }
    }, 'Должен быть валидный JSON'),
    isPublished: z.boolean().default(false),
    priority: z.number().min(0).max(1).default(0.7),
});
export const seoPagePatchSchema = seoPageInputSchema.partial();
export const blogPostInputSchema = z.object({
    slug: z.string().regex(slugRegex),
    title: z.string().min(50).max(70),
    excerpt: z.string().min(200).max(250),
    body: z.string().min(1000).max(10000),
    coverImage: z.string().url().optional().nullable(),
    author: z.string().default('Команда Звуки Леса'),
    category: z.enum(['гид', 'маршруты', 'сезоны', 'лагонаки', 'достопримечательности', 'развлечения', 'практика']),
    readingTimeMin: z.number().int().min(1).max(60).default(5),
    schemaJson: z.string().refine((v) => {
        try {
            JSON.parse(v);
            return true;
        }
        catch {
            return false;
        }
    }),
    isPublished: z.boolean().default(false),
    publishedAt: z.coerce.date().optional().nullable(),
});
export const blogPostPatchSchema = blogPostInputSchema.partial();
export const imageInputSchema = z.object({
    alt: z.string().min(5).max(200),
    caption: z.string().max(300).optional().nullable(),
});
export const imagePatchSchema = imageInputSchema.partial();
export const reviewInputSchema = z.object({
    authorName: z.string().min(2).max(100),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(20).max(2000),
    date: z.coerce.date().optional(),
    source: z.enum(['2gis', 'yandex', 'google', 'manual']).default('manual'),
    isPublished: z.boolean().default(false),
});
export const reviewPatchSchema = reviewInputSchema.partial();
