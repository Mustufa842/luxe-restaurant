import { z } from "zod";

/**
 * Every API route parses `req.json()` through one of these schemas
 * before touching the database. Never trust client input, including
 * from authenticated sessions.
 */

// E.164-ish phone validation, intentionally strict.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, e.g. +14155551234");

export const reservationRequestSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestPhone: phoneSchema,
  guestEmail: z.string().trim().email().max(254).optional(),
  partySize: z.number().int().min(1).max(20),
  date: z.string().datetime(), // ISO 8601, validated & parsed server-side
  timeSlot: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM 24h format"),
  notes: z.string().trim().max(500).optional(),
});
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;

export const menuItemQuerySchema = z.object({
  category: z
    .enum(["AMUSE_BOUCHE", "APPETIZER", "MAIN", "DESSERT", "BEVERAGE", "TASTING_MENU"])
    .optional(),
  onlyAvailable: z.coerce.boolean().default(true),
});

export const checkoutSessionRequestSchema = z.object({
  kind: z.enum(["catering_deposit", "gift_card", "premium_takeout"]),
  amountCents: z.number().int().min(500).max(10_000_00), // $5 – $10,000 sanity bounds
  reservationId: z.string().cuid().optional(),
  metadata: z.record(z.string(), z.string().max(200)).optional(),
});

export const aiConciergeMessageSchema = z.object({
  sessionId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(1000),
});

/**
 * Wraps a Zod parse so every route returns the same 400 shape
 * on validation failure instead of leaking stack traces.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
}

export class ValidationError extends Error {
  issues: ReturnType<z.ZodError["flatten"]>;
  constructor(issues: ReturnType<z.ZodError["flatten"]>) {
    super("Validation failed");
    this.issues = issues;
  }
}
