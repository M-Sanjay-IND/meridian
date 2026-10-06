import { TimeRange, subtractRanges } from "./ranges.js";
import { formatInZone, isValidTimeZone } from "./zones.js";
import { inflateBusyIntervals, BusyInterval } from "./buffers.js";
import { resolveWorkingHours, AvailabilityRuleRecord } from "./overrides.js";

export interface Slot {
  start: string;
  end: string;
  available: boolean;
  remaining: number;
  reason?: string;
}

export interface GetSlotsInput {
  hostId?: number;
  resourceId?: number;
  serviceId: number;
  from: string;
  to: string;
  tz: string;
  studentId?: number;
}

export interface GetSlotsResponse {
  hostId?: number;
  resourceId?: number;
  serviceId: number;
  timeZone: string;
  duration: number;
  buffer: {
    before: number;
    after: number;
  };
  slots: Slot[];
}

export interface DbServiceTypeRecord {
  id: number;
  name?: string;
  durationMins?: number;
  beforeBuffer?: number;
  afterBuffer?: number;
  minNoticeMins?: number;
  seatsPerSlot?: number;
  hostId?: number | null;
  resourceId?: number | null;
  active?: boolean;
}

export interface DbUserRecord {
  id: number;
  timeZone?: string;
}

export interface DbResourceRecord {
  id: number;
  timeZone?: string;
  capacity?: number;
}

export interface DbBookingRecord {
  id?: number;
  hostId?: number | null;
  resourceId?: number | null;
  studentId?: number;
  slotStart: Date | string;
  slotEnd: Date | string;
  status: string;
  resourcesNeeded?: number;
  serviceType?: {
    beforeBuffer?: number;
    afterBuffer?: number;
  } | null;
}

export interface DbHoldRecord {
  id?: number;
  hostId?: number | null;
  resourceId?: number | null;
  studentId?: number;
  slotStart: Date | string;
  slotEnd: Date | string;
  expiresAt: Date | string;
}

export interface DbStudentCommitmentRecord {
  id?: number;
  studentId: number;
  label?: string;
  slotStart: Date | string;
  slotEnd: Date | string;
}

export interface Db {
  serviceType: {
    findUnique: (args: { where: { id: number } }) => Promise<DbServiceTypeRecord | null>;
  };
  user?: {
    findUnique: (args: { where: { id: number } }) => Promise<DbUserRecord | null>;
  };
  resource?: {
    findUnique: (args: { where: { id: number } }) => Promise<DbResourceRecord | null>;
  };
  availabilityRule: {
    findMany: (args?: any) => Promise<AvailabilityRuleRecord[]>;
  };
  booking: {
    findMany: (args?: any) => Promise<DbBookingRecord[]>;
  };
  hold?: {
    findMany: (args?: any) => Promise<DbHoldRecord[]>;
  };
  studentCommitment?: {
    findMany: (args?: any) => Promise<DbStudentCommitmentRecord[]>;
  };
}

export async function getSlots(input: GetSlotsInput, db: Db): Promise<GetSlotsResponse> {
  const { hostId, resourceId, serviceId, from, to, tz, studentId } = input;

  if (!isValidTimeZone(tz)) {
    throw new Error(`Invalid IANA time zone: ${tz}`);
  }

  const [fromY, fromM, fromD] = from.split("-").map((v) => parseInt(v, 10));
  const [toY, toM, toD] = to.split("-").map((v) => parseInt(v, 10));

  const fromDate = new Date(Date.UTC(fromY, fromM - 1, fromD));
  const toDate = new Date(Date.UTC(toY, toM - 1, toD));

  if (toDate.getTime() < fromDate.getTime()) {
    throw new Error("'to' date cannot be before 'from' date");
  }

  const daySpan = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daySpan > 31) {
    throw new Error("Date range exceeds maximum of 31 days");
  }

  const service = await db.serviceType.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error(`Service not found: ${serviceId}`);
  }

  const effectiveHostId = hostId ?? service.hostId ?? undefined;
  const effectiveResourceId = resourceId ?? service.resourceId ?? undefined;

  let hostTimeZone = "Asia/Kolkata";
  let capacity = service.seatsPerSlot ?? 1;

  if (effectiveHostId && db.user?.findUnique) {
    const user = await db.user.findUnique({ where: { id: effectiveHostId } });
    if (user?.timeZone) {
      hostTimeZone = user.timeZone;
    }
  } else if (effectiveResourceId && db.resource?.findUnique) {
    const res = await db.resource.findUnique({ where: { id: effectiveResourceId } });
    if (res?.timeZone) {
      hostTimeZone = res.timeZone;
    }
    if (typeof res?.capacity === "number") {
      capacity = res.capacity;
    }
  }

  const durationMins = service.durationMins ?? 30;
  const beforeBuffer = service.beforeBuffer ?? 0;
  const afterBuffer = service.afterBuffer ?? 0;
  const envMinNotice =
    typeof globalThis !== "undefined"
      ? (globalThis as any).process?.env?.MIN_NOTICE_MINUTES
      : undefined;
  const minNoticeMins =
    service.minNoticeMins ??
    parseInt(typeof envMinNotice === "string" ? envMinNotice : "0", 10);

  const ruleQuery: any = effectiveHostId
    ? {
        where: {
          OR: [{ ownerUserId: effectiveHostId }, { kind: "HOLIDAY" }],
        },
      }
    : effectiveResourceId
    ? {
        where: {
          OR: [{ ownerResourceId: effectiveResourceId }, { kind: "HOLIDAY" }],
        },
      }
    : {};

  const rules = await db.availabilityRule.findMany(ruleQuery);

  const workingRanges = resolveWorkingHours({
    rules,
    from,
    to,
    hostTimeZone,
  });

  const durationMs = durationMins * 60 * 1000;
  const now = new Date();
  const minNoticeMs = minNoticeMins * 60 * 1000;

  if (workingRanges.length === 0) {
    return {
      hostId: effectiveHostId,
      resourceId: effectiveResourceId,
      serviceId: service.id,
      timeZone: tz,
      duration: durationMins,
      buffer: { before: beforeBuffer, after: afterBuffer },
      slots: [],
    };
  }

  const bookingQuery: any = effectiveHostId
    ? { where: { hostId: effectiveHostId } }
    : effectiveResourceId
    ? { where: { resourceId: effectiveResourceId } }
    : {};

  const rawBookings = await db.booking.findMany(bookingQuery);
  const activeBookings = rawBookings.filter(
    (b) => String(b.status).toUpperCase() !== "CANCELLED"
  );

  const busyBookingList: BusyInterval[] = activeBookings.map((b) => ({
    start: new Date(b.slotStart),
    end: new Date(b.slotEnd),
    beforeBuffer: b.serviceType?.beforeBuffer ?? beforeBuffer,
    afterBuffer: b.serviceType?.afterBuffer ?? afterBuffer,
  }));

  let activeHolds: DbHoldRecord[] = [];
  if (db.hold?.findMany) {
    const holdQuery: any = effectiveHostId
      ? { where: { hostId: effectiveHostId } }
      : effectiveResourceId
      ? { where: { resourceId: effectiveResourceId } }
      : {};

    const rawHolds = await db.hold.findMany(holdQuery);
    activeHolds = rawHolds.filter((h) => new Date(h.expiresAt).getTime() > now.getTime());
  }

  const busyHoldsList: BusyInterval[] = activeHolds.map((h) => ({
    start: new Date(h.slotStart),
    end: new Date(h.slotEnd),
    beforeBuffer,
    afterBuffer,
  }));

  const allBusyForInflation = [...busyBookingList, ...busyHoldsList];
  const inflatedBusy = inflateBusyIntervals(allBusyForInflation, {
    beforeBuffer,
    afterBuffer,
  });

  let studentClashes: TimeRange[] = [];
  if (studentId) {
    if (db.studentCommitment?.findMany) {
      const commitments = await db.studentCommitment.findMany({
        where: { studentId },
      });
      studentClashes.push(
        ...commitments.map((c) => ({
          start: new Date(c.slotStart),
          end: new Date(c.slotEnd),
        }))
      );
    }
    const studentBookings = await db.booking.findMany({
      where: { studentId },
    });
    studentClashes.push(
      ...studentBookings
        .filter((b) => String(b.status).toUpperCase() !== "CANCELLED")
        .map((b) => ({
          start: new Date(b.slotStart),
          end: new Date(b.slotEnd),
        }))
    );
  }

  const slots: Slot[] = [];

  for (const wr of workingRanges) {
    let cursor = wr.start.getTime();

    while (cursor + durationMs <= wr.end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + durationMs);

      let available = true;
      let remaining = capacity;
      let reason: string | undefined = undefined;

      if (slotStart.getTime() < now.getTime() + minNoticeMs) {
        available = false;
        remaining = 0;
        reason = "notice";
      }

      if (available && studentClashes.length > 0) {
        const hasClash = studentClashes.some(
          (c) => c.start.getTime() < slotEnd.getTime() && c.end.getTime() > slotStart.getTime()
        );
        if (hasClash) {
          available = false;
          remaining = 0;
          reason = "clash";
        }
      }

      if (available) {
        const overlappingBookings = busyBookingList.filter(
          (b) => b.start.getTime() < slotEnd.getTime() && b.end.getTime() > slotStart.getTime()
        );
        const overlappingHolds = busyHoldsList.filter(
          (h) => h.start.getTime() < slotEnd.getTime() && h.end.getTime() > slotStart.getTime()
        );
        const totalBusy = overlappingBookings.length + overlappingHolds.length;

        if (totalBusy >= capacity) {
          available = false;
          remaining = 0;
          reason = overlappingHolds.length > 0 ? "hold" : "booked";
        } else if (totalBusy > 0) {
          available = true;
          remaining = capacity - totalBusy;
        } else {
          const overlapsInflated = inflatedBusy.some(
            (b) => b.start.getTime() < slotEnd.getTime() && b.end.getTime() > slotStart.getTime()
          );

          if (overlapsInflated) {
            available = false;
            remaining = 0;
            reason = "buffer";
          } else {
            available = true;
            remaining = capacity;
          }
        }
      }

      slots.push({
        start: formatInZone(slotStart, tz),
        end: formatInZone(slotEnd, tz),
        available,
        remaining,
        ...(reason ? { reason } : {}),
      });

      cursor += durationMs;
    }
  }

  slots.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  return {
    hostId: effectiveHostId,
    resourceId: effectiveResourceId,
    serviceId: service.id,
    timeZone: tz,
    duration: durationMins,
    buffer: { before: beforeBuffer, after: afterBuffer },
    slots,
  };
}
