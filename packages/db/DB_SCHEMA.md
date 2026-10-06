# Database schema isolation

Set `DB_SCHEMA` to the intended PostgreSQL application schema before connecting or running migrations. The value must be a valid unquoted PostgreSQL identifier of at most 63 bytes. A missing or invalid value fails fast.

Connections use only `search_path="DB_SCHEMA"`, with no `public` fallback. The migration ledger (`__drizzle_migrations`) lives in the same schema, and Drizzle Kit generation filters to that schema.

The `pg_trgm` extension is the sole shared database-level exception: migrations keep its operator class in `public` and qualify it explicitly. If an existing installation has `pg_trgm` in another schema, the migration moves it only when the migration user owns the extension; otherwise move it to `public` explicitly during database provisioning.

On a shared database, use only the project's schema. Do not run migrations against unrelated application schemas. If migrating an existing installation, reconcile its migration ledger with the target schema before starting migrations; do not restart historical migrations against populated tables.
