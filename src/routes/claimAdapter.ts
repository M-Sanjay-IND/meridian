import type { CreateBookingBody, BookingResponse } from "./types.js";

export interface ClaimResult {
  winner: boolean;
  code?: "slot_taken" | "hold_expired" | "student_clash" | "capacity_full";
  booking?: BookingResponse;
  alternatives?: any[];
  conflict?: string;
}

// In-memory idempotency cache for development / stub testing
const idempotencyStore = new Map<string, BookingResponse>();

/**
 * Adapter that delegates to Role B's src/booking/claim.ts when merged
 */
export async function claimBooking(
  input: CreateBookingBody,
  idempotencyKey?: string,
  _db?: unknown
): Promise<ClaimResult> {
  // Check idempotency replay first
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    return {
      winner: true,
      booking: idempotencyStore.get(idempotencyKey)!,
    };
  }

  // Attempt to call Role B's claim module if present
  try {
    const claimModule = await import("../booking/claim.js" as string);
    if (typeof claimModule.claim === "function") {
      const result = await claimModule.claim(input, idempotencyKey, _db);
      if (result.winner && idempotencyKey && result.booking) {
        idempotencyStore.set(idempotencyKey, result.booking);
      }
      return result;
    }
  } catch {
    // Role B claim not merged yet, fallback to contract-compliant stub
  }

  // Contract stub: simulates winning the claim
  const booking: BookingResponse = {
    id: Math.floor(Math.random() * 10000) + 1,
    status: "RESERVED",
    slotStart: input.start,
    slotEnd: input.end,
    serviceId: input.serviceId,
    hostId: input.hostId ?? null,
    resourceId: input.resourceId ?? null,
    studentId: input.studentId,
    remaining: 0,
    cancellationToken: `token_${Math.random().toString(36).substring(2)}`,
  };

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, booking);
  }

  return {
    winner: true,
    booking,
  };
}
