import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Tables owned by the PostgreSQL persistence layer.
 *
 * Domain tables are intentionally added incrementally. Every tenant-owned table
 * introduced after this foundation must carry a tenant_id and use tenant-scoped
 * foreign keys where applicable.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [check('tenants_name_not_empty', sql`length(trim(${table.name})) > 0`)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export const tenantDefaults = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Clínicare',
} as const;

