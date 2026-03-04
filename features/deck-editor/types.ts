export type PersistedSlide = {
  id: string;
  deckId: string;
  position: number;
  xmlContent: string;
  version: number;
  updatedAt: string;
};

export type DeckEntity = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SlideRevisionEntity = {
  id: number;
  slideId: string;
  version: number;
  xmlContent: string;
  createdAt: string;
  createdBy: string | null;
  reason: string | null;
};

export type SaveStatus = "idle" | "success" | "error" | "conflict";
