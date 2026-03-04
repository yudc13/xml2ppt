import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

import { apiError, apiOk } from "@/lib/api/response";
import { createSlide, getSlidesByDeckId } from "@/lib/db/repository";

const paramsSchema = z.object({
  deckId: z.uuid(),
});

const createSlideSchema = z.object({
  xmlContent: z.string().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ deckId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return apiError("Invalid deck id", "INVALID_DECK_ID", 400);
  }

  try {
    const slides = await getSlidesByDeckId(parsedParams.data.deckId);
    return apiOk({ slides });
  } catch {
    return apiError("Failed to load slides", "LOAD_SLIDES_FAILED", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return apiError("Invalid deck id", "INVALID_DECK_ID", 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsedPayload = createSlideSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return apiError("Invalid payload", "INVALID_PAYLOAD", 400);
  }

  try {
    const slide = await createSlide(parsedParams.data.deckId, parsedPayload.data.xmlContent, userId);
    if (!slide) {
      return apiError("Deck not found", "DECK_NOT_FOUND", 404);
    }

    return apiOk({ slide }, 201);
  } catch {
    return apiError("Failed to create slide", "CREATE_SLIDE_FAILED", 500);
  }
}
