import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  fullName: text('full_name').notNull(),
  emailCiphertext: text('email_ciphertext'),
  emailNonce: text('email_nonce'),
  emailSearchHash: text('email_search_hash'),
  emailSearchKeyVersion: integer('email_search_key_version'),
  emailKeyVersion: integer('email_key_version'),
  phoneCiphertext: text('phone_ciphertext'),
  phoneNonce: text('phone_nonce'),
  phoneSearchHash: text('phone_search_hash'),
  phoneSearchKeyVersion: integer('phone_search_key_version'),
  phoneKeyVersion: integer('phone_key_version'),
  cpfCiphertext: text('cpf_ciphertext'),
  cpfNonce: text('cpf_nonce'),
  cpfSearchHash: text('cpf_search_hash'),
  cpfSearchKeyVersion: integer('cpf_search_key_version'),
  cpfKeyVersion: integer('cpf_key_version'),
  notesCiphertext: text('notes_ciphertext'),
  notesNonce: text('notes_nonce'),
  notesKeyVersion: integer('notes_key_version'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('patients_tenant_full_name_trgm').using('gin', table.fullName),
  index('patients_tenant_id_idx').on(table.tenantId),
  uniqueIndex('patients_active_email_unique').on(table.tenantId, table.emailSearchHash).where(sql`${table.deletedAt} is null`),
  uniqueIndex('patients_active_phone_unique').on(table.tenantId, table.phoneSearchHash).where(sql`${table.deletedAt} is null`),
  uniqueIndex('patients_active_cpf_unique').on(table.tenantId, table.cpfSearchHash).where(sql`${table.deletedAt} is null`),
  check('patients_full_name_not_empty', sql`length(trim(${table.fullName})) >= 2`),
]);

export type RelationalPatient = typeof patients.$inferSelect;
export type NewRelationalPatient = typeof patients.$inferInsert;

/** Relational seam for work that must block patient deactivation. Domain follow-ups can adopt it incrementally. */
export const patientPendingOperations = pgTable('patient_pending_operations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  kind: text('kind').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('patient_pending_operations_patient_idx').on(table.tenantId, table.patientId),
  check('patient_pending_operations_kind_not_empty', sql`length(trim(${table.kind})) > 0`),
]);

export type PatientPendingOperation = typeof patientPendingOperations.$inferSelect;

export const tenantDefaults = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Clínicare',
} as const;

