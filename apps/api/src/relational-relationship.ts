import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { appointments, attendances, followupItems, followups, getDatabase, patients, payments } from '@clinicare/db';
import { buildRelationship } from './relationship';
import { paymentResponse } from './payments';

const response = (row: any) => ({ ...row, _id: row.id });

export async function getRelationalRelationship(tenantId: string, patientId: string) {
  const db = getDatabase();
  const patient = (await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId), isNull(patients.deletedAt))))[0];
  if (!patient) return null;
  const followupRows = await db.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.patientId, patientId)));
  const followupIds = followupRows.map((row) => row.id);
  const [attendanceRows, appointmentRows, paymentRows] = await Promise.all([
    db.select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.patientId, patientId), eq(attendances.status, 'performed'))).orderBy(asc(attendances.performedAt)),
    db.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.patientId, patientId), isNull(appointments.deletedAt))),
    followupIds.length ? db.select().from(payments).where(and(eq(payments.tenantId, tenantId), inArray(payments.followupId, followupIds), isNull(payments.deletedAt))) : [],
  ]);
  const itemRows = followupIds.length ? await db.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), inArray(followupItems.followupId, followupIds))) : [];
  const followupViews = followupRows.map((row) => ({ ...response(row), offerName: row.offerNameSnapshot, items: itemRows.filter((item) => item.followupId === row.id).map(response) }));
  return buildRelationship(followupViews, attendanceRows.map(response), paymentRows.map(paymentResponse), appointmentRows.map(response));
}
