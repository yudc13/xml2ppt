import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  decks,
  slideRevisions,
  slides,
  type Deck,
  type Slide,
  type SlideRevision,
} from "@/lib/db/schema";
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

    const slideXmlContent = xmlContent ?? createBlankSlideXml();
    const [created] = await tx
      .insert(slides)
      .values({
        deckId,
        position: nextPosition,
        xmlContent: slideXmlContent,
      })
      .returning();

    await tx.insert(slideRevisions).values({
      slideId: created.id,
      version: created.version,
      xmlContent: slideXmlContent,
      createdBy: "local",
      reason: "create",
    });

    return created;
  });
}

export async function updateSlideContent(params: {
  slideId: string;
  version: number;
  xmlContent: string;
  reason?: "manual_save" | "autosave" | "rollback";
}): Promise<{ status: "updated"; slide: Slide } | { status: "conflict" } | { status: "not_found" }> {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
    const [nextSlide] = await tx
      .update(slides)
      .set({
        xmlContent: params.xmlContent,
        version: sql`${slides.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(slides.id, params.slideId), eq(slides.version, params.version)))
      .returning();

    if (!nextSlide) {
      return null;
    }

    await tx.insert(slideRevisions).values({
      slideId: nextSlide.id,
      version: nextSlide.version,
      xmlContent: params.xmlContent,
      createdBy: "local",
      reason: params.reason ?? "manual_save",
    });

    return nextSlide;
  });

  if (updated) {
    return { status: "updated", slide: updated };
  }

  const [existing] = await db.select({ id: slides.id }).from(slides).where(eq(slides.id, params.slideId)).limit(1);
  if (!existing) {
    return { status: "not_found" };
  }

  return { status: "conflict" };
}

export async function listSlideRevisions(slideId: string, limit = 50): Promise<SlideRevision[]> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(200, limit));
  return db
    .select()
    .from(slideRevisions)
    .where(eq(slideRevisions.slideId, slideId))
    .orderBy(desc(slideRevisions.version))
    .limit(safeLimit);
}

export async function getSlideRevision(slideId: string, version: number): Promise<SlideRevision | null> {
  const db = getDb();
  const [revision] = await db
    .select()
    .from(slideRevisions)
    .where(and(eq(slideRevisions.slideId, slideId), eq(slideRevisions.version, version)))
    .limit(1);

  return revision ?? null;
}

export async function rollbackSlideToRevision(params: {
  slideId: string;
  targetVersion: number;
  currentVersion: number;
}): Promise<{ status: "updated"; slide: Slide } | { status: "conflict" } | { status: "not_found" }> {
  const db = getDb();

  const rolledBack = await db.transaction(async (tx) => {
    const [targetRevision] = await tx
      .select()
      .from(slideRevisions)
      .where(and(eq(slideRevisions.slideId, params.slideId), eq(slideRevisions.version, params.targetVersion)))
      .limit(1);

    if (!targetRevision) {
      return null;
    }

    const [nextSlide] = await tx
      .update(slides)
      .set({
        xmlContent: targetRevision.xmlContent,
        version: sql`${slides.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(slides.id, params.slideId), eq(slides.version, params.currentVersion)))
      .returning();

    if (!nextSlide) {
      return undefined;
    }

    await tx.insert(slideRevisions).values({
      slideId: nextSlide.id,
      version: nextSlide.version,
      xmlContent: targetRevision.xmlContent,
      createdBy: "local",
      reason: "rollback",
    });

    return nextSlide;
  });

  if (rolledBack === undefined) {
    return { status: "conflict" };
  }

  if (rolledBack === null) {
    return { status: "not_found" };
  }

  return { status: "updated", slide: rolledBack };
}
