import { TimeRange, mergeOverlappingRanges } from "./ranges.js";
import { parseTimeInZone, zonedTimeToUtc, getZonedDateParts } from "./zones.js";

export type AvailabilityKind = "WEEKLY" | "DATE" | "HOLIDAY";

export interface AvailabilityRuleRecord {
  id?: number;
  kind: AvailabilityKind | string;
  days?: number[];
  date?: string | Date | null;
  startTime: string | Date;
  endTime: string | Date;
  note?: string | null;
}

export interface ResolveWorkingHoursParams {
  rules: AvailabilityRuleRecord[];
  from: string;
  to: string;
  hostTimeZone: string;
  termHolidays?: string[];
}

export function normalizeDateString(dateVal: string | Date): string {
  if (typeof dateVal === "string") {
    return dateVal.slice(0, 10);
  }
  const y = dateVal.getUTCFullYear();
  const m = String(dateVal.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateVal.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDateStringsInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const [startY, startM, startD] = from.split("-").map((v) => parseInt(v, 10));
  const [endY, endM, endD] = to.split("-").map((v) => parseInt(v, 10));

  let cur = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur = new Date(Date.UTC(y, cur.getUTCMonth(), cur.getUTCDate() + 1));
  }

  return dates;
}

export function getWeekdayInZone(dateString: string, tz: string): number {
  const [y, m, d] = dateString.split("-").map((v) => parseInt(v, 10));
  const noonUtc = zonedTimeToUtc(y, m, d, 12, 0, 0, tz);
  return getZonedDateParts(noonUtc, tz).weekday;
}

export function resolveWorkingHours(params: ResolveWorkingHoursParams): TimeRange[] {
  const { rules, from, to, hostTimeZone, termHolidays = [] } = params;

  const holidays = new Set<string>();

  for (const h of termHolidays) {
    if (h && typeof h === "string") {
      holidays.add(h.trim().slice(0, 10));
    }
  }

  const envTermHolidays =
    typeof globalThis !== "undefined" && (globalThis as any).process?.env?.TERM_HOLIDAYS;
  if (envTermHolidays && typeof envTermHolidays === "string") {
    for (const h of envTermHolidays.split(",")) {
      const trimmed = h.trim();
      if (trimmed) {
        holidays.add(trimmed.slice(0, 10));
      }
    }
  }

  const dateOverrides = new Map<string, AvailabilityRuleRecord[]>();
  const weeklyRules: AvailabilityRuleRecord[] = [];

  for (const rule of rules) {
    const kind = String(rule.kind).toUpperCase();
    if (kind === "HOLIDAY") {
      if (rule.date) {
        holidays.add(normalizeDateString(rule.date));
      }
    } else if (kind === "DATE") {
      if (rule.date) {
        const dateStr = normalizeDateString(rule.date);
        const existing = dateOverrides.get(dateStr) ?? [];
        existing.push(rule);
        dateOverrides.set(dateStr, existing);
      }
    } else if (kind === "WEEKLY") {
      weeklyRules.push(rule);
    }
  }

  const allDays = getDateStringsInRange(from, to);
  const workingRanges: TimeRange[] = [];

  for (const dateStr of allDays) {
    if (holidays.has(dateStr)) {
      continue;
    }

    const overridesForDate = dateOverrides.get(dateStr);
    if (overridesForDate && overridesForDate.length > 0) {
      for (const override of overridesForDate) {
        const start = parseTimeInZone(dateStr, override.startTime, hostTimeZone);
        const end = parseTimeInZone(dateStr, override.endTime, hostTimeZone);
        if (start.getTime() < end.getTime()) {
          workingRanges.push({ start, end });
        }
      }
      continue;
    }

    const weekday = getWeekdayInZone(dateStr, hostTimeZone);
    const matchingWeekly = weeklyRules.filter(
      (r) => Array.isArray(r.days) && r.days.includes(weekday)
    );

    for (const rule of matchingWeekly) {
      const start = parseTimeInZone(dateStr, rule.startTime, hostTimeZone);
      const end = parseTimeInZone(dateStr, rule.endTime, hostTimeZone);
      if (start.getTime() < end.getTime()) {
        workingRanges.push({ start, end });
      }
    }
  }

  return mergeOverlappingRanges(workingRanges);
}
