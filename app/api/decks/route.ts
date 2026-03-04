import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { createDeck, listDecks } from "@/lib/db/repository";

const createDeckSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export async function GET() {
  try {
    const decks = await listDecks();
    return apiOk({ decks });
  } catch {
    return apiError("Failed to load decks", "LOAD_DECKS_FAILED", 500);
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = createDeckSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("Invalid payload", "INVALID_PAYLOAD", 400);
  }

  const title = parsed.data.title ?? "未命名演示文稿";

  try {
    const deck = await createDeck(title);
    return apiOk({ deck }, 201);
  } catch {
    return apiError("Failed to create deck", "CREATE_DECK_FAILED", 500);
  }
}
