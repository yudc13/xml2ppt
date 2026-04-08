import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { createUserRoleOptions } from "@/features/user-create/schema";

const createUserPayloadSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().trim().email(),
  role: z.enum(createUserRoleOptions),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = createUserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("Invalid payload", "INVALID_PAYLOAD", 400);
  }

  return apiOk(
    {
      user: {
        id: crypto.randomUUID(),
        username: parsed.data.username,
        email: parsed.data.email,
        role: parsed.data.role,
      },
    },
    201,
  );
}
