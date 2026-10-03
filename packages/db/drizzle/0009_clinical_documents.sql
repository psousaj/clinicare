-- Clinical responses and applied-file metadata. Safe for fresh databases and re-runs.
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS validity_months integer;
UPDATE applied_anamneses SET validity_months = 12 WHERE validity_months IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applied_anamneses_tenant_id_unique' AND conrelid = 'applied_anamneses'::regclass) THEN
    ALTER TABLE applied_anamneses ADD CONSTRAINT applied_anamneses_tenant_id_unique UNIQUE (tenant_id, id);
  END IF;
END $$;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS request_token_hash text;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS request_expires_at timestamptz;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS draft_ciphertext text;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS draft_nonce text;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS draft_key_version integer;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS answers_ciphertext text;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS answers_nonce text;
ALTER TABLE applied_anamneses ADD COLUMN IF NOT EXISTS answers_key_version integer;
CREATE UNIQUE INDEX IF NOT EXISTS applied_anamneses_request_token_unique ON applied_anamneses (tenant_id, request_token_hash) WHERE request_token_hash IS NOT NULL;
ALTER TABLE applied_anamneses DROP CONSTRAINT IF EXISTS applied_anamneses_draft_protected;
ALTER TABLE applied_anamneses ADD CONSTRAINT applied_anamneses_draft_protected CHECK ((draft_ciphertext IS NULL AND draft_nonce IS NULL AND draft_key_version IS NULL) OR (draft_ciphertext IS NOT NULL AND draft_nonce IS NOT NULL AND draft_key_version IS NOT NULL));
ALTER TABLE applied_anamneses DROP CONSTRAINT IF EXISTS applied_anamneses_answers_protected;
ALTER TABLE applied_anamneses ADD CONSTRAINT applied_anamneses_answers_protected CHECK ((answers_ciphertext IS NULL AND answers_nonce IS NULL AND answers_key_version IS NULL) OR (answers_ciphertext IS NOT NULL AND answers_nonce IS NOT NULL AND answers_key_version IS NOT NULL));

CREATE TABLE IF NOT EXISTS applied_anamnesis_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, applied_anamnesis_id uuid NOT NULL,
  content_ciphertext text NOT NULL, content_nonce text NOT NULL, content_key_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applied_anamnesis_notes_tenant_applied_fk FOREIGN KEY (tenant_id, applied_anamnesis_id) REFERENCES applied_anamneses(tenant_id, id) ON DELETE CASCADE
);
ALTER TABLE applied_anamnesis_notes DROP CONSTRAINT IF EXISTS applied_anamnesis_notes_tenant_applied_fk;
ALTER TABLE applied_anamnesis_notes ADD CONSTRAINT applied_anamnesis_notes_tenant_applied_fk FOREIGN KEY (tenant_id, applied_anamnesis_id) REFERENCES applied_anamneses(tenant_id, id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS applied_anamnesis_notes_lookup_idx ON applied_anamnesis_notes(tenant_id, applied_anamnesis_id, created_at);

CREATE TABLE IF NOT EXISTS applied_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, followup_contract_id uuid NOT NULL,
  object_key text NOT NULL, content_hash text, content_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applied_documents_tenant_contract_fk FOREIGN KEY (tenant_id, followup_contract_id) REFERENCES followup_contracts(tenant_id, id),
  CONSTRAINT applied_documents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT applied_documents_object_key_opaque CHECK (object_key !~ '[/:]')
);
CREATE UNIQUE INDEX IF NOT EXISTS applied_documents_object_key_unique ON applied_documents(tenant_id, object_key);

ALTER TABLE attendance_photos DROP CONSTRAINT IF EXISTS attendance_photos_object_key_opaque;
ALTER TABLE attendance_photos ADD CONSTRAINT attendance_photos_object_key_opaque CHECK (object_key !~ '[/:]');
ALTER TABLE attendance_photos DROP CONSTRAINT IF EXISTS attendance_photos_notes_protected;
ALTER TABLE attendance_photos ADD CONSTRAINT attendance_photos_notes_protected CHECK ((notes_ciphertext IS NULL AND notes_nonce IS NULL AND notes_key_version IS NULL) OR (notes_ciphertext IS NOT NULL AND notes_nonce IS NOT NULL AND notes_key_version IS NOT NULL));

-- A submission is a one-way state transition. Draft/request fields may still be
-- refreshed before submission, but an accepted answer can never be overwritten.
CREATE OR REPLACE FUNCTION prevent_applied_anamnesis_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.followup_id IS DISTINCT FROM NEW.followup_id OR OLD.anamnesis_id IS DISTINCT FROM NEW.anamnesis_id
    OR OLD.version IS DISTINCT FROM NEW.version OR OLD.title_snapshot IS DISTINCT FROM NEW.title_snapshot
    OR OLD.schema_snapshot IS DISTINCT FROM NEW.schema_snapshot OR OLD.validity_months IS DISTINCT FROM NEW.validity_months OR OLD.required IS DISTINCT FROM NEW.required
  THEN RAISE EXCEPTION 'Applied anamnesis contract is immutable' USING ERRCODE = '55000'; END IF;
  IF OLD.submitted_at IS NOT NULL AND (OLD.draft_ciphertext IS DISTINCT FROM NEW.draft_ciphertext
    OR OLD.draft_nonce IS DISTINCT FROM NEW.draft_nonce OR OLD.draft_key_version IS DISTINCT FROM NEW.draft_key_version
    OR OLD.request_token_hash IS DISTINCT FROM NEW.request_token_hash OR OLD.request_expires_at IS DISTINCT FROM NEW.request_expires_at
    OR OLD.answers_ciphertext IS DISTINCT FROM NEW.answers_ciphertext
    OR OLD.answers_nonce IS DISTINCT FROM NEW.answers_nonce OR OLD.answers_key_version IS DISTINCT FROM NEW.answers_key_version
    OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at OR OLD.valid_until IS DISTINCT FROM NEW.valid_until)
  THEN RAISE EXCEPTION 'Submitted anamnesis answers are immutable' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS applied_anamneses_immutable_submission ON applied_anamneses;
CREATE TRIGGER applied_anamneses_immutable_submission BEFORE UPDATE ON applied_anamneses FOR EACH ROW EXECUTE FUNCTION prevent_applied_anamnesis_mutation();

CREATE OR REPLACE FUNCTION prevent_applied_anamnesis_note_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Clinical notes are append-only' USING ERRCODE = '55000'; END; $$;
DROP TRIGGER IF EXISTS applied_anamnesis_notes_append_only ON applied_anamnesis_notes;
CREATE TRIGGER applied_anamnesis_notes_append_only BEFORE UPDATE OR DELETE ON applied_anamnesis_notes FOR EACH ROW EXECUTE FUNCTION prevent_applied_anamnesis_note_mutation();
