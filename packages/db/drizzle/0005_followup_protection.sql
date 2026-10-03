ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "notes_nonce" text,
  ADD COLUMN IF NOT EXISTS "notes_key_version" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_processes_tenant_contract_unique'
      AND conrelid = 'signature_processes'::regclass
  ) THEN
    ALTER TABLE "signature_processes"
      ADD CONSTRAINT "signature_processes_tenant_contract_unique"
      UNIQUE ("tenant_id", "followup_contract_id");
  END IF;
END $$;
