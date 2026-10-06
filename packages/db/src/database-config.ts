/**
 * PostgreSQL identifiers cannot be passed as query parameters. Keep the value
 * constrained before using it in a connection option or migration config.
 */
export function getDatabaseSchema(): string {
  const schema = process.env.DB_SCHEMA?.trim()
  if (!schema) throw new Error('DB_SCHEMA is required for PostgreSQL schema isolation.')

  if (schema.length > 63 || !/^[a-z_][a-z0-9_$]*$/i.test(schema)) {
    throw new Error('DB_SCHEMA must be a valid PostgreSQL identifier of at most 63 bytes.')
  }

  return schema
}

export function getMigrationsSchema(): string {
  return getDatabaseSchema()
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

/**
 * Restrict database object resolution to the explicitly configured schema.
 */
export function getSearchPathOption(): string {
  const schema = getDatabaseSchema()
  return `-c search_path=${quoteIdentifier(schema)}`
}

export function getSchemaFilter(): string[] {
  const schema = getDatabaseSchema()
  return [schema]
}
