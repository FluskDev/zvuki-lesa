import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminApi';
import { TiptapEditor } from '@/components/admin/TiptapEditor';
import { SlugInput } from '@/components/admin/SlugInput';
import { MetaPreview } from '@/components/admin/MetaPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { BlogPost } from './BlogList';

type BlogPostDraft = Omit<BlogPost, 'createdAt' | 'updatedAt'>;

const empty: BlogPostDraft = {
  id: 0,
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  coverImage: null,
  author: 'Команда Звуки Леса',
  category: 'гид',
  readingTimeMin: 5,
  schemaJson: '{}',
  isPublished: false,
  publishedAt: null,
};

const CATEGORIES = [
  'гид',
  'маршруты',
  'сезоны',
  'лагонаки',
  'достопримечательности',
  'развлечения',
  'практика',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BlogEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState<BlogPostDraft>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id || id === 'new') {
        setPage(empty);
        setLoading(false);
        return;
      }
      setLoading(true);
      const r = await adminApi.get<{ data: BlogPost[] }>('/blog-posts');
      if (cancelled) return;
      if (r.success) {
        const found = r.data.data.find((p) => p.id === Number(id));
        if (found) {
          const { createdAt: _c, updatedAt: _u, ...rest } = found;
          setPage(rest);
        } else {
          setError('Не найдено');
        }
      } else {
        setError(r.error);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: _id, ...payload } = page;
      if (page.id) {
        await adminApi.patch(`/blog-posts/${page.id}`, payload);
      } else {
        await adminApi.post('/blog-posts', payload);
      }
      toast.success('Сохранено');
      nav('/admin/blog-posts');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } } | Error;
      const msg = 'response' in err ? err.response?.data?.error : (err as Error).message;
      setError(msg ?? String(e));
      toast.error(msg ?? 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublished = (checked: boolean) => {
    setPage((prev) => ({
      ...prev,
      isPublished: checked,
      publishedAt: checked && !prev.publishedAt ? todayIso() : prev.publishedAt,
    }));
  };

  if (loading) {
    return <div className="dark min-h-screen bg-[#141414] text-white p-4 text-sm text-neutral-500">Загрузка...</div>;
  }

  return (
    <div className="dark min-h-screen bg-[#141414] text-white p-4 space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/admin/blog-posts" className="text-neutral-400 hover:text-white text-sm">← Назад</Link>
          <h2 className="text-2xl font-bold">
            {page.id ? 'Редактирование' : 'Новый'} пост блога
          </h2>
        </div>
        <div className="flex gap-2">
          {page.slug && page.isPublished && (
            <a href={`/blog/${page.slug}`} target="_blank" rel="noreferrer">
              <Button variant="outline" type="button">Предпросмотр</Button>
            </a>
          )}
          <Button onClick={save} disabled={busy}>
            {busy ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 text-red-300 border border-red-900 p-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title (50-70 символов)</Label>
        <Input
          id="title"
          value={page.title}
          onChange={(e) => setPage({ ...page, title: e.target.value })}
          maxLength={70}
        />
        <div className="text-xs text-neutral-500">{page.title.length}/70</div>
      </div>

      <div className="space-y-2">
        <Label>Slug</Label>
        <SlugInput
          value={page.slug}
          sourceTitle={page.title}
          onChange={(v) => setPage({ ...page, slug: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt (200-250 символов)</Label>
        <Textarea
          id="excerpt"
          rows={2}
          value={page.excerpt}
          onChange={(e) => setPage({ ...page, excerpt: e.target.value })}
          maxLength={250}
        />
        <div className="text-xs text-neutral-500">{page.excerpt.length}/250</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverImage">Cover image URL (опц.)</Label>
        <Input
          id="coverImage"
          value={page.coverImage ?? ''}
          onChange={(e) => setPage({ ...page, coverImage: e.target.value || null })}
          placeholder="https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Категория</Label>
          <select
            id="category"
            value={page.category}
            onChange={(e) => setPage({ ...page, category: e.target.value })}
            className="border border-neutral-800 rounded px-2 py-1 w-full bg-transparent text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">Автор</Label>
          <Input
            id="author"
            value={page.author}
            onChange={(e) => setPage({ ...page, author: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Body (HTML)</Label>
        <TiptapEditor
          value={page.body}
          onChange={(v) => setPage({ ...page, body: v })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isPublished"
          checked={page.isPublished}
          onCheckedChange={(c) => handleTogglePublished(!!c)}
        />
        <Label htmlFor="isPublished">Опубликовано</Label>
      </div>

      {page.isPublished && (
        <div className="space-y-2">
          <Label htmlFor="publishedAt">Дата публикации</Label>
          <Input
            id="publishedAt"
            type="date"
            value={page.publishedAt ? page.publishedAt.slice(0, 10) : ''}
            onChange={(e) => setPage({ ...page, publishedAt: e.target.value || null })}
          />
        </div>
      )}

      <div className="border-t border-neutral-800 pt-4">
        <h3 className="font-bold mb-2">Предпросмотр в поиске</h3>
        <MetaPreview
          title={page.title}
          description={page.excerpt}
          slug={`blog/${page.slug}`}
        />
      </div>
    </div>
  );
}
