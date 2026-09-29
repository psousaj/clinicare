import mongoose, { Schema } from 'mongoose';

// Recria o model em cache para que `bun --hot` aplique mudanças de schema sem reiniciar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defineModel(name: string, schema: Schema): mongoose.Model<any> {
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema) as unknown as mongoose.Model<any>;
}

const patientSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, index: true },
  phone: { type: String, trim: true, default: null, index: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  notes: { type: String, trim: true, default: null },
}, { timestamps: true, versionKey: false });
export const Patient = defineModel('Patient', patientSchema);

const procedureVersionSchema = new Schema({
  version: { type: Number, required: true },
  sessionSchema: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });
const procedureSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2 },
  description: { type: String, trim: true, default: null },
  baseSessions: { type: Number, required: true, min: 1, default: 1 },
  durationMinutes: { type: Number, min: 1, default: null },
  priceCents: { type: Number, required: true, min: 0, default: 0 },
  sessionSchema: { type: Schema.Types.Mixed, required: true, default: { type: 'object', properties: {} } },
  versions: { type: [procedureVersionSchema], default: [] },
  active: { type: Boolean, default: true },
  requireNewAnamnesis: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });
export const Procedure = defineModel('Procedure', procedureSchema);

const formVersionSchema = new Schema({ version: { type: Number, required: true }, schema: { type: Schema.Types.Mixed, required: true }, origin: { type: String, enum: ['created', 'edited', 'restored'], default: 'created' }, restoredFromVersion: { type: Number, default: null }, createdAt: { type: Date, default: Date.now } });
const anamnesisSchema = new Schema({ title: { type: String, required: true, trim: true, minlength: 2 }, active: { type: Boolean, default: true }, versions: { type: [formVersionSchema], default: [] }, procedureIds: [{ type: Schema.Types.ObjectId, ref: 'Procedure' }], requiredByDefault: { type: Boolean, default: true }, validityMonths: { type: Number, min: 1, default: 12 } }, { timestamps: true, versionKey: false });
export const Anamnesis = defineModel('Anamnesis', anamnesisSchema);

const comboItemSchema = new Schema({ procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true }, sessionsOverride: { type: Number, min: 1, default: null }, priceOverrideCents: { type: Number, min: 0, default: null } });
const comboSchema = new Schema({ name: { type: String, required: true, trim: true }, description: { type: String, default: null }, priceCents: { type: Number, required: true, min: 0 }, promotionalPriceCents: { type: Number, min: 0, default: null }, validFrom: { type: Date, default: null }, validUntil: { type: Date, default: null }, active: { type: Boolean, default: true }, requireNewAnamnesis: { type: Boolean, default: false }, items: { type: [comboItemSchema], validate: (items: unknown[]) => items.length > 0 } }, { timestamps: true, versionKey: false });
export const Combo = defineModel('Combo', comboSchema);

const contractVersionSchema = new Schema({ version: { type: Number, required: true }, content: { type: String, default: null }, sourceObjectKey: { type: String, default: null }, createdAt: { type: Date, default: Date.now } });
const contractSchema = new Schema({ title: { type: String, required: true, trim: true }, kind: { type: String, enum: ['standard', 'procedure', 'combo'], required: true }, procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', default: null }, comboId: { type: Schema.Types.ObjectId, ref: 'Combo', default: null }, active: { type: Boolean, default: true }, versions: { type: [contractVersionSchema], default: [] } }, { timestamps: true, versionKey: false });
export const Contract = defineModel('Contract', contractSchema);

const planSchema = new Schema({ name: { type: String, required: true, trim: true, minlength: 2 }, description: { type: String, default: null }, priceCents: { type: Number, required: true, min: 0 }, durationDays: { type: Number, min: 1, default: null }, validityDays: { type: Number, min: 1, default: null }, items: { type: [{ offerType: { type: String, enum: ['procedure', 'combo'], required: true }, offerId: { type: Schema.Types.ObjectId, required: true } }], validate: (items: unknown[]) => items.length > 0 }, contractIds: [{ type: Schema.Types.ObjectId, ref: 'Contract' }], requireNewAnamnesis: { type: Boolean, default: false }, active: { type: Boolean, default: true } }, { timestamps: true, versionKey: false });
export const Plan = defineModel('Plan', planSchema);

const followupItemSchema = new Schema({ procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true }, procedureName: { type: String, required: true }, sessionsTotal: { type: Number, required: true, min: 1 }, sessionsPerformed: { type: Number, default: 0, min: 0 }, sessionSchema: { type: Schema.Types.Mixed, required: true }, priceCents: { type: Number, required: true, min: 0 }, anamneses: [{ anamnesisId: { type: Schema.Types.ObjectId, ref: 'Anamnesis' }, required: Boolean, version: Number, schemaSnapshot: Schema.Types.Mixed }] });
const followupSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, offerType: { type: String, enum: ['procedure', 'combo', 'plan'], required: true }, offerId: { type: Schema.Types.ObjectId, required: true }, offerName: { type: String, required: true }, priceCents: { type: Number, required: true, min: 0 }, items: { type: [followupItemSchema], default: [] }, validUntil: { type: Date, default: null }, contracts: [{ contractId: { type: Schema.Types.ObjectId, ref: 'Contract' }, title: String, version: Number, contentSnapshot: String, objectKey: String, signedAt: { type: Date, default: null } }], createdAt: { type: Date, default: Date.now } }, { versionKey: false });
export const Followup = defineModel('Followup', followupSchema);

const paymentSchema = new Schema({ followupId: { type: Schema.Types.ObjectId, ref: 'Followup', required: true, index: true }, amountCents: { type: Number, required: true, min: 1 }, method: { type: String, enum: ['cash', 'pix', 'credit_card'], required: true }, installments: { type: Number, min: 1, default: 1 }, receivedAt: { type: Date, default: Date.now }, notes: { type: String, default: null } }, { versionKey: false });
export const Payment = defineModel('Payment', paymentSchema);

const appointmentSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, followupItemIds: [{ type: Schema.Types.ObjectId }], startsAt: { type: Date, required: true, index: true }, endsAt: { type: Date, required: true }, status: { type: String, enum: ['planned', 'confirmed', 'rescheduled', 'cancelled', 'no_show'], default: 'planned' }, notes: { type: String, default: null } }, { timestamps: true, versionKey: false });
export const Appointment = defineModel('Appointment', appointmentSchema);

const sessionPhotoSchema = new Schema({ objectKey: { type: String, required: true }, phase: { type: String, enum: ['before', 'during', 'after'], required: true }, notes: { type: String, default: null }, createdAt: { type: Date, default: Date.now } });
const sessionSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, followupId: { type: Schema.Types.ObjectId, ref: 'Followup', required: true }, followupItemId: { type: Schema.Types.ObjectId, required: true }, appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null }, procedureName: { type: String, required: true }, performedAt: { type: Date, default: Date.now }, durationMinutes: { type: Number, min: 1, default: null }, data: { type: Schema.Types.Mixed, default: {} }, schemaSnapshot: { type: Schema.Types.Mixed, required: true }, notes: { type: String, default: null }, photos: { type: [sessionPhotoSchema], default: [] } }, { timestamps: true, versionKey: false });
export const Session = defineModel('Session', sessionSchema);

const patientFormSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, anamnesisId: { type: Schema.Types.ObjectId, ref: 'Anamnesis', required: true }, followupId: { type: Schema.Types.ObjectId, ref: 'Followup', default: null }, version: { type: Number, required: true }, schemaSnapshot: { type: Schema.Types.Mixed, required: true }, required: { type: Boolean, default: true }, request: { tokenHash: String, expiresAt: Date, submittedAt: Date, draft: Schema.Types.Mixed }, response: { answers: Schema.Types.Mixed, submittedAt: Date, validUntil: Date }, notes: [{ content: String, createdAt: { type: Date, default: Date.now } }] });
export const PatientAnamnesis = defineModel('PatientAnamnesis', patientFormSchema);
