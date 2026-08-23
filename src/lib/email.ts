// ──────────────────────────────────────────────
// Email Helper — Resend wrapper with queue logic
// ──────────────────────────────────────────────

import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";
import { RESEND_DAILY_LIMIT, RESEND_FROM_EMAIL } from "./constants";

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY || "re_dummy_for_build");
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
    content_id?: string;
  }[];
}

/**
 * Send a single email via Resend, respecting rate limits.
 * Returns true if sent, false if queued for later.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const supabase = createAdminClient();

  // Check daily limit
  const today = new Date().toISOString().split("T")[0];
  const { data: log } = await supabase
    .from("email_daily_log")
    .select("count")
    .eq("send_date", today)
    .single();

  const currentCount = log?.count ?? 0;

  if (currentCount >= RESEND_DAILY_LIMIT) {
    // Queue for next day
    return false;
  }

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.content_id ? { content_id: a.content_id } : {}),
      })),
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Email send failed: ${error.message}`);
    }

    // Increment daily count
    await supabase.rpc("increment_daily_email_count", {
      target_date: today,
    });

    return true;
  } catch (err) {
    console.error("Email send error:", err);
    throw err;
  }
}

/**
 * Queue an email for sending. Used for bulk operations.
 */
export async function queueEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  seatId?: string;
  emailType: string;
  createdBy: string;
  scheduledFor?: string;
}): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_queue")
    .insert({
      to_email: params.to,
      subject: params.subject,
      html_body: params.htmlBody,
      seat_id: params.seatId ?? null,
      email_type: params.emailType,
      status: "queued",
      created_by: params.createdBy,
      scheduled_for: params.scheduledFor ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Process the email queue — sends up to the daily limit,
 * defers the rest to the next day.
 * Called by the cron endpoint or after queuing.
 */
export async function processEmailQueue(): Promise<{
  sent: number;
  deferred: number;
  failed: number;
}> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  // Get daily count
  const { data: log } = await supabase
    .from("email_daily_log")
    .select("count")
    .eq("send_date", today)
    .single();

  const currentCount = log?.count ?? 0;
  const remaining = Math.max(0, RESEND_DAILY_LIMIT - currentCount);

  if (remaining === 0) {
    // Defer all queued emails to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const { data: queued } = await supabase
      .from("email_queue")
      .select("id")
      .eq("status", "queued")
      .lte("scheduled_for", now);

    if (queued && queued.length > 0) {
      await supabase
        .from("email_queue")
        .update({
          status: "deferred",
          scheduled_for: tomorrow.toISOString(),
        })
        .in(
          "id",
          queued.map((e) => e.id)
        );

      return { sent: 0, deferred: queued.length, failed: 0 };
    }

    return { sent: 0, deferred: 0, failed: 0 };
  }

  // Fetch emails ready to send
  const { data: jobs } = await supabase
    .from("email_queue")
    .select("*")
    .in("status", ["queued", "deferred"])
    .lte("scheduled_for", now)
    .order("created_at", { ascending: true })
    .limit(remaining);

  if (!jobs || jobs.length === 0) {
    return { sent: 0, deferred: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      // Mark as sending
      await supabase
        .from("email_queue")
        .update({ status: "sending", attempts: job.attempts + 1 })
        .eq("id", job.id);

      const resend = getResendClient();
      await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: [job.to_email],
        subject: job.subject,
        html: job.html_body ?? "",
      });

      // Mark as sent
      await supabase
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.id);

      // Increment daily count
      await supabase.rpc("increment_daily_email_count", {
        target_date: today,
      });

      sent++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await supabase
        .from("email_queue")
        .update({ status: "failed", error: errorMsg })
        .eq("id", job.id);
      failed++;
    }
  }

  // Defer any remaining queued emails if we hit the limit
  const newCount = currentCount + sent;
  if (newCount >= RESEND_DAILY_LIMIT) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const { data: remaining_jobs } = await supabase
      .from("email_queue")
      .select("id")
      .eq("status", "queued")
      .lte("scheduled_for", now);

    const deferred = remaining_jobs?.length ?? 0;
    if (deferred > 0) {
      await supabase
        .from("email_queue")
        .update({
          status: "deferred",
          scheduled_for: tomorrow.toISOString(),
        })
        .in(
          "id",
          remaining_jobs!.map((e) => e.id)
        );
    }

    return { sent, deferred, failed };
  }

  return { sent, deferred: 0, failed };
}

/**
 * Get queue statistics for dashboard/monitoring.
 */
export async function getQueueStats(): Promise<{
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  deferred: number;
  todaySent: number;
  todayRemaining: number;
}> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: counts } = await supabase.from("email_queue").select("status");
  const { data: log } = await supabase
    .from("email_daily_log")
    .select("count")
    .eq("send_date", today)
    .single();

  const stats = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    deferred: 0,
    todaySent: log?.count ?? 0,
    todayRemaining: Math.max(0, RESEND_DAILY_LIMIT - (log?.count ?? 0)),
  };

  if (counts) {
    for (const c of counts) {
      const s = c.status as keyof typeof stats;
      if (s in stats && typeof stats[s] === "number") {
        (stats[s] as number)++;
      }
    }
  }

  return stats;
}
