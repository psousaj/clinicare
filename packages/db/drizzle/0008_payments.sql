-- Payment records are append-only. This migration is safe to run against a fresh
-- database and against databases that already contain the transitional payment table.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes_nonce text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes_key_version integer;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_notes_protected;
ALTER TABLE payments ADD CONSTRAINT payments_notes_protected CHECK (
  (notes_ciphertext IS NULL AND notes_nonce IS NULL AND notes_key_version IS NULL)
  OR (notes_ciphertext IS NOT NULL AND notes_nonce IS NOT NULL AND notes_key_version IS NOT NULL)
);
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_deleted_reason_valid;
ALTER TABLE payments ADD CONSTRAINT payments_deleted_reason_valid CHECK (
  (deleted_at IS NULL AND deletion_reason IS NULL)
  OR (deleted_at IS NOT NULL AND deletion_reason IS NOT NULL AND length(trim(deletion_reason)) > 0)
);

-- The old index scoped idempotency to a followup. The new contract is one key
-- per tenant. Existing collisions are retained as rows: the oldest row (created_at,
-- then id) keeps the key and later duplicates are deliberately made retry-less.
-- This makes the migration deterministic without deleting or rewriting payments.
DROP INDEX IF EXISTS payments_idempotency_unique;
WITH duplicates AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id, idempotency_key
           ORDER BY created_at ASC, id ASC
         ) AS duplicate_number
  FROM payments
  WHERE idempotency_key IS NOT NULL
)
UPDATE payments
SET idempotency_key = NULL
WHERE id IN (SELECT id FROM duplicates WHERE duplicate_number > 1);
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_unique
  ON payments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_followup_received_idx
  ON payments (tenant_id, followup_id, received_at);

-- Payment facts cannot be amended in place. Soft deletion is the sole supported
-- update and is represented by deleted_at/deletion_reason; corrections and refunds
-- must be appended as new payments and linked through payment_relations.
CREATE OR REPLACE FUNCTION prevent_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
    OR OLD.followup_id IS DISTINCT FROM NEW.followup_id
    OR OLD.amount_cents IS DISTINCT FROM NEW.amount_cents
    OR OLD.method IS DISTINCT FROM NEW.method
    OR OLD.installments IS DISTINCT FROM NEW.installments
    OR OLD.received_at IS DISTINCT FROM NEW.received_at
    OR OLD.notes_ciphertext IS DISTINCT FROM NEW.notes_ciphertext
    OR OLD.notes_nonce IS DISTINCT FROM NEW.notes_nonce
    OR OLD.notes_key_version IS DISTINCT FROM NEW.notes_key_version
    OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'Payment records are immutable; only deleted_at and deletion_reason may change.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payments_immutable_update ON payments;
CREATE TRIGGER payments_immutable_update
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_payment_mutation();

COMMENT ON TABLE payments IS 'Append-only payment facts; only soft-deletion fields may be updated.';
COMMENT ON COLUMN payments.idempotency_key IS 'One key per tenant; migration 0008 nulls later legacy collisions in created_at,id order.';
COMMENT ON COLUMN payments.deleted_at IS 'Soft-deletion timestamp; the only mutable payment fact field alongside deletion_reason.';
COMMENT ON COLUMN payments.deletion_reason IS 'Required reason for soft deletion; the only mutable payment fact field alongside deleted_at.';

CREATE TABLE IF NOT EXISTS payment_relations (
  tenant_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  related_payment_id uuid NOT NULL,
  relation_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, payment_id, related_payment_id, relation_type),
  CONSTRAINT payment_relations_payment_fk FOREIGN KEY (tenant_id, payment_id) REFERENCES payments (tenant_id, id),
  CONSTRAINT payment_relations_related_payment_fk FOREIGN KEY (tenant_id, related_payment_id) REFERENCES payments (tenant_id, id),
  CONSTRAINT payment_relations_type_valid CHECK (relation_type IN ('adjustment', 'refund')),
  CONSTRAINT payment_relations_distinct CHECK (payment_id <> related_payment_id)
);
COMMENT ON TABLE payment_relations IS 'Links appended correction and refund payments without mutating the source payment.';
CREATE INDEX IF NOT EXISTS payment_relations_payment_idx ON payment_relations (tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS payment_relations_related_payment_idx ON payment_relations (tenant_id, related_payment_id);
