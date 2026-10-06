import { z } from "zod";

// Error representation adhering to docs/API.md
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// GET /api/slots
// ---------------------------------------------------------------------------
export const GetSlotsQuerySchema = z.object({
  hostId: z.coerce.number().int().positive().optional(),
  resourceId: z.coerce.number().int().positive().optional(),
  serviceId: z.coerce.number().int().positive(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  tz: z.string().min(1, "tz is required"),
}).refine(
  (data) => (data.hostId !== undefined && data.resourceId === undefined) || (data.hostId === undefined && data.resourceId !== undefined),
  { message: "Must provide exactly one of hostId or resourceId" }
);

export type GetSlotsQuery = z.infer<typeof GetSlotsQuerySchema>;

export interface SlotItem {
  start: string; // ISO 8601 / RFC 3339 with explicit offset
  end: string;
  available: boolean;
  remaining: number;
  reason?: "booked" | "buffer" | "hold" | "override" | "holiday" | "notice" | "clash" | string;
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
  slots: SlotItem[];
}

// ---------------------------------------------------------------------------
// POST /api/bookings
// ---------------------------------------------------------------------------
export const CreateBookingBodySchema = z.object({
  serviceId: z.number().int().positive(),
  hostId: z.number().int().positive().optional(),
  resourceId: z.number().int().positive().optional(),
  studentId: z.number().int().positive(),
  start: z.string().datetime({ offset: true, message: "start must be RFC 3339 with explicit offset" }),
  end: z.string().datetime({ offset: true, message: "end must be RFC 3339 with explicit offset" }),
  note: z.string().optional(),
}).refine(
  (data) => (data.hostId !== undefined || data.resourceId !== undefined),
  { message: "Must provide hostId or resourceId" }
);

export type CreateBookingBody = z.infer<typeof CreateBookingBodySchema>;

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

// ---------------------------------------------------------------------------
// POST /api/holds
// ---------------------------------------------------------------------------
export const CreateHoldBodySchema = z.object({
  serviceId: z.number().int().positive(),
  hostId: z.number().int().positive().optional(),
  resourceId: z.number().int().positive().optional(),
  studentId: z.number().int().positive(),
  start: z.string().datetime({ offset: true, message: "start must be RFC 3339 with explicit offset" }),
  end: z.string().datetime({ offset: true, message: "end must be RFC 3339 with explicit offset" }),
}).refine(
  (data) => (data.hostId !== undefined || data.resourceId !== undefined),
  { message: "Must provide hostId or resourceId" }
);

export type CreateHoldBody = z.infer<typeof CreateHoldBodySchema>;

export interface HoldResponse {
  id: number;
  expiresAt: string;
  ttlMinutes: number;
  slotStart: string;
  slotEnd: string;
}
