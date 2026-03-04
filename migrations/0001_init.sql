CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "deck" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "slide" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "deck"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "xml_content" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "slide_deck_position_unique" ON "slide" ("deck_id", "position");
CREATE INDEX IF NOT EXISTS "idx_slide_deck_position" ON "slide" ("deck_id", "position");
CREATE INDEX IF NOT EXISTS "idx_deck_updated_at" ON "deck" ("updated_at");
