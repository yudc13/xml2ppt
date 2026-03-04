import { and, asc, eq, max, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { decks, slides, type Deck, type Slide } from "@/lib/db/schema";
import { createBlankSlideXml } from "@/lib/slides/default-xml";

export async function createDeck(title: string): Promise<Deck> {
  const db = getDb();
  const [created] = await db.insert(decks).values({ title }).returning();
  return created;
}

export async function getSlidesByDeckId(deckId: string): Promise<Slide[]> {
  const db = getDb();
  return db.select().from(slides).where(eq(slides.deckId, deckId)).orderBy(asc(slides.position));
}

export async function createSlide(deckId: string, xmlContent?: string): Promise<Slide | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [deck] = await tx.select({ id: decks.id }).from(decks).where(eq(decks.id, deckId)).limit(1);
    if (!deck) {
      return null;
    }

    const [positionResult] = await tx
      .select({ maxPosition: max(slides.position) })
      .from(slides)
      .where(eq(slides.deckId, deckId));
    const nextPosition = (positionResult.maxPosition ?? 0) + 1;

    const [created] = await tx
      .insert(slides)
      .values({
        deckId,
        position: nextPosition,
        xmlContent: xmlContent ?? createBlankSlideXml(),
      })
      .returning();

    return created;
  });
}

export async function updateSlideContent(params: {
  slideId: string;
  version: number;
  xmlContent: string;
}): Promise<{ status: "updated"; slide: Slide } | { status: "conflict" } | { status: "not_found" }> {
  const db = getDb();
  const [updated] = await db
    .update(slides)
    .set({
      xmlContent: params.xmlContent,
      version: sql`${slides.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(slides.id, params.slideId), eq(slides.version, params.version)))
    .returning();

  if (updated) {
    return { status: "updated", slide: updated };
  }

  const [existing] = await db.select({ id: slides.id }).from(slides).where(eq(slides.id, params.slideId)).limit(1);
  if (!existing) {
    return { status: "not_found" };
  }

  return { status: "conflict" };
}
