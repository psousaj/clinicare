-- ADR-0005 follow-up: migration 0023 replaced the legacy content/source check with
-- contract_versions_content_or_object (which also accepts source_docx_object_key),
-- but the legacy auto-named CHECK was never dropped, blocking every DOCX publish
-- with 23514. Drop it; the named replacement remains enforced.
ALTER TABLE contract_versions DROP CONSTRAINT IF EXISTS contract_versions_check;
