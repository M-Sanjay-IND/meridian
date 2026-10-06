import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/client.js";

export interface ClaimInput {
  serviceId: number;
  hostId?: number;
  resourceId?: number;
  studentId: number;
  start: string; // RFC 3339 with offset
  end: string;   // RFC 3339 with offset
  note?: string;
}

export interface BookingResponse {
  id: number;
  status: "RESERVED" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  slotStart: string;
  slotEnd: string;
  serviceId: number;
  hostId?: number | null;
  resourceId?: number | null;
  studentId: number;
  remaining: number;
  cancellationToken?: string;
}

export interface ClaimResult {
  winner: boolean;
  code?: "slot_taken" | "hold_expired" | "student_clash" | "capacity_full";
  booking?: BookingResponse;
  alternatives?: any[];
  conflict?: string;
}

/**
 * Extract YYYY-MM-DD from an ISO string in UTC
 */
function extractUtcDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().split("T")[0];
}

/**
 * Hash key helper for the advisory lock: (hostId | res:resourceId, day)
 * Lock on (host, day) rather than slot start so overlapping-but-not-identical
 * intervals serialise and cannot race.
 */
function getLockKey(input: ClaimInput, slotStartIso: string): string {
  const day = extractUtcDate(slotStartIso);
  if (input.hostId) {
    return `${input.hostId}:${day}`;
  }
  return `res:${input.resourceId}:${day}`;
}

/**
 * THE ATOMIC CLAIM ENGINE — Single Writer for Bookings.
 * Guaranteed atomic via transaction-scoped PostgreSQL advisory locks:
 *   SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
 * 
 * Rules:
 * 1. Transaction-scoped lock serialises all competing claims on (target, day).
 * 2. Idempotency replay check returns original booking if already committed.
 * 3. D3 Clash Sentinel: Rejects claim if student has conflicting commitment.
 * 4. Counts active bookings (status != 'CANCELLED') + live holds (expiresAt > NOW()).
 * 5. Rejects with 409 slot_taken if count >= capacity. Never leaks winner booking ID.
 * 6. Inserts booking row and releases lock automatically on commit/rollback.
 */
export async function claim(
  input: ClaimInput,
  idempotencyKey?: string,
  dbClient?: unknown
): Promise<ClaimResult> {
  const prisma = (dbClient as PrismaClient) || defaultPrisma;

  // 1. Idempotency check: if already booked with this key, return it (replay)
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        winner: true,
        booking: {
          id: existing.id,
          status: existing.status as any,
          slotStart: existing.slotStart.toISOString(),
          slotEnd: existing.slotEnd.toISOString(),
          serviceId: existing.serviceTypeId,
          hostId: existing.hostId,
          resourceId: existing.resourceId,
          studentId: existing.studentId,
          remaining: 0,
          cancellationToken: `token_${existing.id}`,
        },
      };
    }
  }

  const slotStart = new Date(input.start);
  const slotEnd = new Date(input.end);

  if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime()) || slotStart >= slotEnd) {
    throw new Error("Invalid slot time range");
  }

  // 2. Fetch service definition for capacity and seat info
  const service = await prisma.serviceType.findUnique({
    where: { id: input.serviceId },
    include: { resource: true },
  });

  if (!service) {
    throw new Error(`Service not found: ${input.serviceId}`);
  }

  const capacity = service.seatsPerSlot || service.resource?.capacity || 1;
  const lockKey = getLockKey(input, input.start);

  // 3. Execute inside an atomic transaction
  try {
    return await prisma.$transaction(async (tx) => {
      // Step A: Acquire transaction-scoped advisory lock
      // hashtextextended(string, 0) yields a 64-bit bigint lock key in Postgres
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0));`
      );

      // Step B: D3 Clash Sentinel (if enabled or present)
      // Check if student has a personal commitment overlapping [slotStart, slotEnd)
      const clash = await tx.studentCommitment.findFirst({
        where: {
          studentId: input.studentId,
          slotStart: { lt: slotEnd },
          slotEnd: { gt: slotStart },
        },
      });

      if (clash) {
        return {
          winner: false,
          code: "student_clash",
          conflict: clash.label,
        };
      }

      // Step C: Check live holds for another student on this exact slot
      const now = new Date();
      const activeHold = await tx.hold.findFirst({
        where: {
          hostId: input.hostId ?? null,
          resourceId: input.resourceId ?? null,
          slotStart,
          slotEnd,
          expiresAt: { gt: now },
        },
      });

      // If held by someone else, slot is taken / held
      if (activeHold && activeHold.studentId !== input.studentId) {
        return {
          winner: false,
          code: "slot_taken",
          alternatives: [],
        };
      }

      // Step D: Count overlapping non-cancelled bookings
      // Half-open interval intersection: booking.slotStart < slotEnd AND booking.slotEnd > slotStart
      const overlappingBookings = await tx.booking.count({
        where: {
          status: { not: "CANCELLED" },
          slotStart: { lt: slotEnd },
          slotEnd: { gt: slotStart },
          ...(input.hostId ? { hostId: input.hostId } : {}),
          ...(input.resourceId ? { resourceId: input.resourceId } : {}),
        },
      });

      // Step E: Check capacity (KT-3 and KT-3b)
      if (overlappingBookings >= capacity) {
        return {
          winner: false,
          code: "slot_taken",
          alternatives: [],
        };
      }

      // Step F: Winning claim — persist booking row
      const booking = await tx.booking.create({
        data: {
          serviceTypeId: input.serviceId,
          hostId: input.hostId ?? null,
          resourceId: input.resourceId ?? null,
          studentId: input.studentId,
          slotStart,
          slotEnd,
          status: "RESERVED",
          resourcesNeeded: capacity > 1 ? capacity : 1,
          idempotencyKey: idempotencyKey ?? null,
          note: input.note ?? null,
        },
      });

      // Step G: Consume hold if current student had one
      if (activeHold && activeHold.studentId === input.studentId) {
        await tx.hold.delete({ where: { id: activeHold.id } }).catch(() => {});
      }

      const remaining = Math.max(0, capacity - (overlappingBookings + 1));

      return {
        winner: true,
        booking: {
          id: booking.id,
          status: booking.status as any,
          slotStart: booking.slotStart.toISOString(),
          slotEnd: booking.slotEnd.toISOString(),
          serviceId: booking.serviceTypeId,
          hostId: booking.hostId,
          resourceId: booking.resourceId,
          studentId: booking.studentId,
          remaining,
          cancellationToken: `token_${booking.id}`,
        },
      };
    });
  } catch (error: any) {
    // Check if Postgres ExclusionViolation occurred (the backstop)
    if (error?.code === "P2010" || error?.message?.includes("ExclusionViolation") || error?.message?.includes("no_host_overlap")) {
      return {
        winner: false,
        code: "slot_taken",
        alternatives: [],
      };
    }
    throw error;
  }
}
