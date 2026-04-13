/** Australian financial year: 1 July → 30 June. */

export function auFinancialYearStart(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 6) return new Date(y, 6, 1);
  return new Date(y - 1, 6, 1);
}

export function auFinancialYearEnd(d: Date): Date {
  const start = auFinancialYearStart(d);
  return new Date(start.getFullYear() + 1, 5, 30, 23, 59, 59, 999);
}

/** Current FY quarter [start, end] inclusive of end day. */
export function auFYQuarterRange(d: Date): { start: Date; end: Date } {
  const fy = auFinancialYearStart(d);
  const months = (d.getFullYear() - fy.getFullYear()) * 12 + (d.getMonth() - fy.getMonth());
  const q = Math.min(3, Math.max(0, Math.floor(months / 3)));
  const start = new Date(fy);
  start.setMonth(fy.getMonth() + q * 3);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 3);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function startOfCalendarMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfCalendarMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
