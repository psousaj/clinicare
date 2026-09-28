CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_sessions integer NOT NULL DEFAULT 1 CHECK (base_sessions > 0),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  session_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
  active integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patients_full_name_idx ON patients (lower(full_name));
CREATE INDEX IF NOT EXISTS procedures_active_idx ON procedures (active, name);
