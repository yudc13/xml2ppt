CREATE TABLE IF NOT EXISTS "deck_member" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "deck"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL CHECK ("role" IN ('owner', 'editor', 'commenter', 'viewer')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "deck_member_deck_user_unique" UNIQUE ("deck_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_deck_member_deck_role" ON "deck_member" ("deck_id", "role");
CREATE INDEX IF NOT EXISTS "idx_deck_member_user_id" ON "deck_member" ("user_id");

CREATE TABLE IF NOT EXISTS "deck_share_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "deck"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "permission" text NOT NULL CHECK ("permission" IN ('viewer', 'commenter', 'editor')),
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_deck_share_link_deck_id" ON "deck_share_link" ("deck_id");
CREATE INDEX IF NOT EXISTS "idx_deck_share_link_expires_at" ON "deck_share_link" ("expires_at");

CREATE TABLE IF NOT EXISTS "comment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "deck"("id") ON DELETE CASCADE,
  "slide_id" uuid NOT NULL REFERENCES "slide"("id") ON DELETE CASCADE,
  "shape_id" text,
  "parent_id" uuid REFERENCES "comment"("id") ON DELETE CASCADE,
  "content" text NOT NULL CHECK (length("content") > 0 AND length("content") <= 2000),
  "status" text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'resolved')),
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_comment_deck_slide_created_at"
  ON "comment" ("deck_id", "slide_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_comment_parent_id" ON "comment" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_comment_shape_id" ON "comment" ("shape_id");
