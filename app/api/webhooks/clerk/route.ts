import { Webhook } from "svix";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { markUserDeletedByClerkId, upsertUserByClerk } from "@/lib/db/repository";

const userUpsertSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  primary_email_address_id: z.string().nullable().optional(),
  email_addresses: z.array(
    z.object({
      id: z.string().min(1),
      email_address: z.string().email(),
    }),
  ),
});

const userDeleteSchema = z.object({
  id: z.string().min(1),
});

function getFullName(firstName?: string | null, lastName?: string | null): string | null {
  const name = [firstName, lastName].filter((item) => typeof item === "string" && item.trim().length > 0).join(" ");
  return name || null;
}

function getPrimaryEmail(input: z.infer<typeof userUpsertSchema>): string | null {
  if (input.email_addresses.length === 0) {
    return null;
  }

  if (!input.primary_email_address_id) {
    return input.email_addresses[0]?.email_address ?? null;
  }

  const primary = input.email_addresses.find((item) => item.id === input.primary_email_address_id);
  return primary?.email_address ?? input.email_addresses[0]?.email_address ?? null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return apiError("Missing CLERK_WEBHOOK_SECRET", "WEBHOOK_SECRET_MISSING", 500);
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return apiError("Missing Svix headers", "WEBHOOK_HEADER_MISSING", 400);
  }

  const body = await request.text();
  const webhook = new Webhook(webhookSecret);

  let event: { type: string; data: unknown };
  try {
    event = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: unknown };
  } catch {
    return apiError("Invalid webhook signature", "WEBHOOK_SIGNATURE_INVALID", 400);
  }

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      const parsed = userUpsertSchema.safeParse(event.data);
      if (!parsed.success) {
        return apiError("Invalid webhook payload", "WEBHOOK_PAYLOAD_INVALID", 400);
      }

      const payload = parsed.data;
      const user = await upsertUserByClerk({
        clerkUserId: payload.id,
        email: getPrimaryEmail(payload),
        name: getFullName(payload.first_name, payload.last_name),
        avatarUrl: payload.image_url ?? null,
      });

      return apiOk({ received: true, type: event.type, userId: user.id });
    }

    if (event.type === "user.deleted") {
      const parsed = userDeleteSchema.safeParse(event.data);
      if (!parsed.success) {
        return apiError("Invalid webhook payload", "WEBHOOK_PAYLOAD_INVALID", 400);
      }

      const user = await markUserDeletedByClerkId(parsed.data.id);
      return apiOk({ received: true, type: event.type, userId: user?.id ?? null });
    }

    return apiOk({ received: true, type: event.type, ignored: true });
  } catch {
    return apiError("Failed to process webhook", "WEBHOOK_PROCESS_FAILED", 500);
  }
}
