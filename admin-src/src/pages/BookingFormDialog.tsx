import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  createAdminBooking, updateAdminBooking, type AdminBooking,
} from '@/lib/adminApi';
import type { CottageRef } from './OccupancyCalendar';

export interface FormPreset {
  cottageId?: number;
  checkInDate?: string;
  booking?: AdminBooking; // если задано — режим редактирования
}

interface Cottage extends CottageRef { basePrice: number; }

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function BookingFormDialog({
  open, onOpenChange, cottages, preset, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cottages: Cottage[];
  preset: FormPreset;
  onSaved: () => void;
}) {
  const editing = preset.booking;
  const [cottageId, setCottageId] = useState<number>(cottages[0]?.id ?? 0);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Инициализация при открытии
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCottageId(editing.cottageId);
      setGuestName(editing.guestName);
      setPhone(editing.phone);
      setEmail(editing.email ?? '');
      setCheckInDate(editing.checkInDate);
      setCheckOutDate(editing.checkOutDate);
      setGuests(editing.guests);
      setNotes(editing.notes ?? '');
      setManagerComment(editing.managerComment ?? '');
      setPrice(editing.totalPrice);
      setPriceTouched(true);
    } else {
      setCottageId(preset.cottageId ?? cottages[0]?.id ?? 0);
      setGuestName(''); setPhone(''); setEmail('');
      setCheckInDate(preset.checkInDate ?? '');
      setCheckOutDate('');
      setGuests(2); setNotes(''); setManagerComment('');
      setPrice(0); setPriceTouched(false);
    }
  }, [open, editing, preset, cottages]);

  const nights = nightsBetween(checkInDate, checkOutDate);
  const basePrice = useMemo(
    () => cottages.find((c) => c.id === cottageId)?.basePrice ?? 0,
    [cottages, cottageId],
  );

  // Автоподсказка цены, пока пользователь не тронул поле вручную
  useEffect(() => {
    if (!priceTouched) setPrice(basePrice * nights);
  }, [basePrice, nights, priceTouched]);

  async function onSubmit() {
    if (!guestName || !phone || !checkInDate || !checkOutDate) {
      toast.error('Заполни имя, телефон и даты');
      return;
    }
    if (checkOutDate <= checkInDate) {
      toast.error('Дата выезда должна быть позже заезда');
      return;
    }
    setSaving(true);
    const res = editing
      ? await updateAdminBooking(editing.id, {
          guestName, phone, email: email || undefined, checkInDate, checkOutDate,
          guests, notes: notes || undefined, managerComment: managerComment || undefined,
          totalPrice: price,
        })
      : await createAdminBooking({
          cottageId, guestName, phone, email: email || undefined,
          checkInDate, checkOutDate, guests,
          notes: notes || undefined, managerComment: managerComment || undefined,
          priceOverride: price,
        });
    setSaving(false);
    if (res.success) {
      toast.success(editing ? 'Бронь обновлена' : 'Бронь создана');
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(res.error || 'Ошибка сохранения');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать бронь' : 'Новая бронь'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && (
            <Select value={String(cottageId)} onValueChange={(v) => setCottageId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Домик" /></SelectTrigger>
              <SelectContent>
                {cottages.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Имя гостя" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email (необязательно)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-400">Заезд
              <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </label>
            <label className="flex-1 text-xs text-neutral-400">Выезд
              <Input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-400">Гостей
              <Input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
            </label>
            <label className="flex-1 text-xs text-neutral-400">Сумма, ₽ ({nights} ноч.)
              <Input
                type="number" min={0} value={price}
                onChange={(e) => { setPriceTouched(true); setPrice(Number(e.target.value)); }}
              />
            </label>
          </div>
          <Textarea placeholder="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Textarea placeholder="Комментарий менеджера" value={managerComment} onChange={(e) => setManagerComment(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { Cottage as FormCottage };
