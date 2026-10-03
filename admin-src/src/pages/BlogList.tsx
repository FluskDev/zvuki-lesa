import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { AdminNav } from './AdminNav';
import { StatusBadge, TableRowSkeleton } from './AdminUI';
import { useConfirm } from './ConfirmDialog';

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  author: string;
  category: string;
  readingTimeMin: number;
  schemaJson: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'гид': 'Гид',
  'маршруты': 'Маршруты',
  'сезоны': 'Сезоны',
  'лагонаки': 'Лагонаки',
  'достопримечательности': 'Достопримечательности',
  'развлечения': 'Развлечения',
  'практика': 'Практика',
};

export default function BlogList() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const load = () => {
    setLoading(true);
    adminApi.get<{ data: BlogPost[] }>('/blog-posts')
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
      title: 'Удалить пост блога?',
      description: 'Это действие нельзя отменить.',
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await adminApi.delete(`/blog-posts/${id}`);
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
          <div className="h-7 w-32 bg-neutral-900 rounded animate-pulse" />
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3">Slug</th>
                  <th className="px-3">Title</th>
                  <th className="px-3">Category</th>
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
        <Button asChild size="sm">
          <Link to="/admin/blog-posts/new">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Создать</span>
          </Link>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Блог</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Статьи для SEO и вовлечения. Отсортированы по дате публикации.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 bg-neutral-900/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="py-2.5 px-3">Slug</th>
                <th className="px-3">Title</th>
                <th className="px-3">Категория</th>
                <th className="px-3">Дата</th>
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
                  <td className="px-3 text-neutral-400">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                  <td className="px-3 text-neutral-400 tabular-nums">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-3">
                    {p.isPublished
                      ? <StatusBadge variant="published">Опубликован</StatusBadge>
                      : <StatusBadge variant="draft">Черновик</StatusBadge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
                        <Link to={`/admin/blog-posts/${p.id}`} aria-label="Редактировать">
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
                      <div className="text-neutral-400">Нет постов</div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/blog-posts/new">Создать первый</Link>
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