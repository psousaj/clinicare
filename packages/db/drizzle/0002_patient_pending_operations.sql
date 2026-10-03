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