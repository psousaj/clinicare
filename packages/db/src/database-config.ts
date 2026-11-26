export const CANONICAL_DATABASE_SCHEMA = 'clinicare';

/**
 * Quote an identifier returned by PostgreSQL schema discovery before using it
 * in SQL statements.
 */
export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
