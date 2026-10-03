-- Scheduling and attendance are relational data. Keep this migration safe for both
-- fresh databases and databases which received the first (index-only) draft.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'followup_items_tenant_followup_id_unique'
      AND conrelid = 'followup_items'::regclass
  ) THEN
    ALTER TABLE followup_items
      ADD CONSTRAINT followup_items_tenant_followup_id_unique UNIQUE (tenant_id, followup_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  notes_ciphertext text,
  notes_nonce text,
  notes_key_version integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT appointments_tenant_patient_fk FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id),
  CONSTRAINT appointments_interval_valid CHECK (ends_at > starts_at),
  CONSTRAINT appointments_status_valid CHECK (status IN ('planned','confirmed','rescheduled','cancelled','no_show')),
  CONSTRAINT appointments_notes_protected CHECK ((notes_ciphertext IS NULL AND notes_nonce IS NULL AND notes_key_version IS NULL) OR (notes_ciphertext IS NOT NULL AND notes_nonce IS NOT NULL AND notes_key_version IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS appointments_tenant_status_starts_idx ON appointments(tenant_id, status, starts_at);

CREATE TABLE IF NOT EXISTS appointment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  followup_id uuid,
  followup_item_id uuid,
  procedure_id uuid NOT NULL,
  procedure_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  minutes_each integer NOT NULL,
  confirmation_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_items_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT appointment_items_tenant_appointment_fk FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointments(tenant_id, id),
  CONSTRAINT appointment_items_tenant_followup_fk FOREIGN KEY (tenant_id, followup_id) REFERENCES followups(tenant_id, id),
  CONSTRAINT appointment_items_tenant_followup_item_pair_fk FOREIGN KEY (tenant_id, followup_id, followup_item_id) REFERENCES followup_items(tenant_id, followup_id, id),
  CONSTRAINT appointment_items_tenant_procedure_fk FOREIGN KEY (tenant_id, procedure_id) REFERENCES procedures(tenant_id, id),
  CONSTRAINT appointment_items_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT appointment_items_minutes_positive CHECK (minutes_each >= 1),
  CONSTRAINT appointment_items_confirmation_valid CHECK (confirmation_status IN ('pending','selected','confirmed','deselected','cancelled')),
  CONSTRAINT appointment_items_followup_pair_valid CHECK ((followup_id IS NULL AND followup_item_id IS NULL) OR (followup_id IS NOT NULL AND followup_item_id IS NOT NULL))
);
-- The draft migration accidentally made this a reservation uniqueness constraint. A
-- follow-up item may be reserved by many appointments while capacity remains.
ALTER TABLE appointment_items DROP CONSTRAINT IF EXISTS appointment_items_tenant_followup_item_unique;
CREATE INDEX IF NOT EXISTS appointment_items_followup_idx ON appointment_items(tenant_id, followup_item_id);

CREATE TABLE IF NOT EXISTS attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  followup_id uuid,
  followup_item_id uuid,
  appointment_id uuid,
  procedure_id uuid NOT NULL,
  procedure_name text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  data_ciphertext text,
  data_nonce text,
  data_key_version integer,
  schema_snapshot jsonb NOT NULL,
  notes_ciphertext text,
  notes_nonce text,
  notes_key_version integer,
  status text NOT NULL DEFAULT 'performed',
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendances_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT attendances_tenant_patient_fk FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id),
  CONSTRAINT attendances_tenant_followup_patient_fk FOREIGN KEY (tenant_id, followup_id, patient_id) REFERENCES followups(tenant_id, id, patient_id),
  CONSTRAINT attendances_tenant_followup_item_pair_fk FOREIGN KEY (tenant_id, followup_id, followup_item_id) REFERENCES followup_items(tenant_id, followup_id, id),
  CONSTRAINT attendances_tenant_appointment_fk FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointments(tenant_id, id),
  CONSTRAINT attendances_duration_valid CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT attendances_status_valid CHECK (status IN ('performed','cancelled')),
  CONSTRAINT attendances_cancel_state_valid CHECK ((status = 'cancelled' AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0) OR (status = 'performed' AND cancellation_reason IS NULL)),
  CONSTRAINT attendances_data_protected CHECK ((data_ciphertext IS NULL AND data_nonce IS NULL AND data_key_version IS NULL) OR (data_ciphertext IS NOT NULL AND data_nonce IS NOT NULL AND data_key_version IS NOT NULL)),
  CONSTRAINT attendances_notes_protected CHECK ((notes_ciphertext IS NULL AND notes_nonce IS NULL AND notes_key_version IS NULL) OR (notes_ciphertext IS NOT NULL AND notes_nonce IS NOT NULL AND notes_key_version IS NOT NULL))
);
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_tenant_followup_item_unique;
CREATE INDEX IF NOT EXISTS attendances_followup_item_idx ON attendances(tenant_id, followup_item_id, status);
CREATE INDEX IF NOT EXISTS attendances_patient_idx ON attendances(tenant_id, patient_id, performed_at);

CREATE TABLE IF NOT EXISTS attendance_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  attendance_id uuid NOT NULL,
  object_key text NOT NULL,
  content_hash text,
  phase text NOT NULL,
  notes_ciphertext text,
  notes_nonce text,
  notes_key_version integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_photos_tenant_attendance_fk FOREIGN KEY (tenant_id, attendance_id) REFERENCES attendances(tenant_id, id),
  CONSTRAINT attendance_photos_phase_valid CHECK (phase IN ('before','during','after'))
);
CREATE INDEX IF NOT EXISTS attendance_photos_attendance_idx ON attendance_photos(tenant_id, attendance_id, created_at);
