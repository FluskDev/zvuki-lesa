import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, Star, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { ReviewAvatar } from '@/components/ReviewAvatar';
import { AdminNav } from './AdminNav';
import { StatusBadge, TableRowSkeleton } from './AdminUI';
import { useConfirm } from './ConfirmDialog';

export interface AdminReview {
  id: number;
  authorName: string;
  rating: number;
  text: string;
  date: string;
  source: '2gis' | 'yandex' | 'google' | 'manual';
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  avatarUrl: string | null;
  authorUrl: string | null;
}

const SOURCE_LABELS: Record<AdminReview['source'], string> = {
  '2gis': '2ГИС',
  yandex: 'Яндекс',
  google: 'Google',
  manual: 'Вручную',
};

export default function ReviewsList() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { ask, dialog } = useConfirm();

  interface SyncStats {
    fetched: number;
    inserted: number;
    updated: number;
    unchanged: number;
    errors: Array<{ message: string }>;
    durationMs: number;
  }

  const syncFromYandex = async () => {
    setSyncing(true);
    const toastId = toast.loading('Парсим Яндекс.Карты… обычно 10–60 секунд');
    try {
      const r = await adminApi.post<{ data: SyncStats }>('/reviews/sync-yandex', {});
      toast.dismiss(toastId);
      if (!r.success) {
        toast.error(`Не удалось синхронизировать: ${r.error}`);
        return;
      }
      const s = r.data.data;
      if (s.errors.length > 0) {
        toast.error(`Синхронизация с ошибкой: ${s.errors[0].message}`);
      } else {
        toast.success(
          `Готово за ${(s.durationMs / 1000).toFixed(1)} с: +${s.inserted} новых, обновлено ${s.updated}`,
        );
      }
      load();
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const load = () => {
    setLoading(true);
    adminApi
      .get<{ data: AdminReview[] }>('/reviews')
      .then((r) => {
        if (r.success) {
          setItems(r.data.data);
          setError(null);
        } else {
          setError(r.error);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: number) => {
    ask({
      title: 'Удалить отзыв?',
      description: 'Это действие нельзя отменить.',
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await adminApi.delete(`/reviews/${id}`);
        if (r.success) load();
        else setError(r.error);
      },
    });
  };

  const togglePublish = async (id: number, current: boolean) => {
    const next = !current;
    // Оптимистичное обновление: меняем сразу, чтобы не ждать ответа.
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, isPublished: next } : r)));
    setTogglingId(id);
    try {
      const r = await adminApi.patch(`/reviews/${id}`, { isPublished: next });
      if (!r.success) {
        // Откатываем, если бэкенд не принял.
        setItems((prev) => prev.map((r2) => (r2.id === id ? { ...r2, isPublished: current } : r2)));
        toast.error(`Не удалось изменить статус: ${r.error}`);
      }
    } catch (e) {
      setItems((prev) => prev.map((r2) => (r2.id === id ? { ...r2, isPublished: current } : r2)));
      toast.error(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#141414] text-white">
        <AdminNav />
        <main className="p-4 sm:p-6 space-y-4">
          <div className="h-7 w-32 bg-neutral-900 rounded animate-pulse" />
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3">Автор</th>
                  <th className="px-3">Оценка</th>
                  <th className="px-3">Источник</th>
                  <th className="px-3">Дата</th>
                  <th className="px-3">Статус</th>
                  <th className="px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dark min-h-screen bg-[#141414] text-white">
        <AdminNav />
        <main className="p-4 sm:p-6">
          <div className="max-w-md mx-auto text-center py-16 space-y-3">
            <div className="text-red-400 font-medium">Ошибка загрузки</div>
            <p className="text-sm text-neutral-400">{error}</p>
            <Button variant="outline" onClick={load}>Попробовать ещё раз</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-[#141414] text-white">
      <AdminNav>
        <Button
          variant="outline"
          size="sm"
          onClick={syncFromYandex}
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 sm:mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">
            {syncing ? 'Синхронизируем…' : 'Обновить с Яндекса'}
          </span>
        </Button>
        <Button asChild size="sm">
          <Link to="/admin/reviews/new">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Отзывы</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Используются в блоке отзывов и Schema.org aggregateRating на лендинге.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="py-2.5 px-3">Автор</th>
                <th className="px-3">Оценка</th>
                <th className="px-3">Источник</th>
                <th className="px-3">Дата</th>
                <th className="px-3">Статус</th>
                <th className="px-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/40 transition-colors">
                  <td className="py-2.5 px-3 max-w-xs">
                    <div className="flex items-center gap-2.5">
                      <ReviewAvatar src={r.avatarUrl} name={r.authorName} size={32} />
                      <span className="truncate font-medium">{r.authorName}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center gap-0.5 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="tabular-nums text-neutral-200">{r.rating}</span>
                    </span>
                  </td>
                  <td className="px-3 text-neutral-400">{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className="px-3 text-neutral-400 tabular-nums">
                    {new Date(r.date).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-3">
                    <button
                      type="button"
                      onClick={() => togglePublish(r.id, r.isPublished)}
                      disabled={togglingId === r.id}
                      title={
                        r.isPublished
                          ? 'Опубликован — кликните, чтобы снять с публикации'
                          : 'Черновик — кликните, чтобы опубликовать'
                      }
                      aria-label={
                        r.isPublished
                          ? 'Снять с публикации'
                          : 'Опубликовать'
                      }
                      className="inline-flex items-center rounded-full outline-none transition-transform hover:scale-[1.04] active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {r.isPublished
                        ? <StatusBadge variant="published">Опубликован</StatusBadge>
                        : <StatusBadge variant="draft">Черновик</StatusBadge>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
                        <Link to={`/admin/reviews/${r.id}`} aria-label="Редактировать">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-400"
                        onClick={() => remove(r.id)}
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-500">
                    <div className="space-y-2">
                      <div className="text-neutral-400">Нет отзывов</div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/reviews/new">Добавить первый</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      {dialog}
    </div>
  );
}