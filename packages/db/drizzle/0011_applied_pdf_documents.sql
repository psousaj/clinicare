-- Materializes the rendered PDF associated with an applied contract.
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS rendered_pdf_object_key text;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS rendered_pdf_hash text;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS rendered_pdf_size integer;
ALTER TABLE followup_contracts ADD COLUMN IF NOT EXISTS rendered_pdf_content_type text;
ALTER TABLE followup_contracts DROP CONSTRAINT IF EXISTS followup_contracts_rendered_pdf_valid;
ALTER TABLE followup_contracts ADD CONSTRAINT followup_contracts_rendered_pdf_valid CHECK (
  (rendered_pdf_object_key IS NULL AND rendered_pdf_hash IS NULL AND rendered_pdf_size IS NULL AND rendered_pdf_content_type IS NULL)
  OR (rendered_pdf_object_key IS NOT NULL AND rendered_pdf_hash ~ '^[0-9a-fA-F]{64}$' AND rendered_pdf_size > 0 AND rendered_pdf_content_type = 'application/pdf')
);
ALTER TABLE contract_versions ADD COLUMN IF NOT EXISTS rendered_pdf_object_key text;
ALTER TABLE contract_versions ADD COLUMN IF NOT EXISTS rendered_pdf_hash text;
ALTER TABLE contract_versions ADD COLUMN IF NOT EXISTS rendered_pdf_size integer;
ALTER TABLE contract_versions ADD COLUMN IF NOT EXISTS rendered_pdf_content_type text;
ALTER TABLE contract_versions DROP CONSTRAINT IF EXISTS contract_versions_rendered_pdf_metadata_valid;
ALTER TABLE contract_versions ADD CONSTRAINT contract_versions_rendered_pdf_metadata_valid CHECK (
  (rendered_pdf_object_key IS NULL AND rendered_pdf_hash IS NULL AND rendered_pdf_size IS NULL AND rendered_pdf_content_type IS NULL)
  OR (rendered_pdf_object_key IS NOT NULL AND rendered_pdf_hash ~ '^[0-9a-fA-F]{64}$' AND rendered_pdf_size > 0 AND rendered_pdf_content_type = 'application/pdf')
);

CREATE TABLE IF NOT EXISTS contract_version_pdf_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, contract_id uuid NOT NULL, contract_version integer NOT NULL,
  object_key text NOT NULL, content_hash text NOT NULL, content_size integer NOT NULL, content_type text NOT NULL,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_version_pdf_upload_intents_version_fk FOREIGN KEY (tenant_id, contract_id, contract_version) REFERENCES contract_versions(tenant_id, contract_id, version),
  CONSTRAINT contract_version_pdf_upload_intents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT contract_version_pdf_upload_intents_tenant_object_key_unique UNIQUE (tenant_id, object_key),
  CONSTRAINT contract_version_pdf_upload_intents_object_key_opaque CHECK (object_key !~ '[/:]'),
  CONSTRAINT contract_version_pdf_upload_intents_hash_valid CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT contract_version_pdf_upload_intents_size_positive CHECK (content_size > 0),
  CONSTRAINT contract_version_pdf_upload_intents_type_valid CHECK (content_type = 'application/pdf')
);

-- Rendered metadata may be completed once, but cannot be replaced or removed afterwards.
CREATE OR REPLACE FUNCTION prevent_followup_contract_rendered_pdf_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.rendered_pdf_object_key IS NOT NULL AND (
    OLD.rendered_pdf_object_key IS DISTINCT FROM NEW.rendered_pdf_object_key OR OLD.rendered_pdf_hash IS DISTINCT FROM NEW.rendered_pdf_hash
    OR OLD.rendered_pdf_size IS DISTINCT FROM NEW.rendered_pdf_size OR OLD.rendered_pdf_content_type IS DISTINCT FROM NEW.rendered_pdf_content_type
  ) THEN RAISE EXCEPTION 'Rendered applied contract PDF metadata is immutable' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS followup_contracts_rendered_pdf_immutable ON followup_contracts;
CREATE TRIGGER followup_contracts_rendered_pdf_immutable BEFORE UPDATE ON followup_contracts FOR EACH ROW EXECUTE FUNCTION prevent_followup_contract_rendered_pdf_mutation();
CREATE OR REPLACE FUNCTION prevent_contract_version_rendered_pdf_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.rendered_pdf_object_key IS NOT NULL AND (
    OLD.rendered_pdf_object_key IS DISTINCT FROM NEW.rendered_pdf_object_key OR OLD.rendered_pdf_hash IS DISTINCT FROM NEW.rendered_pdf_hash
    OR OLD.rendered_pdf_size IS DISTINCT FROM NEW.rendered_pdf_size OR OLD.rendered_pdf_content_type IS DISTINCT FROM NEW.rendered_pdf_content_type
  ) THEN RAISE EXCEPTION 'Rendered contract PDF metadata is immutable' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS contract_versions_rendered_pdf_immutable ON contract_versions;
CREATE TRIGGER contract_versions_rendered_pdf_immutable BEFORE UPDATE ON contract_versions FOR EACH ROW EXECUTE FUNCTION prevent_contract_version_rendered_pdf_mutation();

-- Existing rows are metadata-only and cannot be promoted to documents without a verified PDF.
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS original_object_key text;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS original_hash text;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS original_size integer;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS current_revision_id uuid;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS legacy_unsupported boolean NOT NULL DEFAULT false;

-- Legacy rows remain visible with their original metadata, but are explicitly
-- unsupported until an operator performs a separately verified migration.
UPDATE applied_documents SET legacy_unsupported = true WHERE current_revision_id IS NULL;

-- Keep the legacy columns and data. Older deployments populated object_key/content_type;
-- dropping them here would destroy metadata before an explicit, verified backfill exists.
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS object_key text;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE applied_documents ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE applied_documents ALTER COLUMN object_key DROP NOT NULL;
ALTER TABLE applied_documents ALTER COLUMN content_type DROP NOT NULL;

-- Backfill only the new identity fields when the legacy row already contains enough
-- information; rows that lack a verified size remain legacy-compatible and are not
-- silently fabricated into the new aggregate shape.
UPDATE applied_documents
SET original_object_key = object_key,
    original_hash = content_hash
WHERE original_object_key IS NULL AND object_key IS NOT NULL AND content_hash IS NOT NULL;

ALTER TABLE applied_documents DROP CONSTRAINT IF EXISTS applied_documents_object_key_opaque;
DROP INDEX IF EXISTS applied_documents_object_key_unique;
ALTER TABLE applied_documents DROP CONSTRAINT IF EXISTS applied_documents_original_object_key_opaque;
ALTER TABLE applied_documents ADD CONSTRAINT applied_documents_original_object_key_opaque CHECK (original_object_key IS NULL OR original_object_key !~ '[/:]');
ALTER TABLE applied_documents DROP CONSTRAINT IF EXISTS applied_documents_original_hash_valid;
ALTER TABLE applied_documents ADD CONSTRAINT applied_documents_original_hash_valid CHECK (original_hash IS NULL OR original_hash ~ '^[0-9a-fA-F]{64}$');
ALTER TABLE applied_documents DROP CONSTRAINT IF EXISTS applied_documents_original_size_positive;
ALTER TABLE applied_documents ADD CONSTRAINT applied_documents_original_size_positive CHECK (original_size IS NULL OR original_size > 0);

CREATE UNIQUE INDEX IF NOT EXISTS applied_documents_original_object_key_unique ON applied_documents (tenant_id, original_object_key) WHERE original_object_key IS NOT NULL;
-- Legacy rows may contain duplicate contract links. Only supported materialized
-- documents participate in the one-document-per-contract invariant.
DROP INDEX IF EXISTS applied_documents_tenant_contract_unique;
CREATE UNIQUE INDEX IF NOT EXISTS applied_documents_tenant_contract_unique
  ON applied_documents (tenant_id, followup_contract_id)
  WHERE legacy_unsupported = false;

CREATE TABLE IF NOT EXISTS pdf_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, followup_contract_id uuid NOT NULL,
  object_key text NOT NULL, content_hash text NOT NULL, content_size integer NOT NULL, content_type text NOT NULL,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_upload_intents_tenant_contract_fk FOREIGN KEY (tenant_id, followup_contract_id) REFERENCES followup_contracts(tenant_id, id),
  CONSTRAINT pdf_upload_intents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT pdf_upload_intents_tenant_object_key_unique UNIQUE (tenant_id, object_key),
  CONSTRAINT pdf_upload_intents_object_key_opaque CHECK (object_key !~ '[/:]'),
  CONSTRAINT pdf_upload_intents_hash_valid CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT pdf_upload_intents_size_positive CHECK (content_size > 0),
  CONSTRAINT pdf_upload_intents_type_valid CHECK (content_type = 'application/pdf')
);

CREATE TABLE IF NOT EXISTS applied_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, document_id uuid NOT NULL, version integer NOT NULL,
  parent_revision_id uuid, object_key text NOT NULL, content_hash text NOT NULL, content_size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applied_document_revisions_tenant_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES applied_documents(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT applied_document_revisions_tenant_document_parent_fk FOREIGN KEY (tenant_id, document_id, parent_revision_id) REFERENCES applied_document_revisions(tenant_id, document_id, id),
  CONSTRAINT applied_document_revisions_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT applied_document_revisions_tenant_document_id_unique UNIQUE (tenant_id, document_id, id),
  CONSTRAINT applied_document_revisions_document_version_unique UNIQUE (tenant_id, document_id, version),
  CONSTRAINT applied_document_revisions_object_key_opaque CHECK (object_key !~ '[/:]'),
  CONSTRAINT applied_document_revisions_version_positive CHECK (version >= 1),
  CONSTRAINT applied_document_revisions_content_hash_valid CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT applied_document_revisions_content_size_positive CHECK (content_size > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS applied_document_revisions_object_key_unique ON applied_document_revisions (tenant_id, object_key);
CREATE UNIQUE INDEX IF NOT EXISTS applied_document_revisions_parent_unique ON applied_document_revisions (tenant_id, document_id, parent_revision_id) WHERE parent_revision_id IS NOT NULL;
ALTER TABLE applied_documents DROP CONSTRAINT IF EXISTS applied_documents_current_revision_fk;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applied_documents_current_revision_fk' AND conrelid = 'applied_documents'::regclass) THEN
    ALTER TABLE applied_documents ADD CONSTRAINT applied_documents_current_revision_fk FOREIGN KEY (tenant_id, id, current_revision_id) REFERENCES applied_document_revisions(tenant_id, document_id, id);
  END IF;
END $$;

-- A document's identity and its revisions are append-only. Only HEAD may move.
CREATE OR REPLACE FUNCTION prevent_applied_document_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.followup_contract_id IS DISTINCT FROM NEW.followup_contract_id
    OR OLD.original_object_key IS DISTINCT FROM NEW.original_object_key OR OLD.original_hash IS DISTINCT FROM NEW.original_hash OR OLD.original_size IS DISTINCT FROM NEW.original_size
    OR OLD.legacy_unsupported IS DISTINCT FROM NEW.legacy_unsupported
  THEN RAISE EXCEPTION 'Applied PDF document is immutable' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS applied_documents_immutable_identity ON applied_documents;
CREATE TRIGGER applied_documents_immutable_identity BEFORE UPDATE ON applied_documents FOR EACH ROW EXECUTE FUNCTION prevent_applied_document_mutation();

-- HEAD changes are constrained to the append-only revision chain. The only
-- exceptions are the two internal transitions needed to construct or purge
-- an aggregate; both are transaction-local settings, never client input.
CREATE OR REPLACE FUNCTION enforce_applied_document_head() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target applied_document_revisions%ROWTYPE;
  parent applied_document_revisions%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_revision_id IS NULL AND current_setting('app.constructing_applied_document', true) <> 'on' THEN
      RAISE EXCEPTION 'New applied PDF documents must have revision 1 as HEAD' USING ERRCODE = '23514';
    END IF;
    IF NEW.current_revision_id IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.current_revision_id IS NOT DISTINCT FROM OLD.current_revision_id THEN
    RETURN NEW;
  ELSIF NEW.current_revision_id IS NULL THEN
    IF current_setting('app.purging_applied_document', true) = 'on' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Applied PDF document HEAD may only be cleared during purge' USING ERRCODE = '55000';
  ELSIF OLD.current_revision_id IS NULL AND current_setting('app.constructing_applied_document', true) = 'on' THEN
    NULL;
  ELSIF OLD.current_revision_id IS NULL THEN
    RAISE EXCEPTION 'Applied PDF document HEAD may only be initialized during construction' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO target FROM applied_document_revisions WHERE tenant_id = NEW.tenant_id AND document_id = NEW.id AND id = NEW.current_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Applied PDF document HEAD must reference the same document' USING ERRCODE = '23514'; END IF;
  IF OLD.current_revision_id IS NULL THEN
    IF target.version <> 1 OR target.parent_revision_id IS NOT NULL THEN RAISE EXCEPTION 'Initial applied PDF HEAD must be revision 1' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT * INTO parent FROM applied_document_revisions WHERE tenant_id = OLD.tenant_id AND document_id = OLD.id AND id = OLD.current_revision_id;
    IF target.parent_revision_id IS DISTINCT FROM parent.id OR target.version <> parent.version + 1 THEN
      RAISE EXCEPTION 'Applied PDF HEAD must append to the previous HEAD' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS applied_documents_head_invariant ON applied_documents;
CREATE TRIGGER applied_documents_head_invariant BEFORE INSERT OR UPDATE OF current_revision_id ON applied_documents FOR EACH ROW EXECUTE FUNCTION enforce_applied_document_head();

-- Every revision must extend the document HEAD. Revision one is only legal as
-- part of the controlled aggregate construction transition above.
CREATE OR REPLACE FUNCTION enforce_applied_document_revision_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document_head applied_documents%ROWTYPE;
  parent applied_document_revisions%ROWTYPE;
BEGIN
  SELECT * INTO document_head FROM applied_documents WHERE tenant_id = NEW.tenant_id AND id = NEW.document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Applied PDF revision must reference an existing document' USING ERRCODE = '23503'; END IF;
  IF NEW.parent_revision_id IS NULL THEN
    IF NEW.version <> 1 OR current_setting('app.constructing_applied_document', true) <> 'on' OR document_head.current_revision_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only controlled construction may insert revision 1 without a parent' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF document_head.current_revision_id IS NULL OR NEW.parent_revision_id IS DISTINCT FROM document_head.current_revision_id THEN
      RAISE EXCEPTION 'Applied PDF revision must append to the current document HEAD' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO parent FROM applied_document_revisions WHERE tenant_id = NEW.tenant_id AND document_id = NEW.document_id AND id = NEW.parent_revision_id;
    IF NOT FOUND OR NEW.version <> parent.version + 1 THEN
      RAISE EXCEPTION 'Applied PDF revision must increment the current document HEAD version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS applied_document_revisions_chain ON applied_document_revisions;
CREATE TRIGGER applied_document_revisions_chain BEFORE INSERT ON applied_document_revisions FOR EACH ROW EXECUTE FUNCTION enforce_applied_document_revision_chain();

CREATE OR REPLACE FUNCTION prevent_applied_document_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Applied PDF revisions are immutable' USING ERRCODE = '55000'; END; $$;
DROP TRIGGER IF EXISTS applied_document_revisions_append_only ON applied_document_revisions;
CREATE TRIGGER applied_document_revisions_append_only BEFORE UPDATE ON applied_document_revisions FOR EACH ROW EXECUTE FUNCTION prevent_applied_document_revision_mutation();

-- Deleting the aggregate is an administrative purge, not an ordinary document update.
-- Cascade must remove immutable revisions without firing their append-only trigger.
CREATE OR REPLACE FUNCTION allow_applied_document_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.purging_applied_document', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Applied PDF documents may only be deleted through the aggregate purge boundary' USING ERRCODE = '55000';
END; $$;
CREATE OR REPLACE FUNCTION prevent_applied_document_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.purging_applied_document', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Applied PDF revisions are immutable';
END; $$;
DROP TRIGGER IF EXISTS applied_documents_delete_revisions ON applied_documents;
CREATE TRIGGER applied_documents_delete_revisions BEFORE DELETE ON applied_documents FOR EACH ROW EXECUTE FUNCTION allow_applied_document_delete();
DROP TRIGGER IF EXISTS applied_documents_delete_revisions_reset ON applied_documents;
DROP TRIGGER IF EXISTS applied_document_revisions_purge_guard ON applied_document_revisions;
CREATE TRIGGER applied_document_revisions_purge_guard BEFORE DELETE ON applied_document_revisions FOR EACH ROW EXECUTE FUNCTION prevent_applied_document_revision_mutation();
CREATE OR REPLACE FUNCTION reset_applied_document_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.purging_applied_document', 'off', true);
  RETURN OLD;
END; $$;
CREATE TRIGGER applied_documents_delete_revisions_reset AFTER DELETE ON applied_documents FOR EACH ROW EXECUTE FUNCTION reset_applied_document_delete();
