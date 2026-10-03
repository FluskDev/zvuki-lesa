import { addDays, format, parseISO, startOfDay, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { OccupancyItem } from '@/lib/adminApi';

interface CottageRef { id: number; name: string; }

const DAYS = 60;

function isOccupied(occ: OccupancyItem[], cottageId: number, day: Date): OccupancyItem | undefined {
  const dayStart = startOfDay(day);
  return occ.find((o) => {
    if (o.cottageId !== cottageId) return false;
    // День выезда свободен: интервал [checkIn, checkOut)
    return isWithinInterval(dayStart, { start: parseISO(o.checkInDate), end: addDays(parseISO(o.checkOutDate), -1) });
  });
}

export function OccupancyCalendar({
  cottages, occupancy, startDate, onCellClick,
}: {
  cottages: CottageRef[];
  occupancy: OccupancyItem[];
  startDate: Date;
  onCellClick: (cottageId: number, dateISO: string) => void;
}) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(startDate, i));

  // Группировка дней по месяцам для верхней строки с подписями.
  const monthGroups = days.reduce<Array<{ key: string; label: string; count: number }>>((acc, d) => {
    const key = format(d, 'yyyy-MM');
    const label = format(d, 'LLLL yyyy', { locale: ru });
    const cap = label.charAt(0).toUpperCase() + label.slice(1);
    const last = acc[acc.length - 1];
    if (last && last.key === key) last.count++;
    else acc.push({ key, label: cap, count: 1 });
    return acc;
  }, []);

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-max text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 z-10 bg-neutral-900 p-2 text-left align-bottom">Домик</th>
            {monthGroups.map((g) => (
              <th
                key={g.key}
                colSpan={g.count}
                className="border-b border-neutral-800 p-1 text-center text-neutral-400 font-normal"
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            {days.map((d) => (
              <th key={d.toISOString()} className="p-1 text-neutral-500 font-normal w-7 text-center">
                {format(d, 'd', { locale: ru })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cottages.map((c) => (
            <tr key={c.id} className="border-t border-neutral-800">
              <td className="sticky left-0 bg-neutral-900 p-2 font-medium whitespace-nowrap">{c.name}</td>
              {days.map((d) => {
                const occ = isOccupied(occupancy, c.id, d);
                const dateISO = format(d, 'yyyy-MM-dd');
                return (
                  <td key={dateISO} className="p-0.5">
                    <button
                      title={occ ? occ.guestName : 'Свободно — создать бронь'}
                      onClick={() => !occ && onCellClick(c.id, dateISO)}
                      className={
                        'h-6 w-6 rounded ' +
                        (occ
                          ? occ.status === 'confirmed' ? 'bg-emerald-600' : 'bg-amber-500'
                          : 'bg-neutral-800 hover:bg-neutral-700')
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { CottageRef };
