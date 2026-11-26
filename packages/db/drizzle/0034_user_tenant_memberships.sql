CREATE TABLE IF NOT EXISTS "user_tenant_memberships" (
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "role" text NOT NULL DEFAULT 'admin',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_tenant_memberships_pk" PRIMARY KEY ("user_id", "tenant_id"),
  CONSTRAINT "user_tenant_memberships_role_valid" CHECK ("role" = 'admin')
);
CREATE INDEX IF NOT EXISTS "user_tenant_memberships_tenant_idx"
  ON "user_tenant_memberships" ("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"user_tenant_memberships"'::regclass
      AND conname = 'user_tenant_memberships_pk'
  ) THEN
    ALTER TABLE "user_tenant_memberships"
      ADD CONSTRAINT "user_tenant_memberships_pk" PRIMARY KEY ("user_id", "tenant_id");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"user_tenant_memberships"'::regclass
      AND conname = 'user_tenant_memberships_role_valid'
  ) THEN
    ALTER TABLE "user_tenant_memberships"
      ADD CONSTRAINT "user_tenant_memberships_role_valid" CHECK ("role" = 'admin');
  END IF;
END
$$;

INSERT INTO "user_tenant_memberships" ("user_id", "tenant_id", "role")
SELECT "id", "tenant_id", 'admin'
FROM "user"
WHERE "tenant_id" IS NOT NULL
ON CONFLICT ("user_id", "tenant_id") DO NOTHING;
