import { z } from 'zod';

const refId = z.union([z.string(), z.looseObject({ id: z.string() })]).transform((value) => (typeof value === 'string' ? value : value.id));
const jsonSchema = z.record(z.string(), z.unknown());

export const patientSchema = z.looseObject({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  notes: z.string().nullish(),
  createdAt: z.string().optional(),
});
export const procedureSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  baseSessions: z.number(),
  durationMinutes: z.number().nullish(),
  priceCents: z.number(),
  active: z.boolean().optional(),
  requireNewAnamnesis: z.boolean().optional(),
  sessionSchema: jsonSchema.optional(),
  versions: z.array(z.looseObject({ version: z.number() })).optional(),
});
export const anamnesisVersionSchema = z.looseObject({
  id: z.string().optional(),
  version: z.number(),
  schema: jsonSchema,
  origin: z.enum(['created', 'edited', 'restored']).nullish(),
  restoredFromVersion: z.number().nullish(),
  createdAt: z.string().nullish(),
});
export const anamnesisSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  validityMonths: z.number().default(12),
  procedureIds: z.array(refId).default([]),
  versions: z.array(anamnesisVersionSchema),
});
export const contractSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  versions: z.array(z.looseObject({ version: z.number() })),
});
export const comboSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  active: z.boolean().optional(),
  priceCents: z.number(),
  promotionalPriceCents: z.number().nullish(),
  validFrom: z.string().nullish(),
  validUntil: z.string().nullish(),
  requireNewAnamnesis: z.boolean().optional(),
  items: z.array(z.looseObject({ procedureId: refId.optional(), sessionsOverride: z.number().nullish() })),
});
export const planSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  priceCents: z.number(),
  durationDays: z.number().nullish(),
  validityDays: z.number().nullish(),
  items: z.array(z.looseObject({ offerType: z.enum(['procedure', 'combo']), offerId: z.string() })),
  contractIds: z.array(refId).default([]),
  requireNewAnamnesis: z.boolean().optional(),
});
export const followupItemSchema = z.looseObject({
  id: z.string(),
  procedureName: z.string(),
  sessionsTotal: z.number(),
  sessionsPerformed: z.number().default(0),
  sessionSchema: jsonSchema.nullish(),
});
export const followupAnamnesisSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  required: z.boolean().default(true),
  schemaSnapshot: jsonSchema.nullish(),
  answered: z.boolean(),
  answers: jsonSchema.nullish(),
  submittedAt: z.string().nullish(),
  validUntil: z.string().nullish(),
});
export const followupSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  offerType: z.enum(['procedure', 'combo', 'plan']).default('procedure'),
  offerName: z.string(),
  priceCents: z.number(),
  validUntil: z.string().nullish(),
  createdAt: z.string().nullish(),
  contracts: z.array(z.looseObject({ title: z.string().optional(), signedAt: z.string().nullish() })).default([]),
  anamneses: z.array(followupAnamnesisSchema).default([]),
  blocked: z.boolean().default(false),
  items: z.array(followupItemSchema),
  payments: z.array(z.looseObject({ amountCents: z.number() })),
});
export const appointmentSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
});
export const sessionPhotoSchema = z.looseObject({
  id: z.string(),
  objectKey: z.string(),
  phase: z.enum(['before', 'during', 'after']),
  notes: z.string().nullish(),
  createdAt: z.string().nullish(),
  url: z.string().nullish(),
});
export const sessionSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  procedureName: z.string(),
  performedAt: z.string(),
  durationMinutes: z.number().nullish(),
  data: jsonSchema.nullish(),
  schemaSnapshot: jsonSchema.nullish(),
  notes: z.string().nullish(),
  photos: z.array(sessionPhotoSchema).default([]),
});
const historyEntry = z.looseObject({ type: z.string(), at: z.string(), title: z.string(), details: z.looseObject({ id: z.string().optional(), notes: z.union([z.string(), z.array(z.unknown())]).nullish(), photos: z.array(z.unknown()).optional() }).optional() });
export const relationshipSchema = z.looseObject({
  totals: z.looseObject({
    followups: z.number(), sessionsPerformed: z.number(), sessionsContracted: z.number(), minutesTotal: z.number(), sessionsWithoutDuration: z.number(),
    contractedCents: z.number(), paidCents: z.number(), pendingCents: z.number(), dueForPerformedCents: z.number(), noShows: z.number(),
  }),
  firstSessionAt: z.string().nullable(),
  lastSessionAt: z.string().nullable(),
  nextAppointmentAt: z.string().nullable(),
  averageIntervalDays: z.number().nullable(),
  monthly: z.array(z.looseObject({ month: z.string(), sessions: z.number(), minutes: z.number(), paidCents: z.number() })),
  followups: z.array(z.looseObject({ id: z.string(), offerName: z.string(), priceCents: z.number(), paidCents: z.number(), pendingCents: z.number(), sessionsTotal: z.number(), sessionsPerformed: z.number() })),
  procedures: z.array(z.looseObject({ name: z.string(), sessions: z.number(), minutes: z.number() })),
});
export const patientHistorySchema = z.looseObject({ patient: patientSchema, events: z.array(historyEntry), pending: z.array(historyEntry) });
export const publicFormSchema = z.looseObject({ title: z.string(), schema: jsonSchema, draft: jsonSchema });

export const createdSchema = z.looseObject({ id: z.string() });
export const requestSchema = z.looseObject({ id: z.string(), url: z.string() });
export const anySchema = z.unknown();

export type Patient = z.infer<typeof patientSchema>;
export type Procedure = z.infer<typeof procedureSchema>;
export type Anamnesis = z.infer<typeof anamnesisSchema>;
export type Contract = z.infer<typeof contractSchema>;
export type AnamnesisVersion = z.infer<typeof anamnesisVersionSchema>;
export type Combo = z.infer<typeof comboSchema>;
export type FollowupItem = z.infer<typeof followupItemSchema>;
export type Plan = z.infer<typeof planSchema>;
export type FollowupAnamnesis = z.infer<typeof followupAnamnesisSchema>;
export type Followup = z.infer<typeof followupSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionPhoto = z.infer<typeof sessionPhotoSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type PatientHistory = z.infer<typeof patientHistorySchema>;
