CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "initial_password_choice" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_initial_password_choice_valid" CHECK ("initial_password_choice" IN ('pending', 'accepted', 'declined'))
);
CREATE INDEX IF NOT EXISTS "user_tenant_id_idx" ON "user" ("tenant_id");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");
CREATE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" ("provider_id", "account_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX IF NOT EXISTS "verification_expires_at_idx" ON "verification" ("expires_at");

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
UPDATE "tenants" SET "active" = true WHERE "active" IS NULL;
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_unique" UNIQUE ("tenant_id");
UPDATE "user" SET "initial_password_choice" = 'pending' WHERE "initial_password_choice" IS NULL;
ALTER TABLE "user" ALTER COLUMN "initial_password_choice" SET DEFAULT 'pending';
ALTER TABLE "user" ALTER COLUMN "initial_password_choice" SET NOT NULL;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_initial_password_choice_valid";
ALTER TABLE "user" ADD CONSTRAINT "user_initial_password_choice_valid" CHECK ("initial_password_choice" IN ('pending', 'accepted', 'declined'));
