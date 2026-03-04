import { bigint, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const decks = pgTable(
  "deck",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    updatedAtIdx: index("idx_deck_updated_at").on(table.updatedAt),
  }),
);

export const slides = pgTable(
  "slide",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    xmlContent: text("xml_content").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deckPositionUnique: uniqueIndex("slide_deck_position_unique").on(table.deckId, table.position),
    deckPositionIdx: index("idx_slide_deck_position").on(table.deckId, table.position),
  }),
);

export const slideRevisions = pgTable(
  "slide_revision",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    slideId: uuid("slide_id")
      .notNull()
      .references(() => slides.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    xmlContent: text("xml_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
    reason: text("reason"),
  },
  (table) => ({
    slideVersionUnique: uniqueIndex("slide_revision_slide_version_unique").on(table.slideId, table.version),
    slideVersionIdx: index("idx_slide_revision_slide_version").on(table.slideId, table.version),
  }),
);

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type Slide = typeof slides.$inferSelect;
export type NewSlide = typeof slides.$inferInsert;
export type SlideRevision = typeof slideRevisions.$inferSelect;
export type NewSlideRevision = typeof slideRevisions.$inferInsert;
