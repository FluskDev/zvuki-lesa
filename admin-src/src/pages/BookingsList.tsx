import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronDown, Phone, Mail, Users, MessageSquare, ListChecks, Wallet } from 'lucide-react';
import type { AdminBooking } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StatusFilter = 'all' | 'new' | 'confirmed' | 'cancelled';

const STATUS_LABEL: Record<AdminBooking['status'], string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
};
const STATUS_VARIANT: Record<AdminBooking['status'], 'default' | 'secondary' | 'destructive'> = {
  new: 'default',
  confirmed: 'secondary',
  cancelled: 'destructive',
};

function fmt(d: string) {
  return format(new Date(d), 'd MMM', { locale: ru });
}
function fmtFull(d: string) {
  return format(new Date(d), 'd MMMM yyyy', { locale: ru });
}

export function BookingsList({
  bookings,
  filter,
  onFilterChange,
  onConfirm,
  onCancel,
  onEdit,
}: {
  bookings: AdminBooking[];
  filter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  onConfirm: (b: AdminBooking) => void;
  onCancel: (b: AdminBooking) => void;
  onEdit: (b: AdminBooking) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const toggle = (id: number) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-3">
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="new">Новые</TabsTrigger>
          <TabsTrigger value="confirmed">Подтверждённые</TabsTrigger>
          <TabsTrigger value="cancelled">Отменённые</TabsTrigger>
        </TabsList>
      </Tabs>

      {bookings.length === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">Броней нет</p>
      ) : (
        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {bookings.map((b) => {
            const isOpen = expandedId === b.id;
            return (
              <div key={b.id} className="text-sm">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-neutral-900/50"
                  onClick={() => toggle(b.id)}
                  aria-expanded={isOpen}
                >
                  <ChevronDown
                    className={`size-4 shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                  <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                  <span className="font-medium">{b.guestName}</span>
                  <span className="text-neutral-400">{b.cottageName}</span>
                  <span className="text-neutral-400">
                    {fmt(b.checkInDate)} – {fmt(b.checkOutDate)}
                  </span>
                  {b.source === 'manual' && (
                    <span className="text-xs text-neutral-500">(вручную)</span>
                  )}
                  <span className="ml-auto font-medium">
                    {b.totalPrice.toLocaleString('ru')} ₽
                  </span>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {b.status === 'new' && (
                      <Button size="sm" variant="outline" onClick={() => onConfirm(b)}>
                        Подтвердить
                      </Button>
                    )}
                    {b.status !== 'cancelled' && (
                      <Button size="sm" variant="ghost" onClick={() => onCancel(b)}>
                        Отменить
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onEdit(b)}>
                      Ред.
                    </Button>
                  </div>
                </button>

                {isOpen && <BookingDetails booking={b} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingDetails({ booking: b }: { booking: AdminBooking }) {
  return (
    <div className="grid gap-4 border-t border-neutral-800 bg-neutral-900/40 p-4 sm:grid-cols-2">
      <Detail icon={<Phone className="size-4" />} label="Телефон">
        <a href={`tel:${b.phone}`} className="text-blue-400 hover:underline">
          {b.phone}
        </a>
      </Detail>
      {b.email && (
        <Detail icon={<Mail className="size-4" />} label="Email">
          <a href={`mailto:${b.email}`} className="text-blue-400 hover:underline">
            {b.email}
          </a>
        </Detail>
      )}
      <Detail icon={<Users className="size-4" />} label="Гости">
        {b.guests} чел. · {b.nights} ноч.
      </Detail>
      <Detail icon={<Wallet className="size-4" />} label="Стоимость">
        Проживание: {b.subtotal.toLocaleString('ru')} ₽
        {b.servicesTotal > 0 && (
          <> + услуги: {b.servicesTotal.toLocaleString('ru')} ₽</>
        )}
        {' = '}
        <span className="font-medium text-white">{b.totalPrice.toLocaleString('ru')} ₽</span>
      </Detail>

      <div className="sm:col-span-2 space-y-1">
        <div className="text-xs text-neutral-500">Период</div>
        <div>
          Заезд {fmtFull(b.checkInDate)} → Выезд {fmtFull(b.checkOutDate)}
        </div>
      </div>

      {b.services.length > 0 && (
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
            <ListChecks className="size-4" />
            Услуги
          </div>
          <ul className="space-y-1">
            {b.services.map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {s.name}
                  {s.quantity > 1 && (
                    <span className="text-neutral-500"> × {s.quantity}</span>
                  )}
                </span>
                {s.priceAtBooking !== null && (
                  <span className="text-neutral-400">
                    {(s.priceAtBooking * s.quantity).toLocaleString('ru')} ₽
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.notes && (
        <Detail icon={<MessageSquare className="size-4" />} label="Комментарий гостя">
          <span className="whitespace-pre-wrap">{b.notes}</span>
        </Detail>
      )}
      {b.managerComment && (
        <Detail icon={<MessageSquare className="size-4" />} label="Комментарий менеджера">
          <span className="whitespace-pre-wrap">{b.managerComment}</span>
        </Detail>
      )}
    </div>
  );
}

function Detail({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

export type { StatusFilter };
