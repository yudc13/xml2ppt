import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { updateSlideContent } from "@/lib/db/repository";

const paramsSchema = z.object({
  slideId: z.uuid(),
});

const saveSlideSchema = z.object({
  version: z.number().int().min(1),
  xmlContent: z.string().min(1),
});

type RouteContext = {
  params: Promise<{ slideId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsedPayload = saveSlideSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return apiError("Expected payload: { version: number, xmlContent: string }", "INVALID_PAYLOAD", 400);
  }

  try {
    const result = await updateSlideContent({
      slideId: parsedParams.data.slideId,
      version: parsedPayload.data.version,
      xmlContent: parsedPayload.data.xmlContent,
    });

    if (result.status === "not_found") {
      return apiError("Slide not found", "SLIDE_NOT_FOUND", 404);
    }

    if (result.status === "conflict") {
      return apiError("Slide version conflict", "SLIDE_VERSION_CONFLICT", 409);
    }

    return apiOk({ slide: result.slide });
  } catch {
    return apiError("Failed to save slide", "SAVE_SLIDE_FAILED", 500);
  }
}
