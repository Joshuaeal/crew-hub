import type { Payable } from "@/types/payables";
import {
  auFinancialYearEnd,
  auFinancialYearStart,
  auFYQuarterRange,
  endOfCalendarMonth,
  startOfCalendarMonth,
} from "@/lib/au-fy";

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Sum amounts paid in period (uses paidAt). */
export function totalPaidInPeriod(items: Payable[], start: Date, end: Date): number {
  let s = 0;
  for (const p of items) {
    if (p.status !== "paid" || !p.paidAt) continue;
    if (inRange(p.paidAt, start, end)) s += p.amountAudIncGst;
  }
  return Math.round(s * 100) / 100;
}

/** Outstanding (not void, not paid): draft, pending, approved. */
export function totalOutstanding(items: Payable[]): number {
  let s = 0;
  for (const p of items) {
    if (p.status === "void" || p.status === "paid") continue;
    s += p.amountAudIncGst;
  }
  return Math.round(s * 100) / 100;
}

export type PayPeriodRollup = {
  label: string;
  /** Total paid out in period (cash leaving). */
  paidTotal: number;
  /** Negative display of outflow (for −$ tone). */
  paidSigned: number;
  /** Average $ per month within this period’s window. */
  avgPerMonth: number;
  /** Months in the averaging window (denominator). */
  monthsInWindow: number;
};

function avgPerMonth(total: number, months: number): number {
  if (months <= 0) return 0;
  return Math.round((total / months) * 100) / 100;
}

export function computePayrollRollups(items: Payable[], now = new Date()): {
  outstanding: number;
  month: PayPeriodRollup;
  quarter: PayPeriodRollup;
  fy: PayPeriodRollup;
} {
  const outstanding = totalOutstanding(items);

  const monthStart = startOfCalendarMonth(now);
  const monthEnd = endOfCalendarMonth(now);
  const paidMonth = totalPaidInPeriod(items, monthStart, monthEnd);

  const month: PayPeriodRollup = {
    label: now.toLocaleString("en-AU", { month: "long", year: "numeric" }),
    paidTotal: paidMonth,
    paidSigned: -paidMonth,
    avgPerMonth: avgPerMonth(paidMonth, 1),
    monthsInWindow: 1,
  };

  const { start: qStart, end: qEnd } = auFYQuarterRange(now);
  const paidQ = totalPaidInPeriod(items, qStart, qEnd);
  const quarter: PayPeriodRollup = {
    label: "Current FY quarter",
    paidTotal: paidQ,
    paidSigned: -paidQ,
    avgPerMonth: avgPerMonth(paidQ, 3),
    monthsInWindow: 3,
  };

  const fyStart = auFinancialYearStart(now);
  const fyEnd = auFinancialYearEnd(now);
  const paidFy = totalPaidInPeriod(items, fyStart, fyEnd);
  const fy: PayPeriodRollup = {
    label: `FY ${fyStart.getFullYear()}/${String(fyEnd.getFullYear()).slice(-2)}`,
    paidTotal: paidFy,
    paidSigned: -paidFy,
    avgPerMonth: avgPerMonth(paidFy, 12),
    monthsInWindow: 12,
  };

  return { outstanding, month, quarter, fy };
}
