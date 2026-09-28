import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const procedures = pgTable('procedures', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  baseSessions: integer('base_sessions').default(1).notNull(),
  durationMinutes: integer('duration_minutes'),
  priceCents: integer('price_cents').default(0).notNull(),
  sessionSchema: jsonb('session_schema').$type<Record<string, unknown>>().default({ type: 'object', properties: {} }).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const anamneses = pgTable('anamneses', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const anamnesisVersions = pgTable('anamnesis_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  anamnesisId: uuid('anamnesis_id').references(() => anamneses.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  schema: jsonb('schema').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const procedureAnamneses = pgTable('procedure_anamneses', {
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'cascade' }).notNull(),
  anamnesisId: uuid('anamnesis_id').references(() => anamneses.id, { onDelete: 'cascade' }).notNull(),
  required: boolean('required').default(true).notNull(),
});

export const packages = pgTable('packages', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  promotionalPriceCents: integer('promotional_price_cents'),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const packageItems = pgTable('package_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  packageId: uuid('package_id').references(() => packages.id, { onDelete: 'cascade' }).notNull(),
  procedureId: uuid('procedure_id').references(() => procedures.id).notNull(),
  sessionsOverride: integer('sessions_override'),
  priceOverrideCents: integer('price_override_cents'),
});

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'cascade' }),
  packageId: uuid('package_id').references(() => packages.id, { onDelete: 'cascade' }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contractVersions = pgTable('contract_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  sourceObjectKey: text('source_object_key'),
  content: text('content'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  offerType: text('offer_type').notNull(),
  offerId: uuid('offer_id').notNull(),
  offerName: text('offer_name').notNull(),
  priceCents: integer('price_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const planItems = pgTable('plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  procedureId: uuid('procedure_id').references(() => procedures.id),
  procedureName: text('procedure_name').notNull(),
  sessionsTotal: integer('sessions_total').notNull(),
  sessionSchema: jsonb('session_schema').$type<Record<string, unknown>>().notNull(),
  priceCents: integer('price_cents').notNull(),
});

export const appliedContracts = pgTable('applied_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  contractVersionId: uuid('contract_version_id').references(() => contractVersions.id),
  title: text('title').notNull(),
  objectKey: text('object_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  method: text('method').notNull(),
  installments: integer('installments').default(1).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
});

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: text('status').default('planned').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const appointmentItems = pgTable('appointment_items', {
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }).notNull(),
  planItemId: uuid('plan_item_id').references(() => planItems.id).notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  planItemId: uuid('plan_item_id').references(() => planItems.id).notNull(),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  schemaSnapshot: jsonb('schema_snapshot').$type<Record<string, unknown>>().notNull(),
  notes: text('notes'),
});

export const sessionPhotos = pgTable('session_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  objectKey: text('object_key').notNull(),
  phase: text('phase').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientAnamneses = pgTable('patient_anamneses', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }),
  anamnesisId: uuid('anamnesis_id').references(() => anamneses.id).notNull(),
  versionId: uuid('version_id').references(() => anamnesisVersions.id).notNull(),
  required: boolean('required').default(true).notNull(),
});

export const anamnesisRequests = pgTable('anamnesis_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientAnamnesisId: uuid('patient_anamnesis_id').references(() => patientAnamneses.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  draft: jsonb('draft').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const anamnesisResponses = pgTable('anamnesis_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientAnamnesisId: uuid('patient_anamnesis_id').references(() => patientAnamneses.id, { onDelete: 'cascade' }).notNull(),
  answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
});

export const responseNotes = pgTable('response_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  responseId: uuid('response_id').references(() => anamnesisResponses.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
