import { useEffect, useState } from 'react';
import { format, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Activity, Users, MousePointerClick, Globe } from 'lucide-react';
import {
  getAdminAnalytics, type AnalyticsReport, type AnalyticsSummary,
} from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SOURCE_LABEL: Record<string, string> = {
  direct: 'Прямые',
  search: 'Поиск',
  social: 'Соцсети',
  referral: 'Переходы',
};

export function AnalyticsView() {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminAnalytics(days)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setReport(res.data.analytics);
          setError(null);
        } else {
          setError(res.error);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days]);

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
        <h2 className="text-sm font-medium text-neutral-400">Трекинг посетителей</h2>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">7 дней</TabsTrigger>
            <TabsTrigger value="30">30 дней</TabsTrigger>
            <TabsTrigger value="90">90 дней</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <SummaryCards summary={report.summary} days={report.windowDays} />

      <DailyBars byDay={report.byDay} />

      <div className="grid gap-3 lg:grid-cols-2">
        <TopList title="Топ страниц" rows={report.topPages.map((p) => ({ key: p.page, sub: `${p.sessions} сеансов`, value: p.events }))} emptyLabel="Нет данных" />
        <TopList title="Топ кнопок" rows={report.topClicks.map((c) => ({ key: c.label, value: c.events }))} emptyLabel="Кликов пока нет" />
      </div>

      <SourceBreakdown referrers={report.referrers} total={report.summary.totalEvents} />
    </div>
  );
}

function SummaryCards({ summary, days }: { summary: AnalyticsSummary; days: number }) {
  const cards = [
    { icon: <Activity className="size-4" />, label: 'Событий сегодня', value: String(summary.eventsToday) },
    { icon: <Users className="size-4" />, label: 'Посетителей сегодня', value: String(summary.sessionsToday) },
    { icon: <MousePointerClick className="size-4" />, label: `Событий за ${days} дней`, value: String(summary.totalEvents) },
    { icon: <Globe className="size-4" />, label: `Уникальных за ${days} дней`, value: String(summary.totalSessions) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-400">{c.label}</CardTitle>
            <span className="text-neutral-500">{c.icon}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DailyBars({ byDay }: { byDay: AnalyticsReport['byDay'] }) {
  const max = Math.max(...byDay.map((d) => d.events), 1);
  if (byDay.every((d) => d.events === 0)) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Активность по дням</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-neutral-500">Событий пока нет</p></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Активность по дням</CardTitle></CardHeader>
      <CardContent>
        <div className="flex h-32 items-end gap-px">
          {byDay.map((d) => {
            const pct = Math.max(2, Math.round((d.events / max) * 100));
            return (
              <div
                key={d.date}
                className="group relative flex-1 bg-emerald-500/70 hover:bg-emerald-500"
                style={{ height: `${pct}%` }}
                title={`${format(parse(d.date, 'yyyy-MM-dd', new Date()), 'd MMM', { locale: ru })}: ${d.events} (${d.sessions} сеансов)`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
          <span>{format(parse(byDay[0].date, 'yyyy-MM-dd', new Date()), 'd MMM', { locale: ru })}</span>
          <span>{format(parse(byDay[byDay.length - 1].date, 'yyyy-MM-dd', new Date()), 'd MMM', { locale: ru })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TopList({
  title, rows, emptyLabel,
}: {
  title: string;
  rows: { key: string; sub?: string; value: number }[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {rows.slice(0, 10).map((r) => (
              <li key={r.key} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate pr-3">{r.key}</span>
                <span className="flex items-baseline gap-3 shrink-0">
                  {r.sub && <span className="text-xs text-neutral-500">{r.sub}</span>}
                  <span className="tabular-nums text-neutral-200">{r.value}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SourceBreakdown({
  referrers, total,
}: {
  referrers: AnalyticsReport['referrers'];
  total: number;
}) {
  if (referrers.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Откуда приходят</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {referrers.map((r) => {
          const pct = total > 0 ? Math.round((r.events / total) * 100) : 0;
          return (
            <div key={r.source} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-xs">
              <span className="text-neutral-400">{SOURCE_LABEL[r.source] ?? r.source}</span>
              <div className="h-3 overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-sky-500/70" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-right tabular-nums text-neutral-300">{pct}%</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
