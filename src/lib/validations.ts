import { z } from "zod";

// ── Guest validations ──

export const guestNameSchema = z
  .string()
  .trim()
  .min(1, "Guest name is required")
  .max(80, "Guest name must be 80 characters or fewer");

export const guestEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address");

export const guestPhoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s\-+]/g, "").replace(/^91/, ""))
  .pipe(
    z
      .string()
      .regex(/^\d{10}$/, "Enter a 10-digit mobile number")
  );

export const guestPhoneOptionalSchema = z
  .string()
  .trim()
  .transform((val) => {
    if (!val) return "";
    return val.replace(/[\s\-+]/g, "").replace(/^91/, "");
  })
  .pipe(
    z
      .string()
      .regex(/^(\d{10})?$/, "Enter a 10-digit mobile number")
  );

// ── Seat / tier validations ──

export const tierSchema = z
  .number()
  .refine((v) => [1500, 3000, 5000].includes(v), {
    message: "Tier must be ₹1,500, ₹3,000, or ₹5,000",
  });

export const seatCountSchema = z
  .number()
  .int("Seat count must be a whole number")
  .min(1, "Seat count must be at least 1");

// ── Row range validation ──

export const rowRangeSchema = z
  .object({
    section: z.enum(["Ground Floor", "Balcony"]),
    fromRow: z.string().min(1),
    toRow: z.string().min(1),
  })
  .transform((val) => {
    // Normalize: sort alphabetically if reversed
    if (val.fromRow > val.toRow) {
      return { ...val, fromRow: val.toRow, toRow: val.fromRow };
    }
    return val;
  });

// ── Auth validations ──

export const loginEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address");

export const onboardSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  phone: guestPhoneOptionalSchema.optional(),
  requestedRole: z.enum(["super_admin", "sub_admin"]),
  requestedRows: z
    .object({
      section: z.enum(["Ground Floor", "Balcony"]),
      rows: z.array(z.string()),
    })
    .optional(),
});

// ── Allocation validation ──

export const allocateSchema = z.object({
  userId: z.string().uuid(),
  section: z.enum(["Ground Floor", "Balcony"]),
  rows: z.array(z.string().min(1)).min(1, "Select at least one row"),
});

// ── Mass email validation ──

export const massEmailSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  htmlBody: z.string().trim().min(1, "Email body is required"),
  filters: z
    .object({
      section: z.enum(["Ground Floor", "Balcony"]).optional(),
      tier: z.number().optional(),
      ownerId: z.string().uuid().optional(),
      paymentStatus: z.enum(["pending", "received"]).optional(),
      ticketSent: z.boolean().optional(),
    })
    .optional(),
});
