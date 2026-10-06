import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { appliedAnamneses, appointments, attendances, followupItems, followups, getDatabase, patients, payments, decryptValue, buildProtectedAad } from '@clinicare/db';
import { paymentResponse as readPayment } from './payments';
import { patientResponse } from './patients';

const idShape = (row: any) => ({ ...row, _id: row.id });

export async function getRelationalHistory(tenantId: string, patientId: string, actorId?: string | null) {
  const db = getDatabase();
  const patient = (await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId))))[0];
  if (!patient) return null;
  const followupRows = await db.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.patientId, patientId)));
  const followupIds = followupRows.map((row) => row.id);
  const [appointmentRows, attendanceRows, paymentRows, anamnesisRows] = await Promise.all([
    db.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.patientId, patientId), isNull(appointments.deletedAt))),
    db.select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.patientId, patientId))).orderBy(desc(attendances.performedAt)),
    followupIds.length ? db.select().from(payments).where(and(eq(payments.tenantId, tenantId), inArray(payments.followupId, followupIds), isNull(payments.deletedAt))) : [],
    db.select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.patientId, patientId))),
  ]);
  const itemRows = followupIds.length ? await db.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), inArray(followupItems.followupId, followupIds))) : [];
  const now = new Date();
  const answers = (row: any) => row.answersCiphertext ? JSON.parse(decryptValue({ ciphertext: row.answersCiphertext, nonce: row.answersNonce, keyVersion: row.answersKeyVersion }, buildProtectedAad(tenantId, 'applied_anamneses', row.id, 'answers'))) : undefined;
const anamnesisDetails = (row: any) => ({ id: row.id, _id: row.id, patientId: row.patientId, followupId: row.followupId, anamnesisId: row.anamnesisId, version: row.version, title: row.titleSnapshot, titleSnapshot: row.titleSnapshot, schemaSnapshot: row.schemaSnapshot, required: row.required, submittedAt: row.submittedAt, validUntil: row.validUntil, createdAt: row.createdAt, answers: answers(row) });
  const events: any[] = [
    ...followupRows.map((row) => ({ type: 'followup', at: row.createdAt, title: `Acompanhamento: ${row.offerNameSnapshot}`, details: { ...idShape(row), offerName: row.offerNameSnapshot, items: itemRows.filter((item) => item.followupId === row.id).map(idShape) } })),
    ...appointmentRows.map((row) => ({ type: 'appointment', at: row.startsAt, title: `Agendamento · ${({ planned: 'agendado', confirmed: 'confirmado', rescheduled: 'remarcado', cancelled: 'cancelado', no_show: 'faltou' } as Record<string, string>)[row.status] ?? row.status}`, details: idShape(row) })),
    ...attendanceRows.map((row) => ({ type: 'attendance', at: row.performedAt, title: `${row.procedureName} realizado`, details: idShape(row) })),
    ...paymentRows.map((row) => ({ type: 'payment', at: row.receivedAt, title: `Pagamento ${row.method}`, details: readPayment(row) })),
    ...anamnesisRows.map((row) => {
      const answered = row.submittedAt !== null;
      const expired = row.validUntil !== null && row.validUntil < now;
      const status = answered ? (expired ? 'vencida' : 'respondida') : 'pendente';
      return { type: 'anamnesis', at: row.submittedAt ?? row.createdAt, title: `${row.titleSnapshot} · ${status}`, details: anamnesisDetails(row) };
    }),
  ];
  const pending = events.filter((event) => (event.type === 'appointment' && event.details.status === 'planned') || (event.type === 'anamnesis' && /pendente|vencida/.test(event.title)));
  return { patient: patientResponse(patient, actorId), events: events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), pending };
}
