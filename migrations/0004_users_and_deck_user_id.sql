-- Since 0003 already creates users, we don't need to repeat it, but for safety in the script we'll keep it as IF NOT EXISTS
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

-- Update deck table to include user_id. We're using nullable column first as there's existing data.
ALTER TABLE "deck" ADD COLUMN IF NOT EXISTS "user_id" uuid;

-- Add foreign key constraint if it doesn't already exist.
-- Note: pg doesn't have IF NOT EXISTS for ADD CONSTRAINT, but we can check if it's there via information_schema or just let it fail.
-- Actually, a cleaner way is just to run the ALTER TABLE statement if the constraint doesn't exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deck_user_id_users_id_fk') THEN
        ALTER TABLE "deck" ADD CONSTRAINT "deck_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_deck_user_id" ON "deck" ("user_id");
