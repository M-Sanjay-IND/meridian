export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  dateString: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") {
    return false;
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateParts(date: Date, tz: string): ZonedDateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value])
  );

  const rawHour = parseInt(parts.hour, 10);
  const hour = rawHour === 24 ? 0 : rawHour;

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    dateString: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string
): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  for (let i = 0; i < 3; i++) {
    const parts = getZonedDateParts(guess, tz);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const diff = targetMs - actualMs;
    if (diff === 0) {
      break;
    }
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

export function parseTimeInZone(
  dateString: string,
  timeVal: string | Date,
  tz: string
): Date {
  const [y, m, d] = dateString.split("-").map((v) => parseInt(v, 10));

  let hour = 0;
  let minute = 0;
  let second = 0;

  if (typeof timeVal === "string") {
    let clean = timeVal;
    if (clean.includes("T")) {
      clean = clean.split("T")[1];
    }
    const segments = clean.split(":");
    hour = parseInt(segments[0], 10);
    minute = parseInt(segments[1], 10);
    second = segments[2] ? parseInt(segments[2], 10) : 0;
  } else if (timeVal instanceof Date) {
    hour = timeVal.getUTCHours();
    minute = timeVal.getUTCMinutes();
    second = timeVal.getUTCSeconds();
  }

  return zonedTimeToUtc(y, m, d, hour, minute, second, tz);
}

export function formatInZone(date: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });

  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value])
  );

  let offset = (parts.timeZoneName || "").replace("GMT", "").trim();
  if (!offset) {
    offset = "Z";
  }

  const rawHour = parseInt(parts.hour, 10);
  const hour = rawHour === 24 ? "00" : parts.hour;

  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}${offset}`;
}

export function getZoneOffsetMinutes(date: Date, tz: string): number {
  const parts = getZonedDateParts(date, tz);
  const zonedMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return Math.round((zonedMs - date.getTime()) / 60000);
}

export function getZoneOffsetDifferenceMinutes(
  date: Date,
  tzA: string,
  tzB: string
): number {
  return getZoneOffsetMinutes(date, tzA) - getZoneOffsetMinutes(date, tzB);
}
