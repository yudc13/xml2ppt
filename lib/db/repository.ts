import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  decks,
  slideRevisions,
  slides,
  users,
  type Deck,
  type Slide,
  type SlideRevision,
  type User,
} from "@/lib/db/schema";
import { createBlankSlideXml } from "@/lib/slides/default-xml";

export async function createDeck(title: string): Promise<Deck> {
  const db = getDb();
  const [created] = await db.insert(decks).values({ title }).returning();
  return created;
}

export async function listDecks(): Promise<Deck[]> {
  const db = getDb();
  return db.select().from(decks).orderBy(desc(decks.updatedAt));
}

export async function getDeckById(deckId: string): Promise<Deck | null> {
  const db = getDb();
  const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
  return deck ?? null;
}

export async function updateDeckTitle(deckId: string, title: string): Promise<Deck | null> {
  const db = getDb();
  const [updated] = await db
    .update(decks)
    .set({
      title,
      updatedAt: sql`now()`,
    })
    .where(eq(decks.id, deckId))
    .returning();

  return updated ?? null;
}

export async function getSlidesByDeckId(deckId: string): Promise<Slide[]> {
  const db = getDb();
  return db.select().from(slides).where(eq(slides.deckId, deckId)).orderBy(asc(slides.position));
}

export async function createSlide(deckId: string, xmlContent?: string, actorId?: string | null): Promise<Slide | null> {
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
      createdBy: actorId ?? "system",
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
  actorId?: string | null;
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
      createdBy: params.actorId ?? "system",
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
  actorId?: string | null;
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
      createdBy: params.actorId ?? "system",
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

export async function upsertUserByClerk(params: {
  clerkUserId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  const db = getDb();

  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: params.clerkUserId,
      email: params.email ?? null,
      name: params.name ?? null,
      avatarUrl: params.avatarUrl ?? null,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: params.email ?? null,
        name: params.name ?? null,
        avatarUrl: params.avatarUrl ?? null,
        deletedAt: null,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return user;
}

export async function markUserDeletedByClerkId(clerkUserId: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .update(users)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.clerkUserId, clerkUserId))
    .returning();

  return user ?? null;
}
