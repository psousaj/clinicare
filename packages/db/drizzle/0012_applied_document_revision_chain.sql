-- Task #22: enforce a single append-only branch at the database boundary.
CREATE UNIQUE INDEX IF NOT EXISTS applied_document_revisions_parent_unique
  ON applied_document_revisions (tenant_id, document_id, parent_revision_id)
  WHERE parent_revision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_applied_document_revision_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document_head applied_documents%ROWTYPE;
  parent applied_document_revisions%ROWTYPE;
BEGIN
  SELECT * INTO document_head
    FROM applied_documents
   WHERE tenant_id = NEW.tenant_id AND id = NEW.document_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Applied PDF revision must reference an existing document' USING ERRCODE = '23503';
  END IF;

  IF NEW.parent_revision_id IS NULL THEN
    IF NEW.version <> 1
       OR current_setting('app.constructing_applied_document', true) <> 'on'
       OR document_head.current_revision_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only controlled construction may insert revision 1 without a parent' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF document_head.current_revision_id IS NULL
       OR NEW.parent_revision_id IS DISTINCT FROM document_head.current_revision_id THEN
      RAISE EXCEPTION 'Applied PDF revision must append to the current document HEAD' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO parent
      FROM applied_document_revisions
     WHERE tenant_id = NEW.tenant_id
       AND document_id = NEW.document_id
       AND id = NEW.parent_revision_id;
    IF NOT FOUND OR NEW.version <> parent.version + 1 THEN
      RAISE EXCEPTION 'Applied PDF revision must increment the current document HEAD version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS applied_document_revisions_chain ON applied_document_revisions;
CREATE TRIGGER applied_document_revisions_chain
  BEFORE INSERT ON applied_document_revisions
  FOR EACH ROW EXECUTE FUNCTION enforce_applied_document_revision_chain();
