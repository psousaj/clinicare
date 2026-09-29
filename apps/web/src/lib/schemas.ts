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
  sessionSchema: jsonSchema.optional(),
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
  priceCents: z.number(),
  promotionalPriceCents: z.number().nullish(),
  validFrom: z.string().nullish(),
  validUntil: z.string().nullish(),
  items: z.array(z.looseObject({ procedureId: refId.optional(), sessionsOverride: z.number().nullish() })),
});
export const planItemSchema = z.looseObject({
  id: z.string(),
  procedureName: z.string(),
  sessionsTotal: z.number(),
  sessionsPerformed: z.number().default(0),
  sessionSchema: jsonSchema.nullish(),
});
export const planSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  offerName: z.string(),
  priceCents: z.number(),
  items: z.array(planItemSchema),
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
  data: jsonSchema.nullish(),
  schemaSnapshot: jsonSchema.nullish(),
  notes: z.string().nullish(),
  photos: z.array(sessionPhotoSchema).default([]),
});
const historyEntry = z.looseObject({ type: z.string(), at: z.string(), title: z.string(), details: z.looseObject({ id: z.string().optional(), notes: z.string().nullish(), photos: z.array(z.unknown()).optional() }).optional() });
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
export type PlanItem = z.infer<typeof planItemSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionPhoto = z.infer<typeof sessionPhotoSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type PatientHistory = z.infer<typeof patientHistorySchema>;
