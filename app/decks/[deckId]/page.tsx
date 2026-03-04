import { notFound } from "next/navigation";

import { DeckEditorClient } from "@/features/deck-editor/components/deck-editor-client";
import { getDeckEditorBootstrap } from "@/features/deck-editor/server/get-deck-editor-bootstrap";

type PageProps = {
  params: Promise<{ deckId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { deckId } = await params;
  const bootstrap = await getDeckEditorBootstrap(deckId);

  if (!bootstrap) {
    notFound();
  }

  return <DeckEditorClient deckId={deckId} initialDeck={bootstrap.deck} initialSlides={bootstrap.slides} />;
}
