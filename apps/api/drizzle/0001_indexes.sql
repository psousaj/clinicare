CREATE INDEX IF NOT EXISTS anamnesis_versions_latest_idx ON anamnesis_versions(anamnesis_id, version DESC);
CREATE INDEX IF NOT EXISTS plans_patient_created_idx ON plans(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_range_idx ON appointments(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS sessions_plan_item_idx ON sessions(plan_item_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS payments_plan_received_idx ON payments(plan_id, received_at DESC);
CREATE INDEX IF NOT EXISTS patient_anamneses_patient_idx ON patient_anamneses(patient_id);
