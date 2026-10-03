import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, foreignKey } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [check('tenants_name_not_empty', sql`length(trim(${t.name})) > 0`), unique('tenants_id_unique').on(t.id)]);

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull().references(() => tenants.id), fullName: text('full_name').notNull(),
  emailCiphertext: text('email_ciphertext'), emailNonce: text('email_nonce'), emailSearchHash: text('email_search_hash'), emailSearchKeyVersion: integer('email_search_key_version'), emailKeyVersion: integer('email_key_version'),
  phoneCiphertext: text('phone_ciphertext'), phoneNonce: text('phone_nonce'), phoneSearchHash: text('phone_search_hash'), phoneSearchKeyVersion: integer('phone_search_key_version'), phoneKeyVersion: integer('phone_key_version'),
  cpfCiphertext: text('cpf_ciphertext'), cpfNonce: text('cpf_nonce'), cpfSearchHash: text('cpf_search_hash'), cpfSearchKeyVersion: integer('cpf_search_key_version'), cpfKeyVersion: integer('cpf_key_version'),
  notesCiphertext: text('notes_ciphertext'), notesNonce: text('notes_nonce'), notesKeyVersion: integer('notes_key_version'), deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [unique('patients_tenant_id_unique').on(t.tenantId, t.id), index('patients_tenant_full_name_trgm').using('gin', t.fullName), index('patients_tenant_id_idx').on(t.tenantId), uniqueIndex('patients_active_email_unique').on(t.tenantId, t.emailSearchHash).where(sql`${t.deletedAt} is null`), uniqueIndex('patients_active_phone_unique').on(t.tenantId, t.phoneSearchHash).where(sql`${t.deletedAt} is null`), uniqueIndex('patients_active_cpf_unique').on(t.tenantId, t.cpfSearchHash).where(sql`${t.deletedAt} is null`), check('patients_full_name_not_empty', sql`length(trim(${t.fullName})) >= 2`)]);

export const patientPendingOperations = pgTable('patient_pending_operations', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull().references(() => tenants.id), patientId: uuid('patient_id').notNull(), kind: text('kind').notNull(), resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.patientId], foreignColumns: [patients.tenantId, patients.id], name: 'patient_pending_operations_tenant_patient_fk' }), index('patient_pending_operations_patient_idx').on(t.tenantId, t.patientId), check('patient_pending_operations_kind_not_empty', sql`length(trim(${t.kind})) > 0`)]);

const catalogTimestamps = { createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow() };

export const procedures = pgTable('procedures', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), name: text('name').notNull(), description: text('description'), baseSessions: integer('base_sessions'), durationMinutes: integer('duration_minutes').notNull().default(60), standalone: boolean('standalone').notNull().default(true), priceCents: integer('price_cents').notNull().default(0), sessionSchema: jsonb('session_schema').notNull(), active: boolean('active').notNull().default(true), requireNewAnamnesis: boolean('require_new_anamnesis').notNull().default(false), currentVersion: integer('current_version').notNull().default(1), ...catalogTimestamps,
}, (t) => [foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'procedures_tenant_fk' }), unique('procedures_tenant_id_unique').on(t.tenantId, t.id), index('procedures_tenant_active_idx').on(t.tenantId, t.active), check('procedures_name_not_empty', sql`length(trim(${t.name})) >= 2`), check('procedures_duration_positive', sql`${t.durationMinutes} between 1 and 1440`), check('procedures_price_nonnegative', sql`${t.priceCents} >= 0`), check('procedures_base_sessions_positive', sql`${t.baseSessions} is null or ${t.baseSessions} >= 1`)]);

export const procedureVersions = pgTable('procedure_versions', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), procedureId: uuid('procedure_id').notNull(), version: integer('version').notNull(), sessionSchema: jsonb('session_schema').notNull(), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'procedure_versions_tenant_procedure_fk' }), unique('procedure_versions_tenant_procedure_version_unique').on(t.tenantId, t.procedureId, t.version), index('procedure_versions_lookup_idx').on(t.tenantId, t.procedureId)]);

export const anamneses = pgTable('anamneses', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), title: text('title').notNull(), active: boolean('active').notNull().default(true), requiredByDefault: boolean('required_by_default').notNull().default(true), validityMonths: integer('validity_months').notNull().default(12), currentVersion: integer('current_version').notNull().default(1), ...catalogTimestamps,
}, (t) => [foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'anamneses_tenant_fk' }), unique('anamneses_tenant_id_unique').on(t.tenantId, t.id), check('anamneses_title_not_empty', sql`length(trim(${t.title})) >= 2`), check('anamneses_validity_positive', sql`${t.validityMonths} >= 1`)]);

export const anamnesisVersions = pgTable('anamnesis_versions', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), anamnesisId: uuid('anamnesis_id').notNull(), version: integer('version').notNull(), schema: jsonb('schema').notNull(), origin: text('origin').notNull().default('created'), restoredFromVersion: integer('restored_from_version'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.anamnesisId], foreignColumns: [anamneses.tenantId, anamneses.id], name: 'anamnesis_versions_tenant_anamnesis_fk' }), unique('anamnesis_versions_tenant_parent_version_unique').on(t.tenantId, t.anamnesisId, t.version), check('anamnesis_versions_origin_valid', sql`${t.origin} in ('created', 'edited', 'restored')`), check('anamnesis_versions_restore_valid', sql`${t.origin} <> 'restored' or ${t.restoredFromVersion} is not null`)]);

export const anamnesisProcedures = pgTable('anamnesis_procedures', {
  tenantId: uuid('tenant_id').notNull(), anamnesisId: uuid('anamnesis_id').notNull(), procedureId: uuid('procedure_id').notNull(), required: boolean('required').notNull().default(true),
}, (t) => [primaryKey({ columns: [t.tenantId, t.anamnesisId, t.procedureId] }), foreignKey({ columns: [t.tenantId, t.anamnesisId], foreignColumns: [anamneses.tenantId, anamneses.id], name: 'anamnesis_procedures_tenant_anamnesis_fk' }), foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'anamnesis_procedures_tenant_procedure_fk' })]);

export const combos = pgTable('combos', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), name: text('name').notNull(), description: text('description'), priceCents: integer('price_cents').notNull(), promotionalPriceCents: integer('promotional_price_cents'), validFrom: timestamp('valid_from', { withTimezone: true, mode: 'date' }), validUntil: timestamp('valid_until', { withTimezone: true, mode: 'date' }), active: boolean('active').notNull().default(true), requireNewAnamnesis: boolean('require_new_anamnesis').notNull().default(false), ...catalogTimestamps,
}, (t) => [foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'combos_tenant_fk' }), unique('combos_tenant_id_unique').on(t.tenantId, t.id), check('combos_name_not_empty', sql`length(trim(${t.name})) >= 2`), check('combos_prices_valid', sql`${t.priceCents} >= 0 and (${t.promotionalPriceCents} is null or (${t.promotionalPriceCents} >= 0 and ${t.promotionalPriceCents} <= ${t.priceCents}))`), check('combos_validity_order', sql`${t.validUntil} is null or ${t.validFrom} is null or ${t.validUntil} >= ${t.validFrom}`)]);

export const comboItems = pgTable('combo_items', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), comboId: uuid('combo_id').notNull(), procedureId: uuid('procedure_id').notNull(), sessions: integer('sessions').notNull(), priceOverrideCents: integer('price_override_cents'),
}, (t) => [foreignKey({ columns: [t.tenantId, t.comboId], foreignColumns: [combos.tenantId, combos.id], name: 'combo_items_tenant_combo_fk' }), foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'combo_items_tenant_procedure_fk' }), unique('combo_items_tenant_combo_procedure_unique').on(t.tenantId, t.comboId, t.procedureId), check('combo_items_sessions_positive', sql`${t.sessions} >= 1`), check('combo_items_price_nonnegative', sql`${t.priceOverrideCents} is null or ${t.priceOverrideCents} >= 0`)]);

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), title: text('title').notNull(), kind: text('kind').notNull(), procedureId: uuid('procedure_id'), comboId: uuid('combo_id'), active: boolean('active').notNull().default(true), currentVersion: integer('current_version').notNull().default(1), ...catalogTimestamps,
}, (t) => [foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'contracts_tenant_fk' }), foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'contracts_tenant_procedure_fk' }), foreignKey({ columns: [t.tenantId, t.comboId], foreignColumns: [combos.tenantId, combos.id], name: 'contracts_tenant_combo_fk' }), unique('contracts_tenant_id_unique').on(t.tenantId, t.id), check('contracts_kind_valid', sql`${t.kind} in ('standard', 'procedure', 'combo')`), check('contracts_target_valid', sql`(${t.kind} = 'standard' and ${t.procedureId} is null and ${t.comboId} is null) or (${t.kind} = 'procedure' and ${t.procedureId} is not null and ${t.comboId} is null) or (${t.kind} = 'combo' and ${t.comboId} is not null and ${t.procedureId} is null)`)]);

export const contractVersions = pgTable('contract_versions', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), contractId: uuid('contract_id').notNull(), version: integer('version').notNull(), content: text('content'), sourceObjectKey: text('source_object_key'), origin: text('origin').notNull().default('created'), restoredFromVersion: integer('restored_from_version'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.contractId], foreignColumns: [contracts.tenantId, contracts.id], name: 'contract_versions_tenant_contract_fk' }), unique('contract_versions_tenant_parent_version_unique').on(t.tenantId, t.contractId, t.version), check('contract_versions_origin_valid', sql`${t.origin} in ('created', 'edited', 'restored')`), check('contract_versions_content_or_object', sql`${t.content} is not null or ${t.sourceObjectKey} is not null`)]);

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), name: text('name').notNull(), description: text('description'), active: boolean('active').notNull().default(true), currentVersion: integer('current_version').notNull().default(1), ...catalogTimestamps,
}, (t) => [foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'plans_tenant_fk' }), unique('plans_tenant_id_unique').on(t.tenantId, t.id), check('plans_name_not_empty', sql`length(trim(${t.name})) >= 2`)]);

export const planVersions = pgTable('plan_versions', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), planId: uuid('plan_id').notNull(), version: integer('version').notNull(), priceCents: integer('price_cents').notNull(), durationDays: integer('duration_days'), validityDays: integer('validity_days'), requireNewAnamnesis: boolean('require_new_anamnesis').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.planId], foreignColumns: [plans.tenantId, plans.id], name: 'plan_versions_tenant_plan_fk' }), unique('plan_versions_tenant_id_unique').on(t.tenantId, t.id), unique('plan_versions_tenant_plan_id_unique').on(t.tenantId, t.planId, t.id), unique('plan_versions_tenant_parent_version_unique').on(t.tenantId, t.planId, t.version), check('plan_versions_price_nonnegative', sql`${t.priceCents} >= 0`), check('plan_versions_duration_positive', sql`${t.durationDays} is null or ${t.durationDays} >= 1`), check('plan_versions_validity_positive', sql`${t.validityDays} is null or ${t.validityDays} >= 1`)]);

export const planVersionItems = pgTable('plan_version_items', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), planVersionId: uuid('plan_version_id').notNull(), procedureId: uuid('procedure_id').notNull(), sessions: integer('sessions').notNull(), procedureName: text('procedure_name').notNull(), durationMinutes: integer('duration_minutes').notNull(), priceCents: integer('price_cents').notNull(), sessionSchema: jsonb('session_schema').notNull(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.planVersionId], foreignColumns: [planVersions.tenantId, planVersions.id], name: 'plan_version_items_tenant_version_fk' }), foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'plan_version_items_tenant_procedure_fk' }), check('plan_version_items_sessions_positive', sql`${t.sessions} >= 1`), check('plan_version_items_duration_positive', sql`${t.durationMinutes} >= 1`), check('plan_version_items_price_nonnegative', sql`${t.priceCents} >= 0`)]);

export const planVersionContracts = pgTable('plan_version_contracts', {
  tenantId: uuid('tenant_id').notNull(), planVersionId: uuid('plan_version_id').notNull(), contractId: uuid('contract_id').notNull(), contractVersion: integer('contract_version').notNull(), title: text('title').notNull(), sourceObjectKey: text('source_object_key'),
}, (t) => [primaryKey({ columns: [t.tenantId, t.planVersionId, t.contractId] }), foreignKey({ columns: [t.tenantId, t.planVersionId], foreignColumns: [planVersions.tenantId, planVersions.id], name: 'plan_version_contracts_tenant_version_fk' }), foreignKey({ columns: [t.tenantId, t.contractId], foreignColumns: [contracts.tenantId, contracts.id], name: 'plan_version_contracts_tenant_contract_fk' }), foreignKey({ columns: [t.tenantId, t.contractId, t.contractVersion], foreignColumns: [contractVersions.tenantId, contractVersions.contractId, contractVersions.version], name: 'plan_version_contracts_tenant_contract_version_fk' }), check('plan_version_contracts_version_positive', sql`${t.contractVersion} >= 1`)]);

export const tenantDefaults = { id: '00000000-0000-0000-0000-000000000001', name: 'Clínicare' } as const;
export type Tenant = typeof tenants.$inferSelect; export type NewTenant = typeof tenants.$inferInsert;
export type RelationalPatient = typeof patients.$inferSelect; export type NewRelationalPatient = typeof patients.$inferInsert;
export type RelationalProcedure = typeof procedures.$inferSelect; export type NewRelationalProcedure = typeof procedures.$inferInsert;
export type RelationalProcedureVersion = typeof procedureVersions.$inferSelect;
export type RelationalAnamnesis = typeof anamneses.$inferSelect; export type RelationalAnamnesisVersion = typeof anamnesisVersions.$inferSelect;
export type RelationalCombo = typeof combos.$inferSelect; export type RelationalComboItem = typeof comboItems.$inferSelect;
export type RelationalContract = typeof contracts.$inferSelect; export type RelationalContractVersion = typeof contractVersions.$inferSelect;
export const followups = pgTable('followups', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  offerType: text('offer_type').notNull(),
  offerId: uuid('offer_id').notNull(),
  comboId: uuid('combo_id'),
  planId: uuid('plan_id'),
  planVersionId: uuid('plan_version_id'),
  status: text('status').notNull().default('active'),
  offerNameSnapshot: text('offer_name_snapshot').notNull(),
  priceCents: integer('price_cents').notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true, mode: 'date' }),
  cancellationReason: text('cancellation_reason'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.tenantId, t.patientId], foreignColumns: [patients.tenantId, patients.id], name: 'followups_tenant_patient_fk' }),
  foreignKey({ columns: [t.tenantId, t.comboId], foreignColumns: [combos.tenantId, combos.id], name: 'followups_tenant_combo_fk' }),
  foreignKey({ columns: [t.tenantId, t.planId], foreignColumns: [plans.tenantId, plans.id], name: 'followups_tenant_plan_fk' }),
  foreignKey({ columns: [t.tenantId, t.planId, t.planVersionId], foreignColumns: [planVersions.tenantId, planVersions.planId, planVersions.id], name: 'followups_tenant_plan_version_fk' }),
  unique('followups_tenant_id_unique').on(t.tenantId, t.id),
  unique('followups_tenant_id_patient_unique').on(t.tenantId, t.id, t.patientId),
  uniqueIndex('followups_live_offer_unique').on(t.tenantId, t.patientId, t.offerType, t.offerId).where(sql`${t.status} not in ('completed', 'cancelled')`),
  index('followups_patient_created_idx').on(t.tenantId, t.patientId, t.createdAt),
  check('followups_offer_type_valid', sql`${t.offerType} in ('procedure', 'combo', 'plan')`),
  check('followups_offer_target_valid', sql`(${t.offerType} = 'procedure' and ${t.comboId} is null and ${t.planId} is null and ${t.planVersionId} is null) or (${t.offerType} = 'combo' and ${t.comboId} = ${t.offerId} and ${t.planId} is null and ${t.planVersionId} is null) or (${t.offerType} = 'plan' and ${t.planId} = ${t.offerId} and ${t.comboId} is null and ${t.planVersionId} is not null)`),
  check('followups_status_valid', sql`${t.status} in ('idle', 'active', 'completed', 'cancelled')`),
  check('followups_price_nonnegative', sql`${t.priceCents} >= 0`),
  check('followups_cancelled_state_valid', sql`(${t.status} = 'cancelled' and ${t.cancelledAt} is not null and ${t.completedAt} is null and ${t.cancellationReason} is not null and length(trim(${t.cancellationReason})) > 0) or (${t.status} <> 'cancelled' and ${t.cancelledAt} is null and ${t.cancellationReason} is null)`),
  check('followups_completed_state_valid', sql`(${t.status} = 'completed' and ${t.completedAt} is not null and ${t.cancelledAt} is null and ${t.cancellationReason} is null) or (${t.status} <> 'completed' and ${t.completedAt} is null)`),
]);

export const followupItems = pgTable('followup_items', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), followupId: uuid('followup_id').notNull(), procedureId: uuid('procedure_id').notNull(), procedureName: text('procedure_name').notNull(), sessionsTotal: integer('sessions_total').notNull(), sessionsPerformed: integer('sessions_performed').notNull().default(0), durationMinutes: integer('duration_minutes').notNull(), priceCents: integer('price_cents').notNull(), sessionSchema: jsonb('session_schema').notNull(), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.followupId], foreignColumns: [followups.tenantId, followups.id], name: 'followup_items_tenant_followup_fk' }), foreignKey({ columns: [t.tenantId, t.procedureId], foreignColumns: [procedures.tenantId, procedures.id], name: 'followup_items_tenant_procedure_fk' }), check('followup_items_sessions_positive', sql`${t.sessionsTotal} >= 1`), check('followup_items_performed_valid', sql`${t.sessionsPerformed} between 0 and ${t.sessionsTotal}`), check('followup_items_duration_positive', sql`${t.durationMinutes} >= 1`), check('followup_items_price_nonnegative', sql`${t.priceCents} >= 0`)]);

// Immutable source snapshots are separate from mutable operational counters.
export const followupSnapshots = pgTable('followup_snapshots', {
  id: uuid('id').defaultRandom(), tenantId: uuid('tenant_id').notNull(), followupId: uuid('followup_id').notNull(), kind: text('kind').notNull(), sourceVersion: integer('source_version'), payload: jsonb('payload').notNull(), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.followupId], foreignColumns: [followups.tenantId, followups.id], name: 'followup_snapshots_tenant_followup_fk' }), primaryKey({ columns: [t.tenantId, t.followupId, t.kind] }), check('followup_snapshots_kind_valid', sql`${t.kind} in ('combo', 'plan')`)]);

export const followupContracts = pgTable('followup_contracts', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), followupId: uuid('followup_id').notNull(), contractId: uuid('contract_id').notNull(), contractVersion: integer('contract_version').notNull(), titleSnapshot: text('title_snapshot').notNull(), contentCiphertext: text('content_ciphertext'), contentNonce: text('content_nonce'), contentKeyVersion: integer('content_key_version'), sourceObjectKey: text('source_object_key'), required: boolean('required').notNull().default(true), patientSignedAt: timestamp('patient_signed_at', { withTimezone: true, mode: 'date' }), professionalSignedAt: timestamp('professional_signed_at', { withTimezone: true, mode: 'date' }), status: text('status').notNull().default('pending'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.followupId], foreignColumns: [followups.tenantId, followups.id], name: 'followup_contracts_tenant_followup_fk' }), foreignKey({ columns: [t.tenantId, t.contractId], foreignColumns: [contracts.tenantId, contracts.id], name: 'followup_contracts_tenant_contract_fk' }), foreignKey({ columns: [t.tenantId, t.contractId, t.contractVersion], foreignColumns: [contractVersions.tenantId, contractVersions.contractId, contractVersions.version], name: 'followup_contracts_tenant_contract_version_fk' }), unique('followup_contracts_tenant_id_unique').on(t.tenantId, t.id), check('followup_contracts_version_positive', sql`${t.contractVersion} >= 1`), check('followup_contracts_status_valid', sql`${t.status} in ('pending', 'signed', 'cancelled')`), check('followup_contracts_content_protected', sql`(${t.contentCiphertext} is null and ${t.contentNonce} is null and ${t.contentKeyVersion} is null) or (${t.contentCiphertext} is not null and ${t.contentNonce} is not null and ${t.contentKeyVersion} is not null)`)]);

export const signatureProcesses = pgTable('signature_processes', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), followupContractId: uuid('followup_contract_id').notNull(), status: text('status').notNull().default('pending'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.followupContractId], foreignColumns: [followupContracts.tenantId, followupContracts.id], name: 'signature_processes_tenant_contract_fk' }), unique('signature_processes_tenant_id_unique').on(t.tenantId, t.id), unique('signature_processes_tenant_contract_unique').on(t.tenantId, t.followupContractId), check('signature_processes_status_valid', sql`${t.status} in ('pending', 'completed', 'cancelled')`)]);
export const signatureParticipants = pgTable('signature_participants', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), processId: uuid('process_id').notNull(), role: text('role').notNull(), status: text('status').notNull().default('pending'), signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' }), latestRevision: integer('latest_revision').notNull().default(0), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.processId], foreignColumns: [signatureProcesses.tenantId, signatureProcesses.id], name: 'signature_participants_tenant_process_fk' }), unique('signature_participants_role_unique').on(t.tenantId, t.processId, t.role), check('signature_participants_role_valid', sql`${t.role} in ('patient', 'professional')`), check('signature_participants_status_valid', sql`${t.status} in ('pending', 'signed', 'revoked')`), check('signature_participants_state_valid', sql`(${t.status} = 'signed' and ${t.signedAt} is not null) or (${t.status} <> 'signed' and ${t.signedAt} is null)`)]);
export const signatureRevisions = pgTable('signature_revisions', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), participantId: uuid('participant_id').notNull(), revision: integer('revision').notNull(), evidenceCiphertext: text('evidence_ciphertext'), evidenceNonce: text('evidence_nonce'), evidenceKeyVersion: integer('evidence_key_version'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.participantId], foreignColumns: [signatureParticipants.tenantId, signatureParticipants.id], name: 'signature_revisions_tenant_participant_fk' }), unique('signature_revisions_number_unique').on(t.tenantId, t.participantId, t.revision), check('signature_revisions_positive', sql`${t.revision} >= 1`)]);
export const signatureEvents = pgTable('signature_events', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), participantId: uuid('participant_id').notNull(), revisionId: uuid('revision_id'), type: text('type').notNull(), metadata: jsonb('metadata'), occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.participantId], foreignColumns: [signatureParticipants.tenantId, signatureParticipants.id], name: 'signature_events_tenant_participant_fk' }), foreignKey({ columns: [t.tenantId, t.revisionId], foreignColumns: [signatureRevisions.tenantId, signatureRevisions.id], name: 'signature_events_tenant_revision_fk', }), index('signature_events_participant_idx').on(t.tenantId, t.participantId, t.occurredAt)]);
export const signatureTokens = pgTable('signature_tokens', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), participantId: uuid('participant_id').notNull(), tokenHash: text('token_hash').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(), revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.participantId], foreignColumns: [signatureParticipants.tenantId, signatureParticipants.id], name: 'signature_tokens_tenant_participant_fk' }), unique('signature_tokens_hash_unique').on(t.tenantId, t.tokenHash), index('signature_tokens_active_idx').on(t.tenantId, t.participantId, t.expiresAt), check('signature_tokens_hash_not_empty', sql`length(${t.tokenHash}) >= 64`)]);

export const appliedAnamneses = pgTable('applied_anamneses', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), patientId: uuid('patient_id').notNull(), followupId: uuid('followup_id').notNull(), anamnesisId: uuid('anamnesis_id').notNull(), version: integer('version').notNull(), titleSnapshot: text('title_snapshot').notNull(), schemaSnapshot: jsonb('schema_snapshot').notNull(), required: boolean('required').notNull().default(true), submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }), validUntil: timestamp('valid_until', { withTimezone: true, mode: 'date' }), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.patientId], foreignColumns: [patients.tenantId, patients.id], name: 'applied_anamneses_tenant_patient_fk' }), foreignKey({ columns: [t.tenantId, t.followupId, t.patientId], foreignColumns: [followups.tenantId, followups.id, followups.patientId], name: 'applied_anamneses_tenant_followup_patient_fk' }), foreignKey({ columns: [t.tenantId, t.anamnesisId], foreignColumns: [anamneses.tenantId, anamneses.id], name: 'applied_anamneses_tenant_anamnesis_fk' }), check('applied_anamneses_version_positive', sql`${t.version} >= 1`)]);

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull(), followupId: uuid('followup_id').notNull(), amountCents: integer('amount_cents').notNull(), method: text('method').notNull(), installments: integer('installments').notNull().default(1), receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), notesCiphertext: text('notes_ciphertext'), notesNonce: text('notes_nonce'), notesKeyVersion: integer('notes_key_version'), idempotencyKey: text('idempotency_key'), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.followupId], foreignColumns: [followups.tenantId, followups.id], name: 'payments_tenant_followup_fk' }), unique('payments_tenant_id_unique').on(t.tenantId, t.id), unique('payments_idempotency_unique').on(t.tenantId, t.followupId, t.idempotencyKey), check('payments_amount_positive', sql`${t.amountCents} > 0`), check('payments_installments_positive', sql`${t.installments} >= 1`), check('payments_method_valid', sql`${t.method} in ('cash', 'pix', 'credit_card')`)]);

export type RelationalFollowup = typeof followups.$inferSelect; export type RelationalFollowupItem = typeof followupItems.$inferSelect;
export type RelationalPlan = typeof plans.$inferSelect; export type RelationalPlanVersion = typeof planVersions.$inferSelect;
