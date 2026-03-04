CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clerk_user_id" text NOT NULL,
  "email" text,
  "name" text,
  "avatar_url" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_unique" ON "users" ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "idx_users_updated_at" ON "users" ("updated_at");
