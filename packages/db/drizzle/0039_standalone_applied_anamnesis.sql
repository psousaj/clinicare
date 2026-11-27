ALTER TABLE applied_anamneses
  ALTER COLUMN followup_id DROP NOT NULL,
  ADD COLUMN procedure_id uuid;

ALTER TABLE applied_anamneses
  ADD CONSTRAINT applied_anamneses_tenant_procedure_fk
    FOREIGN KEY (tenant_id, procedure_id) REFERENCES procedures (tenant_id, id),
  ADD CONSTRAINT applied_anamneses_owner_valid
    CHECK ((followup_id IS NOT NULL AND procedure_id IS NULL)
      OR (followup_id IS NULL AND procedure_id IS NOT NULL));
