import { boolean, index, pgTable, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { tenants } from './relational-schema';

export const authUsers = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  initialPasswordChoice: text('initial_password_choice').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('user_tenant_id_idx').on(table.tenantId), unique('user_tenant_id_unique').on(table.tenantId)]);

export const professionals = pgTable('professionals', {
  id: uuid('id').defaultRandom().primaryKey(), tenantId: uuid('tenant_id').notNull().references(() => tenants.id), userId: text('user_id').notNull().unique().references(() => authUsers.id), registrationType: text('registration_type').notNull(), registrationNumber: text('registration_number').notNull(), registrationState: text('registration_state'), active: boolean('active').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('professionals_tenant_idx').on(table.tenantId), unique('professionals_tenant_id_unique').on(table.tenantId, table.id)]);

export const authSessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
}, (table) => [index('session_user_id_idx').on(table.userId)]);

export const authAccounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true, mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('account_user_id_idx').on(table.userId), index('account_provider_account_idx').on(table.providerId, table.accountId)]);

export const authVerifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('verification_identifier_idx').on(table.identifier), index('verification_expires_at_idx').on(table.expiresAt)]);

export const authSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
};

export type AuthUser = typeof authUsers.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
