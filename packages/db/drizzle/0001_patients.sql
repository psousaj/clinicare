CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
CREATE TABLE IF NOT EXISTS "patients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "full_name" text NOT NULL,
  "email_ciphertext" text,
  "email_nonce" text,
  "email_search_hash" text,
  "email_search_key_version" integer,
  "email_key_version" integer,
  "phone_ciphertext" text,
  "phone_nonce" text,
  "phone_search_hash" text,
  "phone_search_key_version" integer,
  "phone_key_version" integer,
  "cpf_ciphertext" text,
  "cpf_nonce" text,
  "cpf_search_hash" text,
  "cpf_search_key_version" integer,
  "cpf_key_version" integer,
  "notes_ciphertext" text,
  "notes_nonce" text,
  "notes_key_version" integer,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "patients_full_name_not_empty" CHECK (length(trim("full_name")) >= 2)
);
CREATE INDEX IF NOT EXISTS "patients_tenant_full_name_trgm" ON "patients" USING gin ("full_name" public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "patients_tenant_id_idx" ON "patients" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "patients_active_email_unique" ON "patients" ("tenant_id", "email_search_hash") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "patients_active_phone_unique" ON "patients" ("tenant_id", "phone_search_hash") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "patients_active_cpf_unique" ON "patients" ("tenant_id", "cpf_search_hash") WHERE "deleted_at" IS NULL;
CREATE TABLE IF NOT EXISTS "patient_pending_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "patient_id" uuid NOT NULL REFERENCES "patients"("id"),
  "kind" text NOT NULL,
  "resolved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "patient_pending_operations_kind_not_empty" CHECK (length(trim("kind")) > 0)
);
CREATE INDEX IF NOT EXISTS "patient_pending_operations_patient_idx" ON "patient_pending_operations" ("tenant_id", "patient_id");
