import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Copy, Trash2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getToken } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminNav } from './AdminNav';
import { useConfirm } from './ConfirmDialog';

export interface ImageRow {
  id: number;
  path: string;
  alt: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export default function ImageRegistry() {
  const [items, setItems] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { ask, dialog } = useConfirm();

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/images')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || body.success === false) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setItems(body.data as ImageRow[]);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const resetUploadForm = () => {
    setFile(null);
    setAlt('');
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitUpload = async () => {
    if (!file) {
      toast.error('Выберите файл');
      return;
    }
    if (!alt.trim()) {
      toast.error('Alt обязателен');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt', alt.trim());
      if (caption.trim()) fd.append('caption', caption.trim());
      const token = getToken();
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok || body.success === false) {
        toast.error(body.error ?? `Ошибка загрузки (${res.status})`);
        return;
      }
      toast.success('Загружено');
      resetUploadForm();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const saveAlt = async (id: number, value: string) => {
    const r = await adminApi.patch<{ data: ImageRow }>(`/images/${id}`, { alt: value });
    if (!r.success) {
      toast.error(r.error);
      load();
    }
  };

  const saveCaption = async (id: number, value: string) => {
    const r = await adminApi.patch<{ data: ImageRow }>(`/images/${id}`, {
      caption: value.trim() ? value.trim() : null,
    });
    if (!r.success) {
      toast.error(r.error);
      load();
    }
  };

  const copyUrl = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success('URL скопирован');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const remove = (img: ImageRow) => {
    ask({
      title: 'Удалить картинку?',
      description: `«${img.alt}» будет удалена из реестра и с диска. Это действие нельзя отменить.`,
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await adminApi.delete(`/images/${img.id}`);
        if (r.success) {
          toast.success('Удалено');
          load();
        } else {
          toast.error(r.error);
        }
      },
    });
  };

  return (
    <div className="dark min-h-screen bg-[#141414] text-white">
      <AdminNav />

      <main className="p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Картинки</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Реестр загруженных изображений с alt-текстами для SEO и доступности.
            Сервер автоматически конвертирует JPEG/PNG/WebP/AVIF в WebP.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 text-red-300 border border-red-900 p-3 rounded-md text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Повторить</Button>
          </div>
        )}

        <section className="border border-neutral-800 rounded-lg p-4 space-y-3 bg-neutral-950/40">
          <h3 className="font-semibold text-sm text-neutral-300 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Загрузить новую
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="img-file">Файл (≤5 МБ)</Label>
              <input
                id="img-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-neutral-300 file:mr-2 file:rounded file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-alt">Alt (обязательно)</Label>
              <Input
                id="img-alt"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Описание для SEO и доступности"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-caption">Caption (опц.)</Label>
              <Input
                id="img-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Подпись под фото"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submitUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {uploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
          </div>
        </section>

        {loading && items.length === 0 ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-neutral-800 rounded-lg p-3 space-y-2 bg-neutral-900/40">
                <Skeleton className="h-32 w-full rounded bg-neutral-800" />
                <Skeleton className="h-3 w-20 bg-neutral-900" />
                <Skeleton className="h-8 w-full bg-neutral-900" />
                <Skeleton className="h-8 w-full bg-neutral-900" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 border border-dashed border-neutral-800 rounded-lg space-y-2">
            <ImageIcon className="h-8 w-8 mx-auto text-neutral-700" />
            <div className="text-neutral-400">Нет загруженных картинок</div>
            <div className="text-xs">Загрузите первую с помощью формы выше</div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {items.map((img) => (
              <div
                key={img.id}
                className="border border-neutral-800 rounded-lg p-3 space-y-2 bg-neutral-900/40 hover:border-neutral-700 transition-colors"
              >
                <div className="h-32 w-full overflow-hidden rounded bg-neutral-800 flex items-center justify-center">
                  <img
                    src={img.path}
                    alt={img.alt}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="text-xs text-neutral-500 tabular-nums">
                  {img.width != null && img.height != null
                    ? `${img.width}×${img.height}`
                    : 'размеры ?'}
                </div>
                <Input
                  defaultValue={img.alt}
                  placeholder="Alt"
                  className="text-xs h-8"
                  onBlur={(e) => {
                    if (e.target.value !== img.alt) saveAlt(img.id, e.target.value);
                  }}
                />
                <Input
                  defaultValue={img.caption ?? ''}
                  placeholder="Caption"
                  className="text-xs h-8"
                  onBlur={(e) => {
                    const next = e.target.value;
                    if (next !== (img.caption ?? '')) saveCaption(img.id, next);
                  }}
                />
                <div className="flex flex-col gap-1 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyUrl(img.path)}
                  >
                    <Copy className="h-3 w-3 mr-1.5" />
                    Копировать URL
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    onClick={() => remove(img)}
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" />
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {dialog}
    </div>
  );
}