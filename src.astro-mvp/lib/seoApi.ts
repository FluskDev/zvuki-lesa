import { apiFetch } from './api';

export interface SeoPageListItem {
  id: number; slug: string; title: string; description: string; h1: string;
  metaImage?: string | null; intent: string; priority: number;
}
export interface SeoPage extends SeoPageListItem {
  body: string; schemaJson: string;
}
export interface BlogListItem {
  id: number; slug: string; title: string; excerpt: string;
  coverImage?: string | null; category: string; readingTimeMin: number; publishedAt: string | null;
}
export interface BlogPost extends BlogListItem {
  body: string; author: string; schemaJson: string;
}

export const seoApi = {
  list: () => apiFetch<{ pages: SeoPageListItem[] }>('/seo'),
  get: (slug: string) => apiFetch<{ page: SeoPage }>(`/seo/${slug}`),
  blog: (page = 1, category?: string) => apiFetch<{ data: { items: BlogListItem[]; total: number; page: number; pageSize: number } }>(
    `/blog?page=${page}${category ? `&category=${encodeURIComponent(category)}` : ''}`
  ),
  blogPost: (slug: string) => apiFetch<{ post: BlogPost }>(`/blog/${slug}`),
};
