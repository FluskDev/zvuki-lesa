import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getCottages, type Cottage } from '@/lib/api';
import {
  getAdminBookings, getAdminCalendar, confirmAdminBooking, cancelAdminBooking,
  type AdminBooking, type OccupancyItem,
} from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookingsList, type StatusFilter } from './BookingsList';
import { OccupancyCalendar } from './OccupancyCalendar';
import { BookingFormDialog, type FormPreset } from './BookingFormDialog';
import { FinancesView } from './FinancesView';
import { AnalyticsView } from './AnalyticsView';
import { AdminNav } from './AdminNav';

interface FormCottage {
  id: number;
  name: string;
  basePrice: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<FormPreset>({});

  const today = useMemo(() => new Date(), []);
  const from = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const to = useMemo(
    () => new Date(today.getTime() + 60 * 86_400_000).toISOString().slice(0, 10),
    [today],
  );

  const load = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      getAdminBookings({ status: filter }),
      getAdminCalendar(from, to),
    ]);
    if (bRes.success) setBookings(bRes.data.bookings);
    if (cRes.success) setOccupancy(cRes.data.occupancy);
    if (!bRes.success && bRes.code === 'UNAUTHORIZED') {
      navigate('/admin/login', { replace: true });
    }
  }, [filter, from, to, navigate]);

  useEffect(() => {
    getCottages().then((r) => {
      if (r.success) setCottages(r.data.cottages);
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Автообновление каждые 30с + при возврате на вкладку.
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    let lastRefresh = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 5_000) {
        lastRefresh = Date.now();
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const formCottages: FormCottage[] = cottages.map((c) => ({
    id: c.id,
    name: c.name,
    basePrice: c.basePrice,
  }));

  function openCreate(cottageId?: number, checkInDate?: string) {
    setPreset({ cottageId, checkInDate });
    setDialogOpen(true);
  }
  function openEdit(b: AdminBooking) {
    setPreset({ booking: b });
    setDialogOpen(true);
  }
  async function onConfirm(b: AdminBooking) {
    const res = await confirmAdminBooking(b.id);
    if (res.success) {
      toast.success('Подтверждено');
      load();
    } else {
      toast.error(res.error);
    }
  }
  async function onCancel(b: AdminBooking) {
    const res = await cancelAdminBooking(b.id);
    if (res.success) {
      toast.success('Отменено');
      load();
    } else {
      toast.error(res.error);
    }
  }
  return (
    <div className="dark min-h-screen bg-[#141414] text-white">
      <AdminNav>
        <Button onClick={() => openCreate()} size="sm">
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Бронь</span>
        </Button>
      </AdminNav>

      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Бронирования</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Управление заявками, финансами и аналитикой гостевого дома.
          </p>
        </div>
        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">Брони</TabsTrigger>
            <TabsTrigger value="finance">Финансы</TabsTrigger>
            <TabsTrigger value="seo">Аналитика</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-8 mt-6">
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-neutral-400">Занятость (60 дней)</h2>
              <OccupancyCalendar
                cottages={formCottages}
                occupancy={occupancy}
                startDate={today}
                onCellClick={openCreate}
              />
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-neutral-400">Заявки</h2>
              <BookingsList
                bookings={bookings}
                filter={filter}
                onFilterChange={setFilter}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onEdit={openEdit}
              />
            </section>
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <FinancesView />
          </TabsContent>

          <TabsContent value="seo" className="mt-6">
            <AnalyticsView />
          </TabsContent>
        </Tabs>
      </main>

      <BookingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cottages={formCottages}
        preset={preset}
        onSaved={load}
      />
    </div>
  );
}
