import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { AdminNav } from './AdminNav';
import { TableRowSkeleton } from './AdminUI';
import { useConfirm } from './ConfirmDialog';

export interface AdminCottageRow {
  id: number;
  slug: string;
  mapId: string;
  name: string;
  shortDescription: string;
  basePrice: number;
  area: number;
  guests: number;
  mainImage: string;
  isActive: boolean;
}

export default function CottagesList() {
  const [items, setItems] = useState<AdminCottageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { ask, dialog } = useConfirm();
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  const remove = (id: number, name: string) => {
    ask({
      title: `Удалить домик «${name}»?`,
      description: 'Все фото, удобства и ценовые правила этого домика также будут удалены. Это действие нельзя отменить.',
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await adminApi.delete(`/cottages/${id}`);
        if (r.success) {
          toast.success('Удалено');
          load();
        } else if (r.code === 'CONFLICT' && r.error.includes('бронирован')) {
          toast.error('Нельзя удалить: у домика есть бронирования');
          setInfoBanner(`У домика «${name}» есть бронирования. Скройте его через редактирование → Активен.`);
          setTimeout(() => setInfoBanner(null), 8000);
        } else {
          toast.error(r.error);
          setError(r.error);
        }
      },
    });
  };

  const load = () => {
    setLoading(true);
    adminApi.get<{ cottages: AdminCottageRow[] }>('/cottages')
      .then((r) => {
        if (r.success) {
          setItems(r.data.cottages);
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

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#141414] text-white">
        <AdminNav />
        <main className="p-4 sm:p-6 space-y-4">
          <div className="h-7 w-40 bg-neutral-900 rounded animate-pulse" />
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3">Превью</th>
                  <th className="px-3">Название</th>
                  <th className="px-3">Slug / Map</th>
                  <th className="px-3">Цена</th>
                  <th className="px-3">Площадь</th>
                  <th className="px-3">Гости</th>
                  <th className="px-3">Статус</th>
                  <th className="px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)}
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
        <Button asChild size="sm">
          <Link to="/admin/cottages/new">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6 space-y-4">
        {infoBanner && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200 flex items-start justify-between gap-3">
            <span>{infoBanner}</span>
            <button
              type="button"
              onClick={() => setInfoBanner(null)}
              className="text-amber-400 hover:text-amber-200 shrink-0"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold tracking-tight">Домики</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Описания, удобства и фотографии. Изменения видны на сайте сразу после сохранения.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="py-2.5 px-3">Превью</th>
                <th className="px-3">Название</th>
                <th className="px-3">Slug / Map ID</th>
                <th className="px-3">Цена / ночь</th>
                <th className="px-3">Площадь</th>
                <th className="px-3">Гости</th>
                <th className="px-3">Статус</th>
                <th className="px-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/40 transition-colors">
                  <td className="py-2 px-3">
                    {c.mainImage ? (
                      <img
                        src={c.mainImage}
                        alt={c.name}
                        className="w-14 h-10 object-cover rounded bg-neutral-800"
                      />
                    ) : (
                      <div className="w-14 h-10 rounded bg-neutral-900 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-neutral-700" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 font-medium">{c.name}</td>
                  <td className="px-3 text-neutral-400">
                    <code className="text-xs">{c.slug}</code>
                    <span className="text-neutral-600 mx-1.5">·</span>
                    <code className="text-xs">{c.mapId}</code>
                  </td>
                  <td className="px-3 tabular-nums">{c.basePrice.toLocaleString('ru-RU')} ₽</td>
                  <td className="px-3 tabular-nums text-neutral-400">{c.area} м²</td>
                  <td className="px-3 tabular-nums text-neutral-400">до {c.guests}</td>
                  <td className="px-3">
                    {c.isActive
                      ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Eye className="h-3.5 w-3.5" />
                          Активен
                        </span>
                      )
                      : (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                          <EyeOff className="h-3.5 w-3.5" />
                          Скрыт
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
                        <Link to={`/admin/cottages/${c.id}`} aria-label="Редактировать">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-400"
                        onClick={() => remove(c.id, c.name)}
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
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    Нет домиков
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