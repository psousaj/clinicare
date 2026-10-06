DROP INDEX IF EXISTS "patients_tenant_full_name_trgm";
CREATE INDEX IF NOT EXISTS "patients_tenant_full_name_trgm" ON "patients" USING gin ("full_name" public.gin_trgm_ops);
