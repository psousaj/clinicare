ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_reason text;

UPDATE appointments SET no_show_reason = 'Motivo não informado (registro anterior)'
WHERE status = 'no_show' AND no_show_reason IS NULL;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_show_reason_valid CHECK (
  (status = 'no_show' AND no_show_reason IS NOT NULL AND length(trim(no_show_reason)) > 0)
  OR (status <> 'no_show' AND no_show_reason IS NULL)
);
