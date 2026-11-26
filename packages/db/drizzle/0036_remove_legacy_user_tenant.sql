DROP TRIGGER IF EXISTS user_tenant_memberships_legacy_sync ON "user";
DROP FUNCTION IF EXISTS sync_legacy_user_tenant_membership();

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_tenant_id_fkey;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_tenant_id_unique;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_tenant_id_key;
DROP INDEX IF EXISTS user_tenant_id_idx;
ALTER TABLE "user" DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_user_id_fkey;
ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_user_id_unique;
ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_user_id_key;

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
    RAISE EXCEPTION 'Professional membership validation failed; refusing legacy association removal.';
  END IF;
END
$$;
