import { useEffect, useState } from 'react';
import { format, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Wallet, CalendarDays, TrendingUp, Ban, ArrowUpRight, ListChecks } from 'lucide-react';
import {
  getAdminFinance, type FinanceReport, type FinanceSummary, type FinanceByCottage, type FinanceByMonth,
} from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Period = 'all' | 'year' | '90d';

function periodDates(period: Period): { from?: string; to?: string } {
  if (period === 'all') return {};
  const now = new Date();
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) };
  }
  // 90d
  const past = new Date(now.getTime() - 90 * 86_400_000);
  return { from: past.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function monthLabel(month: string): string {
  try {
    return format(parse(month, 'yyyy-MM', new Date()), 'LLL yyyy', { locale: ru });
  } catch {
    return month;
  }
}

function fmtMoney(n: number): string {
  return n.toLocaleString('ru') + ' ₽';
}

export function FinancesView() {
  const [period, setPeriod] = useState<Period>('all');
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminFinance(periodDates(period))
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setReport(res.data.finance);
          setError(null);
        } else {
          setError(res.error);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period]);

  if (loading && !report) {
    return <p className="text-sm text-neutral-500 py-8 text-center">Загрузка…</p>;
  }
  if (error && !report) {
    return <p className="text-sm text-red-400 py-8 text-center">{error}</p>;
  }
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-400">Отчёт по выручке</h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="all">Всё время</TabsTrigger>
            <TabsTrigger value="year">Этот год</TabsTrigger>
            <TabsTrigger value="90d">90 дней</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <SummaryCards summary={report.summary} />

      <MonthlyBars data={report.byMonth} />

      <CottageBreakdown rows={report.byCottage} />
    </div>
  );
}

function SummaryCards({ summary: s }: { summary: FinanceSummary }) {
  const cards: { icon: React.ReactNode; label: string; value: string; sub?: string }[] = [
    { icon: <Wallet className="size-4" />, label: 'Выручка', value: fmtMoney(s.totalRevenue), sub: `услуги: ${fmtMoney(s.servicesRevenue)}` },
    { icon: <ListChecks className="size-4" />, label: 'Активных броней', value: String(s.activeBookings), sub: `из ${s.totalBookings} всего` },
    { icon: <TrendingUp className="size-4" />, label: 'Средний чек', value: fmtMoney(s.averageCheck) },
    { icon: <CalendarDays className="size-4" />, label: 'Ночей продано', value: String(s.totalNights) },
    { icon: <ArrowUpRight className="size-4" />, label: 'Предстоящие', value: String(s.upcomingBookings), sub: 'подтверждённые и новые' },
    { icon: <Ban className="size-4" />, label: 'Отменено', value: String(s.cancelledBookings) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-400">{c.label}</CardTitle>
            <span className="text-neutral-500">{c.icon}</span>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{c.value}</div>
            {c.sub && <p className="text-xs text-neutral-500 mt-1">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MonthlyBars({ data }: { data: FinanceByMonth[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">По месяцам</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-neutral-500">Нет данных за выбранный период</p></CardContent>
      </Card>
    );
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">По месяцам</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((m) => {
          const pct = Math.max(4, Math.round((m.revenue / max) * 100));
          return (
            <div key={m.month} className="grid grid-cols-[7rem_1fr_8rem_5rem] items-center gap-3 text-xs">
              <span className="text-neutral-400 capitalize">{monthLabel(m.month)}</span>
              <div className="h-3 overflow-hidden rounded bg-neutral-800">
                <div
                  className="h-full bg-emerald-500/80"
                  style={{ width: `${pct}%` }}
                  title={fmtMoney(m.revenue)}
                />
              </div>
              <span className="text-right tabular-nums text-neutral-300">{fmtMoney(m.revenue)}</span>
              <span className="text-right text-neutral-500">{m.bookings} бр.</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CottageBreakdown({ rows }: { rows: FinanceByCottage[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">По домикам</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-neutral-500">Нет данных</p></CardContent>
      </Card>
    );
  }
  const total = rows.reduce((acc, r) => acc + r.revenue, 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">По домикам</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <div className="grid grid-cols-[1fr_5rem_5rem_8rem_6rem] gap-3 px-1 pb-2 text-xs text-neutral-500">
          <span>Домик</span>
          <span className="text-right">Брони</span>
          <span className="text-right">Ночей</span>
          <span className="text-right">Выручка</span>
          <span className="text-right">Доля</span>
        </div>
        {rows.map((r) => {
          const share = total > 0 ? Math.round((r.revenue / total) * 100) : 0;
          return (
            <div key={r.cottageId} className="grid grid-cols-[1fr_5rem_5rem_8rem_6rem] items-center gap-3 rounded px-1 py-2 text-sm hover:bg-neutral-900/40">
              <span>{r.cottageName}</span>
              <span className="text-right tabular-nums text-neutral-300">{r.bookings}</span>
              <span className="text-right tabular-nums text-neutral-300">{r.nights}</span>
              <span className="text-right tabular-nums font-medium">{fmtMoney(r.revenue)}</span>
              <span className="text-right text-neutral-400">{share}%</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
