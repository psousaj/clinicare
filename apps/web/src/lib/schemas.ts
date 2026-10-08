import { z } from 'zod';

const refId = z.union([z.string(), z.looseObject({ id: z.string() })]).transform((value) => (typeof value === 'string' ? value : value.id));
const jsonSchema = z.record(z.string(), z.unknown());

export const patientSchema = z.looseObject({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  cpf: z.string().nullish(),
  birthDate: z.string().nullish(),
  notes: z.string().nullish(),
  createdAt: z.string().optional(),
});
export const procedureSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  baseSessions: z.number().nullish(),
  durationMinutes: z.number().nullish(),
  standalone: z.boolean().optional(),
  priceCents: z.number(),
  active: z.boolean().optional(),
  requireNewAnamnesis: z.boolean().optional(),
  anamnesisIds: z.array(z.string()).default([]),
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
  description: z.string().nullable().optional(),
  validityMonths: z.number().default(12),
  procedureIds: z.array(refId).default([]),
  versions: z.array(anamnesisVersionSchema),
});
export const contractVersionSchema = z.looseObject({
  id: z.string().optional(),
  version: z.number(),
  content: z.string().nullish(),
  origin: z.enum(['created', 'edited', 'restored']).nullish(),
  restoredFromVersion: z.number().nullish(),
  createdAt: z.string().nullish(),
  hasSourceDocx: z.boolean().optional(),
  sourceDocxHash: z.string().nullish(),
  sourceDocxSize: z.number().nullish(),
  sourceDocxContentType: z.string().nullish(),
  contextConfiguration: z.record(z.string(), z.looseObject({ enabled: z.boolean(), required: z.boolean() })).nullish(),
  allowedPlaceholders: z.array(z.string()).default([]),
  requiredPlaceholders: z.array(z.string()).default([]),
  hasRenderedPdf: z.boolean().optional(),
  renderedPdfHash: z.string().nullish(),
  renderedPdfSize: z.number().nullish(),
  renderedPdfContentType: z.string().nullish(),
});
const contractDraftSchema = z.looseObject({
  draftDocxObjectKey: z.string().nullish(),
  draftDocxHash: z.string().nullish(),
  draftDocxSize: z.number().nullish(),
  draftContextConfiguration: z.record(z.string(), z.looseObject({ enabled: z.boolean(), required: z.boolean() })).nullish(),
  draftAllowedPlaceholders: z.array(z.string()).nullish(),
  draftRequiredPlaceholders: z.array(z.string()).nullish(),
});
export const contractSchema = contractDraftSchema.extend({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['standard', 'procedure', 'combo']),
  procedureId: refId.nullish(),
  comboId: refId.nullish(),
  active: z.boolean().default(true),
  currentVersion: z.number().default(0),
  versions: z.array(contractVersionSchema),
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
  anamnesisIds: z.array(z.string()).default([]),
  items: z.array(z.looseObject({ procedureId: refId.optional(), sessions: z.number().nullish(), sessionsOverride: z.number().nullish() })),
});
export const planProcedureItemSchema = z.looseObject({ offerType: z.literal('procedure'), offerId: z.string(), sessions: z.number().int().min(1).default(1) });
export const planComboItemSchema = z.looseObject({
  offerType: z.literal('combo'),
  offerId: z.string(),
  comboName: z.string().nullish(),
  priceCents: z.number().nullish(),
  items: z.array(z.looseObject({ procedureId: z.string().nullish(), procedureName: z.string().nullish(), sessions: z.number().nullish() })).default([]),
});
export const planSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  priceCents: z.number(),
  active: z.boolean().optional(),
  durationDays: z.number().nullish(),
  validityDays: z.number().nullish(),
  items: z.array(z.discriminatedUnion('offerType', [planProcedureItemSchema, planComboItemSchema])),
  contractIds: z.array(refId).default([]),
  anamnesisIds: z.array(refId).default([]),
  requireNewAnamnesis: z.boolean().optional(),
});
export const eventSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  eventDate: z.string(),
  active: z.boolean().optional(),
  items: z.array(z.discriminatedUnion('kind', [
    z.looseObject({ kind: z.literal('procedure'), procedureId: z.string(), sessions: z.number().int().min(1) }),
    z.looseObject({ kind: z.literal('combo'), comboId: z.string() }),
  ])),
  contractIds: z.array(refId).default([]),
  anamnesisIds: z.array(refId).default([]),
  enrolledPatients: z.array(z.object({ id: z.string(), fullName: z.string() })).default([]),
});
export const followupItemSchema = z.looseObject({
  id: z.string(),
  procedureId: z.string().nullish(),
  procedureName: z.string(),
  sessionsTotal: z.number(),
  durationMinutes: z.number().nullish(),
  sessionsPerformed: z.number().default(0),
  sessionSchema: jsonSchema.nullish(),
  comboId: z.string().nullish(),
  comboName: z.string().nullish(),
  cancelledAt: z.string().nullish(),
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
// Detalhe de uma anamnese aplicada (GET /api/patient-anamneses/:id): inclui as
// respostas descriptografadas para exibição em leitura no painel da clínica.
export const appliedAnamnesisSchema = z.looseObject({
  id: z.string(),
  title: z.string().nullish(),
  titleSnapshot: z.string().nullish(),
  schemaSnapshot: jsonSchema.nullish(),
  answers: jsonSchema.nullish(),
  submittedAt: z.string().nullish(),
  required: z.boolean().optional(),
});
export const signaturePendingSchema = z.looseObject({ participantId: z.string(), role: z.string(), status: z.string(), followupId: z.string(), contractId: z.string(), title: z.string(), blocking: z.boolean(), patient: z.looseObject({ id: z.string(), fullName: z.string() }) });
// Perfil profissional do usuário logado (GET/PUT /api/auth/professional-profile):
// conselho + número (+ UF) que carimba os contratos materializados.
export const professionalProfileSchema = z.looseObject({
  id: z.string().optional(),
  userId: z.string().optional(),
  registrationType: z.string().nullish(),
  registrationNumber: z.string().nullish(),
  registrationState: z.string().nullish(),
  active: z.boolean().optional(),
});
export const sessionSchema = z.looseObject({ user: z.looseObject({ id: z.string(), name: z.string(), email: z.string().nullish() }) });
export const accountSchema = z.looseObject({
  user: z.looseObject({ id: z.string(), name: z.string(), email: z.string().nullish() }),
  tenant: z.looseObject({ id: z.string(), name: z.string() }),
});
export const defaultSignatureSchema = z.object({ signaturePng: z.string().nullable() });
export const signatureSchema = z.looseObject({ participantId: z.string(), role: z.string(), status: z.string(), expiresAt: z.string(), contract: z.looseObject({ id: z.string(), followupId: z.string(), title: z.string(), version: z.number(), content: z.string().nullish() }) });
export const followupSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  offerType: z.enum(['procedure', 'combo', 'plan', 'event']).default('procedure'),
  eventDate: z.string().nullish(),
  offerName: z.string(),
  priceCents: z.number(),
  validUntil: z.string().nullish(),
  createdAt: z.string().nullish(),
  contracts: z.array(z.looseObject({ id: z.string().optional(), title: z.string().optional(), signedAt: z.string().nullish(), status: z.string().optional() })).default([]),
  anamneses: z.array(followupAnamnesisSchema).default([]),
  blocked: z.boolean().default(false),
  items: z.array(followupItemSchema),
  payments: z.array(z.looseObject({ amountCents: z.number() })),
});
export const appointmentItemSchema = z.looseObject({
  id: z.string(),
  confirmationStatus: z.string().optional(),
  followupId: z.string().nullish(),
  followupItemId: z.string().nullish(),
  procedureId: z.string(),
  procedureName: z.string(),
  quantity: z.number(),
  minutesEach: z.number(),
});
export const appointmentSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
  noShowReason: z.string().nullish(),
  notes: z.string().nullish(),
  items: z.array(appointmentItemSchema).default([]),
});
export const attendancePhotoSchema = z.looseObject({
  id: z.string(),
  objectKey: z.string(),
  phase: z.enum(['before', 'during', 'after']),
  notes: z.string().nullish(),
  createdAt: z.string().nullish(),
  url: z.string().nullish(),
});
export const attendanceSchema = z.looseObject({
  id: z.string(),
  patientId: refId,
  appointmentId: z.string().nullish(),
  procedureName: z.string(),
  performedAt: z.string(),
  durationMinutes: z.number().nullish(),
  data: jsonSchema.nullish(),
  schemaSnapshot: jsonSchema.nullish(),
  notes: z.string().nullish(),
  photos: z.array(attendancePhotoSchema).default([]),
});
const historyPhoto = z.looseObject({ id: z.string().optional(), _id: z.string().optional(), attendanceId: z.string().optional(), phase: z.string().optional(), url: z.string().nullish(), createdAt: z.string().nullish() });
const historyEntry = z.looseObject({ type: z.string(), at: z.string(), title: z.string(), details: z.looseObject({ id: z.string().optional(), status: z.string().optional(), notes: z.union([z.string(), z.array(z.unknown())]).nullish(), photos: z.array(historyPhoto).optional(), photoCount: z.number().optional() }).optional() });
export const relationshipSchema = z.looseObject({
  totals: z.looseObject({
    followups: z.number(), attendancesPerformed: z.number(), attendancesContracted: z.number(), minutesTotal: z.number(), attendancesWithoutDuration: z.number(),
    contractedCents: z.number(), paidCents: z.number(), pendingCents: z.number(), dueForPerformedCents: z.number(), noShows: z.number(),
  }),
  firstAttendanceAt: z.string().nullable(),
  lastAttendanceAt: z.string().nullable(),
  nextAppointmentAt: z.string().nullable(),
  averageIntervalDays: z.number().nullable(),
  monthly: z.array(z.looseObject({ month: z.string(), attendances: z.number(), minutes: z.number(), paidCents: z.number() })),
  followups: z.array(z.looseObject({ id: z.string(), offerName: z.string(), priceCents: z.number(), paidCents: z.number(), pendingCents: z.number(), sessionsTotal: z.number(), sessionsPerformed: z.number() })),
  procedures: z.array(z.looseObject({ name: z.string(), attendances: z.number(), minutes: z.number() })),
});
export const patientHistorySchema = z.looseObject({ patient: patientSchema, events: z.array(historyEntry), pending: z.array(historyEntry) });
export const publicFormSchema = z.looseObject({ title: z.string(), schema: jsonSchema, draft: jsonSchema });
export const publicAnamnesisSchema = z.looseObject({
  title: z.string(), description: z.string().nullable().optional(), schema: jsonSchema, draft: jsonSchema,
  branding: z.looseObject({ clinicName: z.string(), professionalName: z.string().nullable(), professionalRegistration: z.string().nullable() }).optional(),
});

export const createdSchema = z.looseObject({ id: z.string() });
export const requestSchema = z.looseObject({ id: z.string(), url: z.string() });
export const anySchema = z.unknown();

export type Patient = z.infer<typeof patientSchema>;
export type Procedure = z.infer<typeof procedureSchema>;
export type Anamnesis = z.infer<typeof anamnesisSchema>;
export type Contract = z.infer<typeof contractSchema>;
export type ContractVersion = z.infer<typeof contractVersionSchema>;
export type AnamnesisVersion = z.infer<typeof anamnesisVersionSchema>;
export type Combo = z.infer<typeof comboSchema>;
export type FollowupItem = z.infer<typeof followupItemSchema>;
export type Plan = z.infer<typeof planSchema>;
export type EventOffer = z.infer<typeof eventSchema>;
export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;
export type Account = z.infer<typeof accountSchema>;
export type FollowupAnamnesis = z.infer<typeof followupAnamnesisSchema>;
export type AppliedAnamnesis = z.infer<typeof appliedAnamnesisSchema>;
export type Followup = z.infer<typeof followupSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;
export type AttendancePhoto = z.infer<typeof attendancePhotoSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type PatientHistory = z.infer<typeof patientHistorySchema>;

export const signatureHistorySchema = z.looseObject({
  process: z.looseObject({ id: z.string(), status: z.string(), statusLabel: z.string(), followupContractId: z.string() }),
  contract: z.looseObject({ id: z.string(), title: z.string(), version: z.number(), required: z.boolean(), status: z.string() }),
  document: z.looseObject({
    id: z.string(),
    currentRevisionId: z.string().nullish(),
    hasExternalSignatures: z.boolean().optional(),
    revisions: z.array(z.looseObject({
      id: z.string(), version: z.number(), originLabel: z.string(), hash: z.string(),
      createdAt: z.string(), downloadUrl: z.string().nullish(),
      promotedBy: z.looseObject({ role: z.string(), methodLabel: z.string() }).nullish(),
    })).default([]),
  }).nullish(),
  participants: z.array(z.looseObject({ id: z.string(), role: z.string(), roleLabel: z.string(), status: z.string(), statusLabel: z.string(), signedAt: z.string().nullish() })).default([]),
  operations: z.array(z.looseObject({ id: z.string(), methodLabel: z.string(), statusLabel: z.string(), createdAt: z.string(), confirmedAt: z.string().nullish() })).default([]),
  externalAttempts: z.array(z.looseObject({ id: z.string(), lifecycleLabel: z.string(), validationLabel: z.string().nullish() })).default([]),
  events: z.array(z.looseObject({ id: z.string(), label: z.string(), occurredAt: z.string(), method: z.string().nullish(), revision: z.string().nullish(), actor: z.looseObject({ role: z.string(), name: z.string() }) })).default([]),
  notice: z.string().optional(),
});
export type SignatureHistory = z.infer<typeof signatureHistorySchema>;
