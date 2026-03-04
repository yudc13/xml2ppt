import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { rollbackSlideToRevision } from "@/lib/db/repository";

const paramsSchema = z.object({
  slideId: z.uuid(),
});

const rollbackSchema = z.object({
  targetVersion: z.number().int().min(1),
  currentVersion: z.number().int().min(1),
});

type RouteContext = {
  params: Promise<{ slideId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return apiError("Invalid slide id", "INVALID_SLIDE_ID", 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Invalid JSON payload", "INVALID_PAYLOAD", 400);
  }

  const parsedPayload = rollbackSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return apiError("Expected payload: { targetVersion: number, currentVersion: number }", "INVALID_PAYLOAD", 400);
  }

  try {
    const result = await rollbackSlideToRevision({
      slideId: parsedParams.data.slideId,
      targetVersion: parsedPayload.data.targetVersion,
      currentVersion: parsedPayload.data.currentVersion,
    });

    if (result.status === "not_found") {
      return apiError("Revision not found", "REVISION_NOT_FOUND", 404);
    }

    if (result.status === "conflict") {
      return apiError("Slide version conflict", "SLIDE_VERSION_CONFLICT", 409);
    }

    return apiOk({ slide: result.slide });
  } catch {
    return apiError("Failed to rollback slide", "ROLLBACK_FAILED", 500);
  }
}
