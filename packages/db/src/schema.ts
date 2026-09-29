import mongoose, { Schema } from 'mongoose';

const patientSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, index: true },
  phone: { type: String, trim: true, default: null, index: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  notes: { type: String, trim: true, default: null },
}, { timestamps: true, versionKey: false });
export const Patient = mongoose.models.Patient ?? mongoose.model('Patient', patientSchema);

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
}, { timestamps: true, versionKey: false });
export const Procedure = mongoose.models.Procedure ?? mongoose.model('Procedure', procedureSchema);

const formVersionSchema = new Schema({ version: { type: Number, required: true }, schema: { type: Schema.Types.Mixed, required: true }, createdAt: { type: Date, default: Date.now } });
const anamnesisSchema = new Schema({ title: { type: String, required: true, trim: true, minlength: 2 }, active: { type: Boolean, default: true }, versions: { type: [formVersionSchema], default: [] }, procedureIds: [{ type: Schema.Types.ObjectId, ref: 'Procedure' }], requiredByDefault: { type: Boolean, default: true } }, { timestamps: true, versionKey: false });
export const Anamnesis = mongoose.models.Anamnesis ?? mongoose.model('Anamnesis', anamnesisSchema);

const packageItemSchema = new Schema({ procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true }, sessionsOverride: { type: Number, min: 1, default: null }, priceOverrideCents: { type: Number, min: 0, default: null } });
const packageSchema = new Schema({ name: { type: String, required: true, trim: true }, description: { type: String, default: null }, priceCents: { type: Number, required: true, min: 0 }, promotionalPriceCents: { type: Number, min: 0, default: null }, validFrom: { type: Date, default: null }, validUntil: { type: Date, default: null }, active: { type: Boolean, default: true }, items: { type: [packageItemSchema], validate: (items: unknown[]) => items.length > 0 } }, { timestamps: true, versionKey: false });
export const PackageOffer = mongoose.models.PackageOffer ?? mongoose.model('PackageOffer', packageSchema);

const contractVersionSchema = new Schema({ version: { type: Number, required: true }, content: { type: String, default: null }, sourceObjectKey: { type: String, default: null }, createdAt: { type: Date, default: Date.now } });
const contractSchema = new Schema({ title: { type: String, required: true, trim: true }, kind: { type: String, enum: ['standard', 'procedure', 'package'], required: true }, procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', default: null }, packageId: { type: Schema.Types.ObjectId, ref: 'PackageOffer', default: null }, active: { type: Boolean, default: true }, versions: { type: [contractVersionSchema], default: [] } }, { timestamps: true, versionKey: false });
export const Contract = mongoose.models.Contract ?? mongoose.model('Contract', contractSchema);

const planItemSchema = new Schema({ procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true }, procedureName: { type: String, required: true }, sessionsTotal: { type: Number, required: true, min: 1 }, sessionsPerformed: { type: Number, default: 0, min: 0 }, sessionSchema: { type: Schema.Types.Mixed, required: true }, priceCents: { type: Number, required: true, min: 0 }, anamneses: [{ anamnesisId: { type: Schema.Types.ObjectId, ref: 'Anamnesis' }, required: Boolean, version: Number, schemaSnapshot: Schema.Types.Mixed }] });
const planSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, offerType: { type: String, enum: ['procedure', 'package'], required: true }, offerId: { type: Schema.Types.ObjectId, required: true }, offerName: { type: String, required: true }, priceCents: { type: Number, required: true, min: 0 }, items: { type: [planItemSchema], default: [] }, contracts: [{ contractId: { type: Schema.Types.ObjectId, ref: 'Contract' }, title: String, version: Number, contentSnapshot: String, objectKey: String }], createdAt: { type: Date, default: Date.now } }, { versionKey: false });
planSchema.index({ patientId: 1, offerType: 1, offerId: 1 }, { unique: true });
export const Plan = mongoose.models.Plan ?? mongoose.model('Plan', planSchema);

const paymentSchema = new Schema({ planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true }, amountCents: { type: Number, required: true, min: 1 }, method: { type: String, enum: ['cash', 'pix', 'credit_card'], required: true }, installments: { type: Number, min: 1, default: 1 }, receivedAt: { type: Date, default: Date.now }, notes: { type: String, default: null } }, { versionKey: false });
export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);

const appointmentSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, planItemIds: [{ type: Schema.Types.ObjectId }], startsAt: { type: Date, required: true, index: true }, endsAt: { type: Date, required: true }, status: { type: String, enum: ['planned', 'confirmed', 'rescheduled', 'cancelled', 'no_show'], default: 'planned' }, notes: { type: String, default: null } }, { timestamps: true, versionKey: false });
export const Appointment = mongoose.models.Appointment ?? mongoose.model('Appointment', appointmentSchema);

const sessionPhotoSchema = new Schema({ objectKey: { type: String, required: true }, phase: { type: String, enum: ['before', 'during', 'after'], required: true }, notes: { type: String, default: null }, createdAt: { type: Date, default: Date.now } });
const sessionSchema = new Schema({ patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true }, planItemId: { type: Schema.Types.ObjectId, required: true }, appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null }, procedureName: { type: String, required: true }, performedAt: { type: Date, default: Date.now }, data: { type: Schema.Types.Mixed, default: {} }, schemaSnapshot: { type: Schema.Types.Mixed, required: true }, notes: { type: String, default: null }, photos: { type: [sessionPhotoSchema], default: [] } }, { timestamps: true, versionKey: false });
export const Session = mongoose.models.Session ?? mongoose.model('Session', sessionSchema);

const patientFormSchema = new Schema({ anamnesisId: { type: Schema.Types.ObjectId, ref: 'Anamnesis', required: true }, planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null }, version: { type: Number, required: true }, schemaSnapshot: { type: Schema.Types.Mixed, required: true }, required: { type: Boolean, default: true }, request: { tokenHash: String, expiresAt: Date, submittedAt: Date, draft: Schema.Types.Mixed }, response: { answers: Schema.Types.Mixed, submittedAt: Date, validUntil: Date }, notes: [{ content: String, createdAt: { type: Date, default: Date.now } }] });
export const PatientAnamnesis = mongoose.models.PatientAnamnesis ?? mongoose.model('PatientAnamnesis', patientFormSchema);
