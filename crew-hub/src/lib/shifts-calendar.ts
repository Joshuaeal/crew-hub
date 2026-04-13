import type { Shift } from "@/types/shift";

/** Shifts that overlap a calendar day (local midnight–end). */
export function shiftsOverlappingDay(shifts: Shift[], day: Date): Shift[] {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return shifts.filter((s) => {
    const a = new Date(s.startAt);
    const b = new Date(s.endAt);
    return a <= end && b >= start;
  });
}

/** Weeks for a month; each week has 7 cells (null = padding before/after month). */
export function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < startPad; i++) {
    week.push(null);
  }
  for (let d = 1; d <= lastDay; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export function isToday(d: Date): boolean {
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}
