import { describe, expect, it } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Patient, Procedure, Attendance } from './schema';

describe('Mongoose persistence model', () => {
  it('persists validated patients and rejects too-short names', async () => {
    const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    try {
      await mongoose.connect(mongo.getUri());
      const patient = await Patient.create({ fullName: 'Maria Teste' });
      expect((await Patient.findById(patient.id))?.fullName).toBe('Maria Teste');
      await expect(Patient.create({ fullName: 'x' })).rejects.toMatchObject({ name: 'ValidationError' });
    } finally { await mongoose.disconnect(); await mongo.stop(); }
  }, 120_000);
  it('allows repeating the same offer for a patient', async () => {
    const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    try {
      await mongoose.connect(mongo.getUri());
      await Attendance.syncIndexes();
      const patient = await Patient.create({ fullName: 'Ana Teste' });
      const procedure = await Procedure.create({ name: 'Limpeza', sessionSchema: { type: 'object', properties: {} } });
      const values = { patientId: patient._id, offerType: 'procedure', offerId: procedure._id, offerName: procedure.name, priceCents: 100, items: [] };
      await Attendance.create(values);
      await expect(Attendance.create(values)).resolves.toBeDefined();
      expect(await Attendance.countDocuments({ patientId: patient._id })).toBe(2);
    } finally { await mongoose.disconnect(); await mongo.stop(); }
  }, 120_000);
});
