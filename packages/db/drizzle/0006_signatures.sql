DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_processes_tenant_id_unique'
      AND conrelid = 'signature_processes'::regclass
  ) THEN
    ALTER TABLE signature_processes ADD CONSTRAINT signature_processes_tenant_id_unique UNIQUE (tenant_id, id);
  END IF;
END $$;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS content_ciphertext text;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS content_nonce text;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS content_key_version integer;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true;
ALTER TABLE followup_contracts DROP COLUMN IF EXISTS content_snapshot;
ALTER TABLE plan_version_contracts DROP COLUMN IF EXISTS content_snapshot;
ALTER TABLE followup_contracts DROP CONSTRAINT IF EXISTS followup_contracts_content_protected;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followup_contracts_content_protected' AND conrelid = 'followup_contracts'::regclass) THEN
    ALTER TABLE followup_contracts ADD CONSTRAINT followup_contracts_content_protected CHECK ((content_ciphertext IS NULL AND content_nonce IS NULL AND content_key_version IS NULL) OR (content_ciphertext IS NOT NULL AND content_nonce IS NOT NULL AND content_key_version IS NOT NULL));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS signature_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, process_id uuid NOT NULL, role text NOT NULL, status text NOT NULL DEFAULT 'pending', signed_at timestamptz, latest_revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT signature_participants_tenant_process_fk FOREIGN KEY (tenant_id, process_id) REFERENCES signature_processes(tenant_id, id), CONSTRAINT signature_participants_role_unique UNIQUE (tenant_id, process_id, role), CONSTRAINT signature_participants_role_valid CHECK (role IN ('patient','professional')), CONSTRAINT signature_participants_status_valid CHECK (status IN ('pending','signed','revoked')), CONSTRAINT signature_participants_state_valid CHECK ((status='signed' AND signed_at IS NOT NULL) OR (status<>'signed' AND signed_at IS NULL))
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_participants_tenant_id_unique'
      AND conrelid = 'signature_participants'::regclass
  ) THEN
    ALTER TABLE signature_participants ADD CONSTRAINT signature_participants_tenant_id_unique UNIQUE (tenant_id, id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS signature_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, participant_id uuid NOT NULL, revision integer NOT NULL, evidence_ciphertext text, evidence_nonce text, evidence_key_version integer, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT signature_revisions_tenant_participant_fk FOREIGN KEY (tenant_id, participant_id) REFERENCES signature_participants(tenant_id,id), CONSTRAINT signature_revisions_number_unique UNIQUE (tenant_id,participant_id,revision)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_revisions_tenant_id_unique'
      AND conrelid = 'signature_revisions'::regclass
  ) THEN
    ALTER TABLE signature_revisions ADD CONSTRAINT signature_revisions_tenant_id_unique UNIQUE (tenant_id, id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS signature_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, participant_id uuid NOT NULL, revision_id uuid, type text NOT NULL, metadata jsonb, occurred_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT signature_events_tenant_participant_fk FOREIGN KEY (tenant_id,participant_id) REFERENCES signature_participants(tenant_id,id), CONSTRAINT signature_events_tenant_revision_fk FOREIGN KEY (tenant_id,revision_id) REFERENCES signature_revisions(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS signature_events_participant_idx ON signature_events(tenant_id, participant_id, occurred_at);
CREATE TABLE IF NOT EXISTS signature_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, participant_id uuid NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT signature_tokens_tenant_participant_fk FOREIGN KEY (tenant_id,participant_id) REFERENCES signature_participants(tenant_id,id), CONSTRAINT signature_tokens_hash_unique UNIQUE (tenant_id,token_hash), CONSTRAINT signature_tokens_hash_not_empty CHECK (length(token_hash) >= 64)
);
CREATE INDEX IF NOT EXISTS signature_tokens_active_idx ON signature_tokens(tenant_id,participant_id,expires_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_version_contracts_tenant_contract_version_fk' AND conrelid = 'plan_version_contracts'::regclass) THEN
    ALTER TABLE plan_version_contracts ADD CONSTRAINT plan_version_contracts_tenant_contract_version_fk FOREIGN KEY (tenant_id, contract_id, contract_version) REFERENCES contract_versions(tenant_id, contract_id, version);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followup_contracts_tenant_contract_version_fk' AND conrelid = 'followup_contracts'::regclass) THEN
    ALTER TABLE followup_contracts ADD CONSTRAINT followup_contracts_tenant_contract_version_fk FOREIGN KEY (tenant_id, contract_id, contract_version) REFERENCES contract_versions(tenant_id, contract_id, version);
  END IF;
END $$;
