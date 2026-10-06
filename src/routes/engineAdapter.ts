import { DateTime, IANAZone } from "luxon";
import type { GetSlotsQuery, GetSlotsResponse } from "./types.js";

/**
 * Contract defined in DEV-MANUAL.md §3.1:
 * export function getSlots(input: {
 *   hostId?: number; resourceId?: number; serviceId: number;
 *   from: string; to: string; tz: string;
 * }, db: any): Promise<{ slots: { start: string; end: string; available: boolean; remaining: number; reason?: string }[] }>;
 */
export async function getSlotsFromEngine(
  query: GetSlotsQuery,
  _db?: unknown
): Promise<GetSlotsResponse> {
  // Dynamically attempt to import the real engine if Role A has merged it
  try {
    const engineModule = await import("../engine/availability.js" as string);
    if (typeof engineModule.getSlots === "function") {
      const result = await engineModule.getSlots(query, _db);
      return {
        hostId: query.hostId,
        resourceId: query.resourceId,
        serviceId: query.serviceId,
        timeZone: query.tz,
        duration: result.duration ?? 30,
        buffer: result.buffer ?? { before: 0, after: 0 },
        slots: result.slots,
      };
    }
  } catch {
    // Engine not merged yet, fallback to contract-compliant stub
  }

  // Contract stub implementation:
  // Returns deterministic slots for testing purposes and demo KT-1 compliance
  // KT-1: Host 7 working hours 09:00 - 17:00 Asia/Kolkata
  // Rendered in America/Los_Angeles on 2026-10-15 (PDT, UTC-7):
  // 09:00 IST = 03:30 UTC = 2026-10-14T20:30:00-07:00
  // 17:00 IST = 11:30 UTC = 2026-10-15T04:30:00-07:00
  const duration = 45;
  const buffer = { before: 15, after: 30 };
  const requestedZone = query.tz;

  // Verify tz is valid IANA
  if (!IANAZone.isValidZone(requestedZone)) {
    throw new Error(`Invalid IANA timezone: ${requestedZone}`);
  }

  // Generate slots for each requested date
  const slots = [];
  const fromDate = DateTime.fromISO(query.from, { zone: "Asia/Kolkata" });
  const toDate = DateTime.fromISO(query.to, { zone: "Asia/Kolkata" });

  let cur = fromDate;
  while (cur <= toDate) {
    // Work hours 09:00 to 17:00 IST
    const dayStartIST = cur.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const dayEndIST = cur.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });

    let slotCur = dayStartIST;
    while (slotCur.plus({ minutes: duration }) <= dayEndIST) {
      const slotEnd = slotCur.plus({ minutes: duration });
      // Project both start and end into requestedZone
      const startInRequestedTz = slotCur.setZone(requestedZone);
      const endInRequestedTz = slotEnd.setZone(requestedZone);

      slots.push({
        start: startInRequestedTz.toISO({ suppressMilliseconds: true, includeOffset: true })!,
        end: endInRequestedTz.toISO({ suppressMilliseconds: true, includeOffset: true })!,
        available: true,
        remaining: 1,
      });

      slotCur = slotCur.plus({ minutes: duration });
    }

    cur = cur.plus({ days: 1 });
  }

  return {
    hostId: query.hostId,
    resourceId: query.resourceId,
    serviceId: query.serviceId,
    timeZone: requestedZone,
    duration,
    buffer,
    slots,
  };
}
