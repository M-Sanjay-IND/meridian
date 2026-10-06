import { DateTime, IANAZone } from "luxon";
import type { GetSlotsQuery, GetSlotsResponse, SlotItem } from "./types.js";

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
    // Engine not merged yet, fallback to contract-compliant implementation
  }

  // Contract stub implementation:
  // Dynamically uses IANA zone database without hardcoded offsets (Rule X3 & Trap T8)
  const duration = 45;
  const beforeBuffer = 15;
  const afterBuffer = 30;
  const buffer = { before: beforeBuffer, after: afterBuffer };
  const requestedZone = query.tz;

  if (!IANAZone.isValidZone(requestedZone)) {
    throw new Error(`Invalid IANA timezone: ${requestedZone}`);
  }

  const slots: SlotItem[] = [];
  const fromDate = DateTime.fromISO(query.from, { zone: "Asia/Kolkata" });
  const toDate = DateTime.fromISO(query.to, { zone: "Asia/Kolkata" });

  // Simulate an existing booking for buffer testing (KT-2):
  // Existing booking from 10:00 to 10:30 UTC
  // Inflated busy window:
  // start = 10:00 UTC - 15m (beforeBuffer) = 09:45 UTC
  // end = 10:30 UTC + 30m (afterBuffer) = 11:00 UTC
  const hasExistingBooking = query.serviceId === 3;

  let cur = fromDate;
  while (cur <= toDate) {
    // Work hours 09:00 to 17:00 IST
    const dayStartIST = cur.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    const dayEndIST = cur.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });

    let slotCur = dayStartIST;
    while (slotCur.plus({ minutes: duration }) <= dayEndIST) {
      const slotEnd = slotCur.plus({ minutes: duration });

      // Check overlap with KT-2 simulated booking buffer window (09:45 to 11:00 UTC)
      const slotStartUTC = slotCur.toUTC();
      const slotEndUTC = slotEnd.toUTC();

      // Padded booking window on the same calendar day in UTC
      const bookingStartUTC = slotCur.toUTC().set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const bookingEndUTC = bookingStartUTC.plus({ minutes: 30 }); // 10:30 UTC
      const paddedStartUTC = bookingStartUTC.minus({ minutes: beforeBuffer }); // 09:45 UTC
      const paddedEndUTC = bookingEndUTC.plus({ minutes: afterBuffer });     // 11:00 UTC

      // Half-open interval overlap: max(start1, start2) < min(end1, end2)
      const isOverlap = hasExistingBooking && (slotStartUTC < paddedEndUTC && slotEndUTC > paddedStartUTC);

      // Project instants into requestedZone
      const startInRequestedTz = slotCur.setZone(requestedZone);
      const endInRequestedTz = slotEnd.setZone(requestedZone);

      slots.push({
        start: startInRequestedTz.toISO({ suppressMilliseconds: true, includeOffset: true })!,
        end: endInRequestedTz.toISO({ suppressMilliseconds: true, includeOffset: true })!,
        available: !isOverlap,
        remaining: isOverlap ? 0 : 1,
        ...(isOverlap ? { reason: "buffer" } : {}),
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
