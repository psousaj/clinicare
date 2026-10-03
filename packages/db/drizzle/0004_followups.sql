DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plan_versions_tenant_plan_id_unique'
      AND conrelid = 'plan_versions'::regclass
  ) THEN
    ALTER TABLE "plan_versions"
      ADD CONSTRAINT "plan_versions_tenant_plan_id_unique" UNIQUE ("tenant_id", "plan_id", "id");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "followups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL,
  "offer_type" text NOT NULL, "offer_id" uuid NOT NULL, "combo_id" uuid, "plan_id" uuid, "plan_version_id" uuid,
  "status" text NOT NULL DEFAULT 'active', "offer_name_snapshot" text NOT NULL, "price_cents" integer NOT NULL,
  "valid_until" timestamptz, "cancellation_reason" text, "completed_at" timestamptz, "cancelled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "followups_tenant_patient_fk" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patients" ("tenant_id", "id"),
  CONSTRAINT "followups_tenant_combo_fk" FOREIGN KEY ("tenant_id", "combo_id") REFERENCES "combos" ("tenant_id", "id"),
  CONSTRAINT "followups_tenant_plan_fk" FOREIGN KEY ("tenant_id", "plan_id") REFERENCES "plans" ("tenant_id", "id"),
  CONSTRAINT "followups_tenant_plan_version_fk" FOREIGN KEY ("tenant_id", "plan_id", "plan_version_id") REFERENCES "plan_versions" ("tenant_id", "plan_id", "id"),
  CONSTRAINT "followups_tenant_id_unique" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "followups_tenant_id_patient_unique" UNIQUE ("tenant_id", "id", "patient_id"),
  CONSTRAINT "followups_offer_type_valid" CHECK ("offer_type" IN ('procedure', 'combo', 'plan')),
  CONSTRAINT "followups_offer_target_valid" CHECK (("offer_type" = 'procedure' AND "combo_id" IS NULL AND "plan_id" IS NULL AND "plan_version_id" IS NULL) OR ("offer_type" = 'combo' AND "combo_id" = "offer_id" AND "plan_id" IS NULL AND "plan_version_id" IS NULL) OR ("offer_type" = 'plan' AND "plan_id" = "offer_id" AND "combo_id" IS NULL AND "plan_version_id" IS NOT NULL)),
  CONSTRAINT "followups_status_valid" CHECK ("status" IN ('idle', 'active', 'completed', 'cancelled')),
  CONSTRAINT "followups_price_nonnegative" CHECK ("price_cents" >= 0),
  CONSTRAINT "followups_cancelled_state_valid" CHECK (("status" = 'cancelled' AND "cancelled_at" IS NOT NULL AND "completed_at" IS NULL AND "cancellation_reason" IS NOT NULL AND length(trim("cancellation_reason")) > 0) OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL AND "cancellation_reason" IS NULL)),
  CONSTRAINT "followups_completed_state_valid" CHECK (("status" = 'completed' AND "completed_at" IS NOT NULL AND "cancelled_at" IS NULL AND "cancellation_reason" IS NULL) OR ("status" <> 'completed' AND "completed_at" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "followups_live_offer_unique" ON "followups" ("tenant_id", "patient_id", "offer_type", "offer_id") WHERE "status" NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS "followups_patient_created_idx" ON "followups" ("tenant_id", "patient_id", "created_at");

CREATE TABLE IF NOT EXISTS "followup_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "followup_id" uuid NOT NULL, "procedure_id" uuid NOT NULL,
  "procedure_name" text NOT NULL, "sessions_total" integer NOT NULL, "sessions_performed" integer NOT NULL DEFAULT 0,
  "duration_minutes" integer NOT NULL, "price_cents" integer NOT NULL, "session_schema" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "followup_items_tenant_followup_fk" FOREIGN KEY ("tenant_id", "followup_id") REFERENCES "followups" ("tenant_id", "id"),
  CONSTRAINT "followup_items_tenant_procedure_fk" FOREIGN KEY ("tenant_id", "procedure_id") REFERENCES "procedures" ("tenant_id", "id"),
  CONSTRAINT "followup_items_sessions_positive" CHECK ("sessions_total" >= 1),
  CONSTRAINT "followup_items_performed_valid" CHECK ("sessions_performed" BETWEEN 0 AND "sessions_total"),
  CONSTRAINT "followup_items_duration_positive" CHECK ("duration_minutes" >= 1),
  CONSTRAINT "followup_items_price_nonnegative" CHECK ("price_cents" >= 0)
);
CREATE TABLE IF NOT EXISTS "followup_snapshots" (
  "id" uuid DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "followup_id" uuid NOT NULL, "kind" text NOT NULL,
  "source_version" integer, "payload" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "followup_snapshots_tenant_followup_fk" FOREIGN KEY ("tenant_id", "followup_id") REFERENCES "followups" ("tenant_id", "id"),
  CONSTRAINT "followup_snapshots_pk" PRIMARY KEY ("tenant_id", "followup_id", "kind"),
  CONSTRAINT "followup_snapshots_kind_valid" CHECK ("kind" IN ('combo', 'plan'))
);
CREATE TABLE IF NOT EXISTS "followup_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "followup_id" uuid NOT NULL, "contract_id" uuid NOT NULL,
  "contract_version" integer NOT NULL, "title_snapshot" text NOT NULL, "content_snapshot" text, "source_object_key" text,
  "patient_signed_at" timestamptz, "professional_signed_at" timestamptz, "status" text NOT NULL DEFAULT 'pending', "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "followup_contracts_tenant_followup_fk" FOREIGN KEY ("tenant_id", "followup_id") REFERENCES "followups" ("tenant_id", "id"),
  CONSTRAINT "followup_contracts_tenant_contract_fk" FOREIGN KEY ("tenant_id", "contract_id") REFERENCES "contracts" ("tenant_id", "id"),
  CONSTRAINT "followup_contracts_tenant_id_unique" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "followup_contracts_version_positive" CHECK ("contract_version" >= 1),
  CONSTRAINT "followup_contracts_status_valid" CHECK ("status" IN ('pending', 'signed', 'cancelled'))
);
CREATE TABLE IF NOT EXISTS "signature_processes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "followup_contract_id" uuid NOT NULL, "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "signature_processes_tenant_contract_fk" FOREIGN KEY ("tenant_id", "followup_contract_id") REFERENCES "followup_contracts" ("tenant_id", "id"),
  CONSTRAINT "signature_processes_tenant_contract_unique" UNIQUE ("tenant_id", "followup_contract_id"),
  CONSTRAINT "signature_processes_status_valid" CHECK ("status" IN ('pending', 'completed', 'cancelled'))
);
CREATE TABLE IF NOT EXISTS "applied_anamneses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "followup_id" uuid NOT NULL, "anamnesis_id" uuid NOT NULL,
  "version" integer NOT NULL, "title_snapshot" text NOT NULL, "schema_snapshot" jsonb NOT NULL, "required" boolean NOT NULL DEFAULT true,
  "submitted_at" timestamptz, "valid_until" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "applied_anamneses_tenant_patient_fk" FOREIGN KEY ("tenant_id", "patient_id") REFERENCES "patients" ("tenant_id", "id"),
  CONSTRAINT "applied_anamneses_tenant_followup_patient_fk" FOREIGN KEY ("tenant_id", "followup_id", "patient_id") REFERENCES "followups" ("tenant_id", "id", "patient_id"),
  CONSTRAINT "applied_anamneses_tenant_anamnesis_fk" FOREIGN KEY ("tenant_id", "anamnesis_id") REFERENCES "anamneses" ("tenant_id", "id"),
  CONSTRAINT "applied_anamneses_version_positive" CHECK ("version" >= 1)
);
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "followup_id" uuid NOT NULL, "amount_cents" integer NOT NULL, "method" text NOT NULL,
  "installments" integer NOT NULL DEFAULT 1, "received_at" timestamptz NOT NULL DEFAULT now(), "notes_ciphertext" text, "notes_nonce" text, "notes_key_version" integer, "idempotency_key" text, "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "payments_tenant_followup_fk" FOREIGN KEY ("tenant_id", "followup_id") REFERENCES "followups" ("tenant_id", "id"),
  CONSTRAINT "payments_tenant_id_unique" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "payments_amount_positive" CHECK ("amount_cents" > 0),
  CONSTRAINT "payments_installments_positive" CHECK ("installments" >= 1),
  CONSTRAINT "payments_method_valid" CHECK ("method" IN ('cash', 'pix', 'credit_card'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_unique" ON "payments" ("tenant_id", "followup_id", "idempotency_key");
