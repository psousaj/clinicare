CREATE TABLE saas_plans (
  id text PRIMARY KEY CHECK (id IN ('free', 'standard', 'pro')),
  name text NOT NULL,
  rank integer NOT NULL UNIQUE CHECK (rank BETWEEN 0 AND 2),
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'array'),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((price_cents IS NULL AND billing_interval IS NULL) OR (price_cents IS NOT NULL AND billing_interval IS NOT NULL))
);

CREATE TABLE clinic_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  plan_id text NOT NULL REFERENCES saas_plans(id),
  status text NOT NULL CHECK (status IN ('active', 'paused', 'inactive')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz CHECK (ended_at IS NULL OR ended_at >= started_at),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_tenant_id_id_unique UNIQUE (tenant_id, id);

CREATE UNIQUE INDEX clinic_subscriptions_current_tenant_unique
  ON clinic_subscriptions (tenant_id) WHERE ended_at IS NULL;
CREATE INDEX clinic_subscriptions_tenant_created_idx
  ON clinic_subscriptions (tenant_id, created_at);

CREATE TABLE saas_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  subscription_id uuid NOT NULL,
  actor_user_id text NOT NULL,
  from_plan_id text REFERENCES saas_plans(id),
  to_plan_id text REFERENCES saas_plans(id),
  from_status text CHECK (from_status IS NULL OR from_status IN ('active', 'paused', 'inactive')),
  to_status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_status IN ('active', 'paused', 'inactive'))
);
CREATE INDEX saas_subscription_events_subscription_time_idx
  ON saas_subscription_events (subscription_id, occurred_at);
ALTER TABLE saas_subscription_events
  ADD CONSTRAINT saas_subscription_events_tenant_subscription_fk
  FOREIGN KEY (tenant_id, subscription_id) REFERENCES clinic_subscriptions (tenant_id, id);

INSERT INTO saas_plans (id, name, rank, capabilities)
VALUES
  ('free', 'Free', 0, '["dashboard.upcoming_sessions","dashboard.recent_patients","patients.crud","attendances.single_sessions","appointments.single_sessions","catalog.single_procedures","anamnesis.in_clinic","finance.single_session_payments","contracts.docx_import","documents.historical_read","settings.clinic_account"]'::jsonb),
  ('standard', 'Standard', 1, '["dashboard.upcoming_sessions","dashboard.recent_patients","patients.crud","attendances.single_sessions","appointments.single_sessions","catalog.single_procedures","anamnesis.in_clinic","finance.single_session_payments","contracts.docx_import","documents.historical_read","settings.clinic_account","dashboard.document_tasks","patient.session_photos","patient.custom_fields","followups","appointments.followup_sessions","catalog.combos","catalog.clinical_plans","anamnesis.public_links","contracts.generation","contracts.patient_signatures","finance.followups"]'::jsonb),
  ('pro', 'Pró', 2, '["dashboard.upcoming_sessions","dashboard.recent_patients","patients.crud","attendances.single_sessions","appointments.single_sessions","catalog.single_procedures","anamnesis.in_clinic","finance.single_session_payments","contracts.docx_import","documents.historical_read","settings.clinic_account","dashboard.document_tasks","patient.session_photos","patient.custom_fields","followups","appointments.followup_sessions","catalog.combos","catalog.clinical_plans","anamnesis.public_links","contracts.generation","contracts.patient_signatures","finance.followups","events","patient.relationship_indicators","signatures.govbr"]'::jsonb);
