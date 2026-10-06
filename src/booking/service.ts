import { prisma } from "../db/client.js";

/**
 * Service helpers for holds and booking management
 */

export interface CreateHoldParams {
  serviceId: number;
  hostId?: number;
  resourceId?: number;
  studentId: number;
  start: string;
  end: string;
  ttlMinutes?: number;
}

export async function createHold(params: CreateHoldParams) {
  const ttl =
    params.ttlMinutes ??
    parseInt(process.env.HOLD_TTL_MINUTES || "10", 10);

  const slotStart = new Date(params.start);
  const slotEnd = new Date(params.end);
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  const hold = await prisma.hold.upsert({
    where: {
      studentId_slotStart_slotEnd: {
        studentId: params.studentId,
        slotStart,
        slotEnd,
      },
    },
    update: {
      expiresAt,
    },
    create: {
      hostId: params.hostId ?? null,
      resourceId: params.resourceId ?? null,
      studentId: params.studentId,
      slotStart,
      slotEnd,
      expiresAt,
    },
  });

  return {
    id: hold.id,
    expiresAt: hold.expiresAt.toISOString(),
    ttlMinutes: ttl,
    slotStart: hold.slotStart.toISOString(),
    slotEnd: hold.slotEnd.toISOString(),
  };
}

export async function getBookingById(id: number) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      serviceType: true,
      student: true,
      resource: true,
    },
  });
}

export async function cancelBooking(id: number) {
  return prisma.booking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
}
