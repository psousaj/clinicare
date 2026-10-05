-- Legacy applied documents may legitimately duplicate a follow-up contract.
-- Keep those rows for audit and enforce one materialized document only for
-- supported (non-legacy) aggregates.
DROP INDEX IF EXISTS applied_documents_tenant_contract_unique;
CREATE UNIQUE INDEX IF NOT EXISTS applied_documents_tenant_contract_unique
  ON applied_documents (tenant_id, followup_contract_id)
  WHERE legacy_unsupported = false;
