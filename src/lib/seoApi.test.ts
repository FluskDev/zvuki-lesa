import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seoApi } from './seoApi';
import { apiFetch } from './api';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));

describe('seoApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list hits /api/seo', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: [] });
    await seoApi.list();
    expect(apiFetch).toHaveBeenCalledWith('/api/seo');
  });

  it('get hits /api/seo/:slug', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: {} });
    await seoApi.get('dahovskaya-adygeya');
    expect(apiFetch).toHaveBeenCalledWith('/api/seo/dahovskaya-adygeya');
  });

  it('blog builds page query', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1 } });
    await seoApi.blog(2);
    expect(apiFetch).toHaveBeenCalledWith('/api/blog?page=2');
  });

  it('blog encodes category', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1 } });
    await seoApi.blog(1, 'гид');
    expect(apiFetch).toHaveBeenCalledWith('/api/blog?page=1&category=%D0%B3%D0%B8%D0%B4');
  });

  it('blogPost hits /api/blog/:slug', async () => {
    (apiFetch as any).mockResolvedValue({ success: true, data: {} });
    await seoApi.blogPost('chto-posmotret-letom');
    expect(apiFetch).toHaveBeenCalledWith('/api/blog/chto-posmotret-letom');
  });
});
