import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowUp, ArrowDown, ImageIcon, Loader2, Save, Trash2, Upload, Eye, EyeOff, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  COTTAGE_SECTIONS, COTTAGE_SECTION_LABELS,
  addCottageImage, createAdminCottage, deleteCottageImage, getAdminCottage, getToken,
  listAdminAmenities, updateAdminCottage, updateCottageImage,
  type AdminCottage, type CottageAmenity, type CottageImage, type CottageSection,
} from '@/lib/adminApi';
import { transliterate } from '@/lib/translit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminNav } from './AdminNav';
import { useConfirm } from './ConfirmDialog';
import { AdminSiteMapPicker } from './AdminSiteMapPicker';

interface CottageForm {
  name: string;
  slug: string;
  mapId: string | null;
  mainImage: string;
  shortDescription: string;
  longDescription: string;
  description: string;
  houseRules: string;
  basePrice: number;
  area: number;
  guests: number;
  bedrooms: number;
  bedsDouble: number;
  bedsSingle: number;
  checkInTime: string;
  checkOutTime: string;
  isActive: boolean;
}

const emptyForm: CottageForm = {
  name: '',
  slug: '',
  mapId: null,
  mainImage: '',
  shortDescription: '',
  longDescription: '',
  description: '',
  houseRules: '',
  basePrice: 0,
  area: 0,
  guests: 0,
  bedrooms: 0,
  bedsDouble: 0,
  bedsSingle: 0,
  checkInTime: '15:00',
  checkOutTime: '12:00',
  isActive: true,
};

// Подсказки по alt-тексту для каждой секции. Alt нужен для SEO и доступности:
// коротко описывает, ЧТО на фото, чтобы поисковик и скринридер поняли.
// Правила:
//  • 80–125 символов, на русском.
//  • Сначала что изображено, потом — где/контекст. Не начинать с «Фото…».
//  • Без «фото», «изображение», «картинка» — это и так понятно по тегу alt.
//  • Если есть конкретный объект (фен, душ, кровать king-size) — назвать его.
//  • Для обложки домика — общий план экстерьера, чтобы представлять объект.
const ALT_HINTS: Record<CottageSection, { intro: string; examples: string[] }> = {
  main: {
    intro: 'Обложка домика: общий план, по которому гость представляет объект.',
    examples: [
      'Шале с панорамными окнами и террасой в окружении леса, вечерняя подсветка',
      'Деревянный коттедж с двумя спальнями, вид на реку с крыльца',
    ],
  },
  interior: {
    intro: 'Жилые комнаты: что в кадре + где находится.',
    examples: [
      'Гостиная с камином и большим диваном, второй этаж',
      'Спальня с двуспальной кроватью и видом на лес из окна',
      'Мансарда с двумя односпальными кроватями и рабочим столом',
    ],
  },
  kitchen: {
    intro: 'Кухня и столовая зона.',
    examples: [
      'Полностью оборудованная кухня с индукционной плитой и посудой',
      'Обеденный стол на шесть персон у панорамного окна',
      'Кухонный гарнитур с барной стойкой и холодильником',
    ],
  },
  bathroom: {
    intro: 'Санузлы: что в кадре, для кого (например, основной санузел).',
    examples: [
      'Ванная комната с душевой кабиной и тёплым полом',
      'Основной санузел с дождевым душем и зеркалом с подсветкой',
      'Гостевой туалет на первом этаже',
    ],
  },
  amenities: {
    intro: 'Детали и удобства: конкретный предмет крупным планом.',
    examples: [
      'Фен для волос в ванной комнате',
      'Кофеварка капельного типа с двумя чашками',
      'Полотенца и халаты для гостей сложены на полке',
      'Мангал с шампурами на террасе',
      'Уличная купель с подогревом у домика',
    ],
  },
};

export default function CottageEditor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [cottage, setCottage] = useState<AdminCottage | null>(null);
  const [form, setForm] = useState<CottageForm>(emptyForm);
  const [allAmenities, setAllAmenities] = useState<CottageAmenity[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<number>>(new Set());
  const [slugTouched, setSlugTouched] = useState(false);
  const autoSlug = useMemo(() => transliterate(form.name), [form.name]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setCottage(null);
        setForm(emptyForm);
        setSelectedAmenityIds(new Set());
        setSlugTouched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const [cottageRes, amenitiesRes] = await Promise.all([
        getAdminCottage(Number(id)),
        listAdminAmenities(),
      ]);
      if (cancelled) return;
      if (!cottageRes.success) {
        setError(cottageRes.error);
        setLoading(false);
        return;
      }
      const c = cottageRes.data.cottage;
      setCottage(c);
      setForm({
        name: c.name,
        slug: c.slug,
        mapId: c.mapId,
        mainImage: c.mainImage,
        shortDescription: c.shortDescription,
        longDescription: c.longDescription,
        description: c.description ?? '',
        houseRules: c.houseRules ?? '',
        basePrice: c.basePrice,
        area: c.area,
        guests: c.guests,
        bedrooms: c.bedrooms,
        bedsDouble: c.beds.double,
        bedsSingle: c.beds.single,
        checkInTime: c.checkInTime,
        checkOutTime: c.checkOutTime,
        isActive: c.isActive ?? true,
      });
      setSelectedAmenityIds(new Set(c.amenitiesFull.map((a) => a.id)));
      if (amenitiesRes.success) {
        setAllAmenities(amenitiesRes.data.amenities);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dirty =
    !!cottage &&
    (form.name !== cottage.name ||
      form.shortDescription !== cottage.shortDescription ||
      form.longDescription !== cottage.longDescription ||
      (form.description ?? '') !== (cottage.description ?? '') ||
      (form.houseRules ?? '') !== (cottage.houseRules ?? '') ||
      form.basePrice !== cottage.basePrice ||
      form.area !== cottage.area ||
      form.guests !== cottage.guests ||
      form.bedrooms !== cottage.bedrooms ||
      form.bedsDouble !== cottage.beds.double ||
      form.bedsSingle !== cottage.beds.single ||
      form.checkInTime !== cottage.checkInTime ||
      form.checkOutTime !== cottage.checkOutTime ||
      form.mapId !== (cottage.mapId ?? null) ||
      form.isActive !== (cottage.isActive ?? true));

  const originalAmenityIds = useMemo(
    () => new Set(cottage?.amenitiesFull.map((a) => a.id) ?? []),
    [cottage],
  );
  const amenitiesDirty = useMemo(() => {
    if (selectedAmenityIds.size !== originalAmenityIds.size) return true;
    for (const id of selectedAmenityIds) if (!originalAmenityIds.has(id)) return true;
    return false;
  }, [selectedAmenityIds, originalAmenityIds]);

  const save = async () => {
    if (!form.mainImage.trim()) {
      toast.error('Укажите URL главного фото');
      setError('Укажите URL главного фото');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (cottage) {
        const patch: Record<string, unknown> = {};
        if (dirty) {
          if (form.name !== cottage.name) patch.name = form.name;
          if (form.shortDescription !== cottage.shortDescription) patch.shortDescription = form.shortDescription;
          if (form.longDescription !== cottage.longDescription) patch.longDescription = form.longDescription;
          patch.description = form.description || null;
          patch.houseRules = form.houseRules || null;
          if (form.basePrice !== cottage.basePrice) patch.basePrice = form.basePrice;
          if (form.area !== cottage.area) patch.area = form.area;
          if (form.guests !== cottage.guests) patch.guests = form.guests;
          if (form.bedrooms !== cottage.bedrooms) patch.bedrooms = form.bedrooms;
          if (form.bedsDouble !== cottage.beds.double) patch.bedsDouble = form.bedsDouble;
          if (form.bedsSingle !== cottage.beds.single) patch.bedsSingle = form.bedsSingle;
          if (form.checkInTime !== cottage.checkInTime) patch.checkInTime = form.checkInTime;
          if (form.checkOutTime !== cottage.checkOutTime) patch.checkOutTime = form.checkOutTime;
          if (form.mapId !== (cottage.mapId ?? null)) patch.mapId = form.mapId;
          if (form.isActive !== (cottage.isActive ?? true)) patch.isActive = form.isActive;
        }
        if (amenitiesDirty) {
          patch.amenityIds = Array.from(selectedAmenityIds);
        }
        const r = await updateAdminCottage(cottage.id, patch);
        if (!r.success) {
          toast.error(r.error);
          setError(r.error);
          return;
        }
        setCottage(r.data.cottage);
        toast.success('Сохранено');
      } else {
        const finalSlug = (slugTouched ? form.slug : autoSlug).trim();
        if (!finalSlug) {
          toast.error('Slug пустой — укажите название или введите slug вручную');
          setError('Slug пустой');
          return;
        }
        // mapId опционален: null допустим, домик создаётся без привязки к точке.
        const finalMapId = form.mapId?.trim() || null;
        const r = await createAdminCottage({
          slug: finalSlug,
          mapId: finalMapId,
          name: form.name,
          mainImage: form.mainImage.trim(),
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          description: form.description || null,
          houseRules: form.houseRules || null,
          basePrice: form.basePrice,
          area: form.area,
          guests: form.guests,
          bedrooms: form.bedrooms,
          bedsDouble: form.bedsDouble,
          bedsSingle: form.bedsSingle,
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          isActive: form.isActive,
          amenityIds: Array.from(selectedAmenityIds),
        });
        if (!r.success) {
          toast.error(r.error);
          setError(r.error);
          return;
        }
        toast.success('Создано');
        nav(`/admin/cottages/${r.data.cottage.id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#141414] text-white">
        <AdminNav />
        <main className="p-4 sm:p-6 space-y-4 max-w-5xl">
          <Skeleton className="h-8 w-64 bg-neutral-900" />
          <Skeleton className="h-96 w-full bg-neutral-900" />
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
            <Button variant="outline" onClick={() => nav('/admin/cottages')}>
              К списку домиков
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const hasChanges = dirty || amenitiesDirty;

  return (
    <div className="dark min-h-screen bg-[#141414] text-white">
      <AdminNav>
        <Button onClick={save} disabled={saving || (cottage ? !hasChanges : false)} size="sm">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
          ) : (
            <Save className="h-4 w-4 sm:mr-1.5" />
          )}
          <span className="hidden sm:inline">
            {saving ? 'Сохранение...' : cottage ? 'Сохранить' : 'Создать'}
          </span>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6 space-y-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
            <Link to="/admin/cottages" aria-label="Назад к списку">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {cottage ? cottage.name : 'Новый домик'}
            </h2>
            {cottage ? (
              <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{cottage.slug}</code>
                <span>·</span>
                <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{cottage.mapId || '— не привязан —'}</code>
                {hasChanges && <span className="text-amber-400">· не сохранено</span>}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 mt-0.5">Заполните основные поля и сохраните</div>
            )}
          </div>
        </div>

        <Tabs defaultValue="description" className="space-y-4">
          <TabsList>
            <TabsTrigger value="description">Описание</TabsTrigger>
            <TabsTrigger value="amenities">Удобства</TabsTrigger>
            <TabsTrigger value="photos">Фото</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="space-y-4 outline-none">
            <DescriptionTab
              form={form}
              setForm={setForm}
              slugTouched={slugTouched}
              autoSlug={autoSlug}
              onSlugTouched={() => setSlugTouched(true)}
              onSlugChange={(slug) => setForm((prev) => ({ ...prev, slug }))}
              isCreate={!cottage}
              currentCottageId={cottage?.id}
            />
          </TabsContent>

          <TabsContent value="amenities" className="space-y-4 outline-none">
            <AmenitiesTab
              all={allAmenities}
              selected={selectedAmenityIds}
              onToggle={(amenityId) => {
                setSelectedAmenityIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(amenityId)) next.delete(amenityId);
                  else next.add(amenityId);
                  return next;
                });
              }}
            />
          </TabsContent>

          <TabsContent value="photos" className="space-y-4 outline-none">
            {cottage ? (
              <PhotosTab
                cottageId={cottage.id}
                images={cottage.images}
                mainImage={cottage.mainImage}
                onChange={(images, mainImage) =>
                  setCottage({ ...cottage, images, mainImage })
                }
              />
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40 p-8 text-center text-neutral-500 text-sm">
                Фото можно будет добавить после сохранения домика.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Описание ----------

interface DescriptionTabProps {
  form: CottageForm;
  setForm: React.Dispatch<React.SetStateAction<CottageForm>>;
  slugTouched: boolean;
  autoSlug: string;
  onSlugTouched: () => void;
  onSlugChange: (slug: string) => void;
  isCreate: boolean;
  currentCottageId?: number;
}

function DescriptionTab({
  form, setForm, slugTouched, autoSlug, onSlugTouched, onSlugChange, isCreate, currentCottageId,
}: DescriptionTabProps) {
  const update = <K extends keyof CottageForm>(key: K, value: CottageForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const displayedSlug = slugTouched ? form.slug : autoSlug;

  return (
    <>
      <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-300">Идентификаторы</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={displayedSlug}
              readOnly={!isCreate}
              placeholder="shale-uyut"
              className={!isCreate ? 'bg-neutral-900/50 text-neutral-400' : ''}
              onChange={(e) => {
                if (!isCreate) return;
                onSlugChange(e.target.value);
                onSlugTouched();
              }}
            />
            {isCreate && !slugTouched && form.name && (
              <p className="text-xs text-neutral-500">
                Автогенерация из названия. Измените, чтобы зафиксировать.
              </p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Точка на карте (mapId)</Label>
            <AdminSiteMapPicker
              value={form.mapId}
              onChange={(mapId) => update('mapId', mapId)}
              currentCottageId={currentCottageId}
            />
            {isCreate && (
              <p className="text-xs text-neutral-500">
                Связывает домик с точкой на карте участка. Кликните по нужному домику на карте.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-300">Основное</h3>
        <div className="space-y-1.5">
          <Label htmlFor="mainImage">
            URL главного фото <span className="text-red-400">*</span>
          </Label>
          <Input
            id="mainImage"
            value={form.mainImage}
            onChange={(e) => update('mainImage', e.target.value)}
            placeholder="/images/cottage-main.jpg"
          />
          {isCreate && !form.mainImage.trim() && (
            <p className="text-xs text-amber-400">Обязательное поле — используется как обложка в каталоге.</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Название</Label>
            <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="basePrice">Цена за ночь, ₽</Label>
            <Input
              id="basePrice"
              type="number"
              min={0}
              value={form.basePrice}
              onChange={(e) => update('basePrice', Number(e.target.value) || 0)}
              className="tabular-nums"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shortDescription">Краткое описание (для превью)</Label>
          <Textarea
            id="shortDescription"
            rows={2}
            value={form.shortDescription}
            onChange={(e) => update('shortDescription', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="longDescription">Длинное описание (на странице бронирования)</Label>
          <Textarea
            id="longDescription"
            rows={6}
            value={form.longDescription}
            onChange={(e) => update('longDescription', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Подробное описание (опц.)</Label>
          <Textarea
            id="description"
            rows={6}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Расширенная информация: особенности, история, что входит..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="houseRules">Правила проживания (опц.)</Label>
          <Textarea
            id="houseRules"
            rows={4}
            value={form.houseRules}
            onChange={(e) => update('houseRules', e.target.value)}
            placeholder="Что можно, что нельзя, штрафы, доплаты..."
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-300">Параметры размещения</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="area">Площадь, м²</Label>
            <Input
              id="area"
              type="number"
              min={0}
              value={form.area}
              onChange={(e) => update('area', Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guests">Гостей</Label>
            <Input
              id="guests"
              type="number"
              min={1}
              value={form.guests}
              onChange={(e) => update('guests', Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bedrooms">Спален</Label>
            <Input
              id="bedrooms"
              type="number"
              min={0}
              value={form.bedrooms}
              onChange={(e) => update('bedrooms', Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bedsDouble">Двуспальных кроватей</Label>
            <Input
              id="bedsDouble"
              type="number"
              min={0}
              value={form.bedsDouble}
              onChange={(e) => update('bedsDouble', Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bedsSingle">Односпальных кроватей</Label>
            <Input
              id="bedsSingle"
              type="number"
              min={0}
              value={form.bedsSingle}
              onChange={(e) => update('bedsSingle', Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="checkInTime">Заезд (ЧЧ:ММ)</Label>
            <Input
              id="checkInTime"
              value={form.checkInTime}
              onChange={(e) => update('checkInTime', e.target.value)}
              placeholder="15:00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkOutTime">Выезд (ЧЧ:ММ)</Label>
            <Input
              id="checkOutTime"
              value={form.checkOutTime}
              onChange={(e) => update('checkOutTime', e.target.value)}
              placeholder="12:00"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-neutral-900">
          <Switch
            id="isActive"
            checked={form.isActive}
            onCheckedChange={(v) => update('isActive', !!v)}
          />
          <Label htmlFor="isActive" className="cursor-pointer flex items-center gap-2">
            {form.isActive
              ? <><Eye className="h-4 w-4 text-emerald-400" /> Активен — виден на сайте</>
              : <><EyeOff className="h-4 w-4 text-neutral-500" /> Скрыт — не показывается на сайте</>}
          </Label>
        </div>
      </section>
    </>
  );
}

// ---------- Удобства ----------

interface AmenitiesTabProps {
  all: CottageAmenity[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}

function AmenitiesTab({ all, selected, onToggle }: AmenitiesTabProps) {
  if (all.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500 border border-dashed border-neutral-800 rounded-lg">
        Удобства пока не добавлены. Добавьте их через сид-данные или вручную.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
      <h3 className="text-sm font-semibold text-neutral-300 mb-3">
        Выбрано: {selected.size} из {all.length}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((a) => {
          const checked = selected.has(a.id);
          return (
            <label
              key={a.id}
              className="flex items-center gap-2 px-3 py-2 rounded border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 cursor-pointer"
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(a.id)} />
              <span className="text-sm">{a.name}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Фото ----------

interface PhotosTabProps {
  cottageId: number;
  images: CottageImage[];
  mainImage: string;
  onChange: (images: CottageImage[], mainImage: string) => void;
}

function PhotosTab({ cottageId, images, mainImage, onChange }: PhotosTabProps) {
  return (
    <>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400 space-y-2">
        <p>
          Первое фото в секции <strong className="text-white">«Главная»</strong> автоматически
          становится обложкой домика на сайте. Остальные секции — это группировки для
          страницы бронирования.
        </p>
        {mainImage && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-900">
            <Star className="h-4 w-4 text-amber-400" />
            <span className="text-neutral-300">Текущая обложка:</span>
            <code className="text-xs bg-neutral-900 px-1.5 py-0.5 rounded truncate">{mainImage}</code>
          </div>
        )}
      </div>

      {COTTAGE_SECTIONS.map((section) => (
        <SectionBlock
          key={section}
          cottageId={cottageId}
          section={section}
          allImages={images}
          onChange={onChange}
        />
      ))}
    </>
  );
}

interface SectionBlockProps {
  cottageId: number;
  section: CottageSection;
  allImages: CottageImage[];
  onChange: (images: CottageImage[], mainImage: string) => void;
}

function SectionBlock({ cottageId, section, allImages, onChange }: SectionBlockProps) {
  const [uploading, setUploading] = useState(false);
  const [pendingAlt, setPendingAlt] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { ask, dialog } = useConfirm();

  // Фото только этой секции, отсортированные по позиции.
  const sectionImages = useMemo(
    () => allImages
      .filter((img) => img.section === section)
      .sort((a, b) => a.position - b.position),
    [allImages, section],
  );

  const move = async (image: CottageImage, direction: -1 | 1) => {
    const sorted = sectionImages;
    const idx = sorted.findIndex((i) => i.id === image.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const swapWith = sorted[newIdx];

    const newPosition = image.position;
    const swapPosition = swapWith.position;

    // Оптимистичное обновление — заменяем позиции у двух изображений во ВСЁМ списке.
    const optimisticAll = allImages.map((img) =>
      img.id === image.id
        ? { ...img, position: swapPosition }
        : img.id === swapWith.id
          ? { ...img, position: newPosition }
          : img,
    );
    onChange(optimisticAll, computeMainImage(optimisticAll));

    const [r1, r2] = await Promise.all([
      updateCottageImage(cottageId, image.id, { position: swapPosition }),
      updateCottageImage(cottageId, swapWith.id, { position: newPosition }),
    ]);
    if (!r1.success) toast.error(r1.error);
    if (!r2.success) toast.error(r2.error);
  };

  const remove = (image: CottageImage) => {
    ask({
      title: 'Удалить фото?',
      description: 'Фото будет отвязано от домика, но останется в общем реестре изображений.',
      destructive: true,
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        const r = await deleteCottageImage(cottageId, image.id);
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        const next = allImages.filter((i) => i.id !== image.id);
        onChange(next, computeMainImage(next));
        toast.success('Удалено');
      },
    });
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt', pendingAlt.trim() || `${cottageId} ${section}`);
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
      const uploaded = body.data as { path: string; alt: string };
      const r = await addCottageImage(cottageId, { url: uploaded.path, section });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const next = [...allImages, r.data.image];
      onChange(next, computeMainImage(next));
      setPendingAlt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Загружено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const hint = ALT_HINTS[section];

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 overflow-hidden">
      <header className="p-4 border-b border-neutral-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{COTTAGE_SECTION_LABELS[section]}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{sectionImages.length} фото</p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    value={pendingAlt}
                    onChange={(e) => setPendingAlt(e.target.value)}
                    placeholder="Alt для нового фото"
                    className="w-48 h-8 text-xs"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <p className="font-medium mb-1">{hint.intro}</p>
                  <p className="text-neutral-400">
                    Опишите, ЧТО на фото (80–125 знаков). Не начинайте со слов
                    «фото», «изображение». Сначала объект, затем — где он.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <Upload className="h-4 w-4 mr-1.5" />}
              Загрузить
            </Button>
          </label>
          </div>
        </div>

        <div className="rounded-md bg-neutral-900/60 border border-neutral-800 px-3 py-2.5 space-y-1.5">
          <p className="text-xs text-neutral-300">
            <span className="font-medium text-neutral-100">Как писать alt:</span>{' '}
            {hint.intro}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-neutral-500 self-center">Примеры (нажмите, чтобы подставить):</span>
            {hint.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPendingAlt(ex)}
                className="text-[11px] text-amber-300/90 hover:text-amber-200 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-900/40 rounded px-1.5 py-0.5 transition-colors"
                title="Подставить в поле alt"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </header>

      {sectionImages.length === 0 ? (
        <div className="p-8 text-center text-neutral-500 text-sm border-dashed border-t border-neutral-900">
          <ImageIcon className="h-6 w-6 mx-auto mb-2 text-neutral-700" />
          Нет фото в этой секции
        </div>
      ) : (
        <div className="p-4 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {sectionImages.map((image, idx, sorted) => (
              <div
                key={image.id}
                className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/40 group"
              >
                <div className="aspect-video bg-neutral-800 relative">
                  <img
                    src={image.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {section === 'main' && idx === 0 && (
                    <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-amber-500 text-amber-950 text-xs font-semibold px-1.5 py-0.5 rounded">
                      <Star className="h-3 w-3" />
                      Обложка
                    </div>
                  )}
                </div>
                <div className="p-2 flex items-center justify-between gap-1">
                  <span className="text-xs text-neutral-500">#{idx + 1}</span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-neutral-400 hover:text-white"
                      disabled={idx === 0}
                      onClick={() => move(image, -1)}
                      aria-label="Выше"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-neutral-400 hover:text-white"
                      disabled={idx === sorted.length - 1}
                      onClick={() => move(image, 1)}
                      aria-label="Ниже"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-neutral-400 hover:text-red-400"
                      onClick={() => remove(image)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
      {dialog}
    </section>
  );
}

function computeMainImage(images: CottageImage[]): string {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const firstMain = sorted.find((i) => i.section === 'main');
  return firstMain?.url ?? '';
}