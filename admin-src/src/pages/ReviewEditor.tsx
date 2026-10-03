import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MetaPreview } from '@/components/admin/MetaPreview';
import { ReviewAvatar } from '@/components/ReviewAvatar';
import type { AdminReview } from './ReviewsList';

type ReviewDraft = Omit<AdminReview, 'createdAt' | 'updatedAt'>;

const empty: ReviewDraft = {
  id: 0,
  authorName: '',
  rating: 5,
  text: '',
  date: new Date().toISOString(),
  source: 'manual',
  isPublished: false,
  avatarUrl: null,
  authorUrl: null,
};

const SOURCES: AdminReview['source'][] = ['2gis', 'yandex', 'google', 'manual'];

export default function ReviewEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState<ReviewDraft>(empty);
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
      const r = await adminApi.get<{ data: AdminReview[] }>('/reviews');
      if (cancelled) return;
      if (r.success) {
        const found = r.data.data.find((rv) => rv.id === Number(id));
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
      // avatarUrl подтягивается автоматически из Яндекса в syncYandexReviews.
      // Ручное редактирование через админку не предусмотрено — убираем из payload.
      const { id: _id, avatarUrl: _avatar, ...payload } = page;
      if (page.id) {
        await adminApi.patch(`/reviews/${page.id}`, payload);
      } else {
        await adminApi.post('/reviews', payload);
      }
      toast.success('Сохранено');
      nav('/admin/reviews');
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
    return (
      <div className="dark min-h-screen bg-[#141414] text-white p-4 text-sm text-neutral-500">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-[#141414] text-white p-4 space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/admin/reviews" className="text-neutral-400 hover:text-white text-sm">
            ← Назад
          </Link>
          <h2 className="text-2xl font-bold">
            {page.id ? 'Редактирование' : 'Новый'} отзыв
          </h2>
        </div>
        <div className="flex gap-2">
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

      <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/40">
        <ReviewAvatar src={page.avatarUrl} name={page.authorName} size={48} />
        <div className="text-xs text-neutral-500 leading-relaxed">
          Аватар загружается автоматически при синхронизации с Яндексом.
          {page.avatarUrl
            ? ` Сейчас: ${page.avatarUrl}`
            : ' Пока не подтянут (можно запустить «Обновить с Яндекса» в списке).'}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="authorName">Имя автора</Label>
        <Input
          id="authorName"
          value={page.authorName}
          onChange={(e) => setPage({ ...page, authorName: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rating">Оценка (1-5)</Label>
          <select
            id="rating"
            value={page.rating}
            onChange={(e) => setPage({ ...page, rating: Number(e.target.value) })}
            className="border border-neutral-800 rounded px-2 py-1 w-full bg-transparent text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Источник</Label>
          <select
            id="source"
            value={page.source}
            onChange={(e) =>
              setPage({ ...page, source: e.target.value as AdminReview['source'] })
            }
            className="border border-neutral-800 rounded px-2 py-1 w-full bg-transparent text-sm"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Дата отзыва</Label>
        <Input
          id="date"
          type="datetime-local"
          value={page.date ? page.date.slice(0, 16) : ''}
          onChange={(e) =>
            setPage({
              ...page,
              date: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString(),
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">Текст отзыва (20-2000 символов)</Label>
        <Textarea
          id="text"
          rows={6}
          value={page.text}
          onChange={(e) => setPage({ ...page, text: e.target.value })}
          maxLength={2000}
        />
        <div className="text-xs text-neutral-500">{page.text.length}/2000</div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isPublished"
          checked={page.isPublished}
          onCheckedChange={(c) => setPage({ ...page, isPublished: !!c })}
        />
        <Label htmlFor="isPublished">Опубликовано</Label>
      </div>

      {page.isPublished && (
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="font-bold mb-2">Превью сниппета</h3>
          <MetaPreview
            title={`Отзыв: ${page.authorName || 'Гость'}`}
            description={page.text}
            slug="reviews"
          />
        </div>
      )}
    </div>
  );
}
