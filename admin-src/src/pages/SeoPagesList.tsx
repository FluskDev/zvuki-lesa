import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { AdminNav } from './AdminNav';
import { StatusBadge, TableRowSkeleton } from './AdminUI';
import { useConfirm } from './ConfirmDialog';

export interface SeoPage {
  id: number;
  slug: string;
  title: string;
  description: string;
  h1: string;
  metaImage?: string | null;
  intent: string;
  schemaJson: string;
  body: string;
  isPublished: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export default function SeoPagesList() {
  const [items, setItems] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const load = () => {
    setLoading(true);
    adminApi.get<{ pages: SeoPage[] }>('/seo-pages')
      .then((r) => {
        if (r.success) {
          setItems(r.data.pages);
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
      title: 'Удалить SEO-страницу?',
      description: 'Это действие нельзя отменить.',
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await adminApi.delete(`/seo-pages/${id}`);
        if (r.success) load();
        else setError(r.error);
      },
    });
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#141414] text-white">
        <AdminNav />
        <main className="p-4 sm:p-6 space-y-4">
          <div className="h-7 w-40 bg-neutral-900 rounded animate-pulse" />
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-400 bg-neutral-900/50">
                <tr>
                  <th className="py-2 px-3">Slug</th>
                  <th className="px-3">Title</th>
                  <th className="px-3">Intent</th>
                  <th className="px-3">Priority</th>
                  <th className="px-3">Status</th>
                  <th className="px-3"></th>
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
        <Button asChild size="sm">
          <Link to="/admin/seo-pages/new">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">SEO-страницы</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Посадочные страницы под поисковые интенты. Черновики не видны посетителям до публикации.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="py-2.5 px-3">Slug</th>
                <th className="px-3">Title</th>
                <th className="px-3">Intent</th>
                <th className="px-3">Priority</th>
                <th className="px-3">Статус</th>
                <th className="px-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-neutral-800 hover:bg-neutral-900/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <code className="text-xs text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded">{p.slug}</code>
                  </td>
                  <td className="px-3 max-w-md">
                    <div className="truncate font-medium">{p.title}</div>
                  </td>
                  <td className="px-3 text-neutral-400">{p.intent}</td>
                  <td className="px-3 tabular-nums text-neutral-300">{p.priority.toFixed(2)}</td>
                  <td className="px-3">
                    {p.isPublished
                      ? <StatusBadge variant="published">Опубликована</StatusBadge>
                      : <StatusBadge variant="draft">Черновик</StatusBadge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
                        <Link to={`/admin/seo-pages/${p.id}`} aria-label="Редактировать">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-400"
                        onClick={() => remove(p.id)}
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
                      <div className="text-neutral-400">Нет страниц</div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/seo-pages/new">Создать первую</Link>
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