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
  accessRole?: "owner" | "editor" | "commenter" | "viewer";
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

export type SharePermission = "viewer" | "commenter" | "editor";

export type DeckShareLinkEntity = {
  id: string;
  deckId: string;
  permission: SharePermission;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type CommentEntity = {
  id: string;
  deckId: string;
  slideId: string;
  shapeId: string | null;
  parentId: string | null;
  content: string;
  status: "open" | "resolved";
  authorId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlideDiffChangeType = "added" | "removed" | "moved_resized" | "text_changed";

export type SlideDiffChange = {
  type: SlideDiffChangeType;
  shapeId: string;
  shapeType: string;
  summary: string;
};

export type SlideDiffSummary = {
  totalChanges: number;
  added: number;
  removed: number;
  movedResized: number;
  textChanged: number;
};

export type SlideDiffResult = {
  fromVersion: number;
  toVersion: number;
  summary: SlideDiffSummary;
  changes: SlideDiffChange[];
};
