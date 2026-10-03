import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { anamneses, appliedAnamneses, appointments, attendances, followupItems, followups, getDatabase, patients, payments } from '@clinicare/db';
import { paymentResponse as readPayment } from './payments';

const idShape = (row: any) => ({ ...row, _id: row.id });

export async function getRelationalHistory(tenantId: string, patientId: string) {
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
  const anamnesisIds = [...new Set(anamnesisRows.map((row) => row.anamnesisId))];
  const anamnesisTitles = anamnesisIds.length ? await db.select({ id: anamneses.id, title: anamneses.title }).from(anamneses).where(and(eq(anamneses.tenantId, tenantId), inArray(anamneses.id, anamnesisIds))) : [];
  const now = new Date();
  const events: any[] = [
    ...followupRows.map((row) => ({ type: 'followup', at: row.createdAt, title: `Acompanhamento: ${row.offerNameSnapshot}`, details: { ...idShape(row), offerName: row.offerNameSnapshot, items: itemRows.filter((item) => item.followupId === row.id).map(idShape) } })),
    ...appointmentRows.map((row) => ({ type: 'appointment', at: row.startsAt, title: `Agendamento · ${({ planned: 'agendado', confirmed: 'confirmado', rescheduled: 'remarcado', cancelled: 'cancelado', no_show: 'faltou' } as Record<string, string>)[row.status] ?? row.status}`, details: idShape(row) })),
    ...attendanceRows.map((row) => ({ type: 'attendance', at: row.performedAt, title: `${row.procedureName} realizado`, details: idShape(row) })),
    ...paymentRows.map((row) => ({ type: 'payment', at: row.receivedAt, title: `Pagamento ${row.method}`, details: readPayment(row) })),
    ...anamnesisRows.map((row) => {
      const answered = row.submittedAt !== null;
      const expired = row.validUntil !== null && row.validUntil < now;
      const status = answered ? (expired ? 'vencida' : 'respondida') : 'pendente';
      return { type: 'anamnesis', at: row.submittedAt ?? row.createdAt, title: `${anamnesisTitles.find((title) => title.id === row.anamnesisId)?.title ?? row.titleSnapshot} · ${status}`, details: idShape(row) };
    }),
  ];
  const pending = events.filter((event) => (event.type === 'appointment' && event.details.status === 'planned') || (event.type === 'anamnesis' && /pendente|vencida/.test(event.title)));
  return { patient: { _id: patient.id, id: patient.id, fullName: patient.fullName, email: null, phone: null, cpf: null, notes: null, active: !patient.deletedAt, createdAt: patient.createdAt, updatedAt: patient.updatedAt }, events: events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), pending };
}
