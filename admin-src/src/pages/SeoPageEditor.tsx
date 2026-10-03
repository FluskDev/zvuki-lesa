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
import type { SeoPage } from './SeoPagesList';

type SeoPageDraft = Omit<SeoPage, 'createdAt' | 'updatedAt'>;

const empty: SeoPageDraft = {
  id: 0,
  slug: '',
  title: '',
  description: '',
  h1: '',
  body: '',
  intent: '',
  schemaJson: '{}',
  isPublished: false,
  priority: 0.7,
  metaImage: null,
};

const INTENTS = [
  'горы-адыгеи',
  'термальные-источники',
  'лагонаки',
  'даховская',
  'домики',
  'активности',
  'сезоны',
];

export default function SeoPageEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState<SeoPageDraft>(empty);
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
      const r = await adminApi.get<{ pages: SeoPage[] }>('/seo-pages');
      if (cancelled) return;
      if (r.success) {
        const found = r.data.pages.find((p) => p.id === Number(id));
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
      if (page.id) {
        await adminApi.patch(`/seo-pages/${page.id}`, page);
      } else {
        await adminApi.post('/seo-pages', page);
      }
      toast.success('Сохранено');
      nav('/admin/seo-pages');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } } | Error;
      const msg = 'response' in err ? err.response?.data?.error : (err as Error).message;
      setError(msg ?? String(e));
      toast.error(msg ?? 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="dark min-h-screen bg-[#141414] text-white p-4 text-sm text-neutral-500">Загрузка...</div>;
  }

  return (
    <div className="dark min-h-screen bg-[#141414] text-white p-4 space-y-4 max-w-4xl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/admin/seo-pages" className="text-neutral-400 hover:text-white text-sm">← Назад</Link>
          <h2 className="text-2xl font-bold">
            {page.id ? 'Редактирование' : 'Новая'} SEO-страница
          </h2>
        </div>
        <div className="flex gap-2">
          {page.slug && (
            <a href={`/seo/${page.slug}`} target="_blank" rel="noreferrer">
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
        <Label htmlFor="description">Description (150-160 символов)</Label>
        <Textarea
          id="description"
          rows={2}
          value={page.description}
          onChange={(e) => setPage({ ...page, description: e.target.value })}
          maxLength={160}
        />
        <div className="text-xs text-neutral-500">{page.description.length}/160</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="h1">H1</Label>
        <Input
          id="h1"
          value={page.h1}
          onChange={(e) => setPage({ ...page, h1: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="intent">Intent</Label>
          <select
            id="intent"
            value={page.intent}
            onChange={(e) => setPage({ ...page, intent: e.target.value })}
            className="border border-neutral-800 rounded px-2 py-1 w-full bg-transparent text-sm"
          >
            <option value="">— выбрать —</option>
            {INTENTS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority (0-1)</Label>
          <Input
            id="priority"
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={page.priority}
            onChange={(e) => setPage({ ...page, priority: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaImage">Meta image URL (опц.)</Label>
        <Input
          id="metaImage"
          value={page.metaImage ?? ''}
          onChange={(e) => setPage({ ...page, metaImage: e.target.value || null })}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label>Body (HTML)</Label>
        <TiptapEditor
          value={page.body}
          onChange={(v) => setPage({ ...page, body: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schemaJson">Schema.org JSON-LD</Label>
        <Textarea
          id="schemaJson"
          rows={4}
          value={page.schemaJson}
          onChange={(e) => setPage({ ...page, schemaJson: e.target.value })}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isPublished"
          checked={page.isPublished}
          onCheckedChange={(c) => setPage({ ...page, isPublished: !!c })}
        />
        <Label htmlFor="isPublished">Опубликовано</Label>
      </div>

      <div className="border-t border-neutral-800 pt-4">
        <h3 className="font-bold mb-2">Предпросмотр в поиске</h3>
        <MetaPreview
          title={page.title}
          description={page.description}
          slug={`seo/${page.slug}`}
        />
      </div>
    </div>
  );
}
