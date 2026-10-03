import { useEffect, useRef, useState } from 'react';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSiteMapElements,
  updateSiteMapElement,
  getToken,
  type SiteMapElement,
  type SiteElementPatch,
} from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AdminNav } from './AdminNav';

interface ElementMeta {
  mapId: string;
  label: string;
  fallbackPhoto: string | null;
  hint: string;
}

const ELEMENTS: ElementMeta[] = [
  {
    mapId: 'Парковка',
    label: 'Парковка',
    fallbackPhoto: null,
    hint: 'Точка на карте `_Парковка`. Используется в диалоге выбора объекта на главной и на странице домика.',
  },
  {
    mapId: 'Лес1',
    label: 'Лес 1',
    fallbackPhoto: null,
    hint: 'Точка на карте `_Лес1`. Ближний лес к домикам.',
  },
  {
    mapId: 'Лес2',
    label: 'Лес 2',
    fallbackPhoto: null,
    hint: 'Точка на карте `_Лес2`. Дальний лес / тропа к реке.',
  },
  {
    mapId: 'чан',
    label: 'Чан',
    fallbackPhoto: '/images/chan.jpg',
    hint: 'Точка на карте `_чан`. По умолчанию стоит заглушка `/images/chan.jpg`.',
  },
];

type FormState = {
  title: string;
  description: string;
  photoUrl: string;
  hasButton: boolean;
};

function rowToForm(row: SiteMapElement | null, fallback: ElementMeta): FormState {
  return {
    title: row?.title ?? fallback.label,
    description: row?.description ?? '',
    photoUrl: row?.photoUrl ?? '',
    hasButton: row?.hasButton ?? false,
  };
}

export default function SiteElements() {
  const [rows, setRows] = useState<Record<string, SiteMapElement | null> | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<Record<string, boolean>>({});

  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () => {
    setLoading(true);
    getSiteMapElements()
      .then((res) => {
        if (!res.success) throw new Error(res.error);
        const data = res.data;
        setRows(data);
        const initial: Record<string, FormState> = {};
        for (const meta of ELEMENTS) {
          initial[meta.mapId] = rowToForm(data[meta.mapId] ?? null, meta);
        }
        setForms(initial);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить данные');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
     
    load();
  }, []);

  const updateForm = (mapId: string, patch: Partial<FormState>) => {
    setForms((prev) => ({ ...prev, [mapId]: { ...prev[mapId], ...patch } }));
  };

  const dirty = (mapId: string): boolean => {
    const form = forms[mapId];
    const row = rows?.[mapId] ?? null;
    const meta = ELEMENTS.find((e) => e.mapId === mapId)!;
    return (
      form.title !== (row?.title ?? meta.label) ||
      form.description !== (row?.description ?? '') ||
      (form.photoUrl || null) !== (row?.photoUrl ?? null) ||
      form.hasButton !== (row?.hasButton ?? false)
    );
  };

  // Загрузка фото в реестр (/api/admin/images) и подстановка полученного пути в photoUrl.
  // alt формируется из названия элемента — для SEO и Schema.org (хотя на карте alt не виден).
  const uploadPhoto = async (mapId: string, file: File) => {
    const meta = ELEMENTS.find((e) => e.mapId === mapId)!;
    setUploadingPhoto((s) => ({ ...s, [mapId]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt', `${meta.label} — фото с карты`);
      const token = getToken();
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok || body.success === false) {
        throw new Error(body.error ?? `Ошибка загрузки (${res.status})`);
      }
      const path: string = body.data.path;
      updateForm(mapId, { photoUrl: path });
      toast.success(`Загружено: ${file.name}`);
      // Очищаем input, чтобы можно было выбрать тот же файл ещё раз.
      const input = fileInputsRef.current[mapId];
      if (input) input.value = '';
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setUploadingPhoto((s) => ({ ...s, [mapId]: false }));
    }
  };

  const save = async (mapId: string) => {
    const form = forms[mapId];
    const patch: SiteElementPatch = {};
    const meta = ELEMENTS.find((e) => e.mapId === mapId)!;
    const row = rows?.[mapId] ?? null;
    if (form.title !== (row?.title ?? meta.label)) patch.title = form.title;
    if (form.description !== (row?.description ?? '')) {
      patch.description = form.description.trim() === '' ? null : form.description;
    }
    const photoTrim = form.photoUrl.trim();
    const nextPhoto = photoTrim === '' ? null : photoTrim;
    if (nextPhoto !== (row?.photoUrl ?? null)) patch.photoUrl = nextPhoto;
    if (form.hasButton !== (row?.hasButton ?? false)) patch.hasButton = form.hasButton;

    if (Object.keys(patch).length === 0) {
      toast.info('Нет изменений');
      return;
    }

    setSaving((s) => ({ ...s, [mapId]: true }));
    const res = await updateSiteMapElement(mapId, patch);
    setSaving((s) => ({ ...s, [mapId]: false }));

    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const updated = (res.data as { data: SiteMapElement }).data;
    setRows((prev) => ({ ...(prev ?? {}), [mapId]: updated }));
    toast.success(`Сохранено: ${meta.label}`);
  };

  return (
    <div className="min-h-screen bg-[#141414] text-neutral-200">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">Элементы карты</h1>
          <p className="text-sm text-neutral-400">
            Парковка, Лес 1/2 и Чан — это статические точки на SVG-карте, которые
            не привязаны к конкретному домику. Здесь можно поменять их название,
            описание и фото (используется на главной и в 3D-модели на странице домика).
          </p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Загрузка…
          </div>
        )}

        {!loading && (
          <div className="space-y-6">
            {ELEMENTS.map((meta) => {
              const form = forms[meta.mapId];
              if (!form) return null;
              const row = rows?.[meta.mapId] ?? null;
              const photoPreview = form.photoUrl.trim() || meta.fallbackPhoto;
              const isSaving = !!saving[meta.mapId];
              const isUploading = !!uploadingPhoto[meta.mapId];
              const isDirty = dirty(meta.mapId);
              return (
                <section
                  key={meta.mapId}
                  className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 sm:p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-white">{meta.label}</h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        mapId: <code className="text-amber-400">{meta.mapId}</code> · {meta.hint}
                      </p>
                    </div>
                    {row && (
                      <span className="text-[10px] text-neutral-600 whitespace-nowrap">
                        обновлено: {new Date(row.updatedAt).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`title-${meta.mapId}`} className="text-neutral-300">
                      Название
                    </Label>
                    <Input
                      id={`title-${meta.mapId}`}
                      value={form.title}
                      onChange={(e) => updateForm(meta.mapId, { title: e.target.value })}
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`desc-${meta.mapId}`} className="text-neutral-300">
                      Описание
                    </Label>
                    <Textarea
                      id={`desc-${meta.mapId}`}
                      value={form.description}
                      onChange={(e) => updateForm(meta.mapId, { description: e.target.value })}
                      rows={3}
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-neutral-300">Фото</Label>

                    {photoPreview ? (
                      <div className="rounded-md overflow-hidden border border-neutral-800 bg-black aspect-video max-w-md">
                        <img
                          src={photoPreview}
                          alt={form.title || meta.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = '0.3';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-neutral-800 bg-neutral-950/40 aspect-video max-w-md flex items-center justify-center text-neutral-600 text-sm">
                        Фото не задано
                      </div>
                    )}

                    {form.photoUrl && (
                      <p className="text-[11px] text-neutral-500 font-mono break-all">
                        текущий URL: {form.photoUrl}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={(el) => { fileInputsRef.current[meta.mapId] = el; }}
                        id={`photo-file-${meta.mapId}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPhoto(meta.mapId, file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploading}
                        onClick={() => fileInputsRef.current[meta.mapId]?.click()}
                        className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1.5" />
                        )}
                        {isUploading ? 'Загружаем…' : 'Загрузить новое фото'}
                      </Button>

                      {form.photoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateForm(meta.mapId, { photoUrl: '' })}
                          className="border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60 hover:text-red-200"
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Убрать фото
                        </Button>
                      )}
                    </div>

                    {meta.fallbackPhoto && (
                      <button
                        type="button"
                        onClick={() => updateForm(meta.mapId, { photoUrl: meta.fallbackPhoto ?? '' })}
                        className="text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                      >
                        сбросить на встроенное ({meta.fallbackPhoto})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`btn-${meta.mapId}`}
                        checked={form.hasButton}
                        onCheckedChange={(v) => updateForm(meta.mapId, { hasButton: v })}
                      />
                      <Label htmlFor={`btn-${meta.mapId}`} className="text-sm text-neutral-300">
                        Показывать кнопку в карточке
                      </Label>
                    </div>

                    <Button
                      onClick={() => save(meta.mapId)}
                      disabled={!isDirty || isSaving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1.5" />
                      )}
                      Сохранить
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
