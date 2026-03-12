import { resolveDeckAccess } from "@/lib/auth/deck-access";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createSlide, getDeckById, getSlidesByDeckId } from "@/lib/db/repository";

import type { DeckEntity, PersistedSlide } from "@/features/deck-editor/types";

export async function getDeckEditorBootstrap(deckId: string): Promise<{
  deck: DeckEntity;
  slides: PersistedSlide[];
} | null> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }

  const access = await resolveDeckAccess(deckId, user.id);
  if (!access.canView) {
    return null;
  }

  const deck = await getDeckById(deckId);
  if (!deck) {
    return null;
  }

  let slides = await getSlidesByDeckId(deckId);
  if (slides.length === 0 && access.canEdit) {
    const created = await createSlide(deckId);
    if (created) {
      slides = [created];
    }
  }

  return {
    deck: {
      id: deck.id,
      title: deck.title,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
      accessRole: access.role ?? undefined,
    },
    slides: slides.map((slide) => ({
      id: slide.id,
      deckId: slide.deckId,
      position: slide.position,
      xmlContent: slide.xmlContent,
      version: slide.version,
      updatedAt: slide.updatedAt.toISOString(),
    })),
  };
}
