import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/response";
import { getSlideRevision } from "@/lib/db/repository";

const paramsSchema = z.object({
  slideId: z.uuid(),
  version: z.coerce.number().int().min(1),
});

type RouteContext = {
  params: Promise<{ slideId: string; version: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return apiError("Invalid params", "INVALID_PARAMS", 400);
  }

  try {
    const revision = await getSlideRevision(parsedParams.data.slideId, parsedParams.data.version);
    if (!revision) {
      return apiError("Revision not found", "REVISION_NOT_FOUND", 404);
    }

    return apiOk({ revision });
  } catch {
    return apiError("Failed to load revision", "LOAD_REVISION_FAILED", 500);
  }
}
