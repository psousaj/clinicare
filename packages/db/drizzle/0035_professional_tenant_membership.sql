LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
SELECT id, tenant_id, 'admin'
FROM "user"
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_legacy_user_tenant_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
  VALUES (NEW.id, NEW.tenant_id, 'admin')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS user_tenant_memberships_legacy_sync ON "user";
CREATE TRIGGER user_tenant_memberships_legacy_sync
AFTER INSERT OR UPDATE OF tenant_id ON "user"
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_user_tenant_membership();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM professionals p
    WHERE NOT EXISTS (
      SELECT 1 FROM user_tenant_memberships m
      WHERE m.user_id = p.user_id AND m.tenant_id = p.tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'Professional tenant membership reconciliation is required before migration 0035.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'professionals'::regclass
      AND conname = 'professionals_tenant_user_unique'
  ) THEN
    ALTER TABLE professionals
      ADD CONSTRAINT professionals_tenant_user_unique UNIQUE (tenant_id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'professionals'::regclass
      AND conname = 'professionals_user_tenant_membership_fk'
  ) THEN
    ALTER TABLE professionals
      ADD CONSTRAINT professionals_user_tenant_membership_fk
      FOREIGN KEY (user_id, tenant_id)
      REFERENCES user_tenant_memberships (user_id, tenant_id);
  END IF;
END
$$;
