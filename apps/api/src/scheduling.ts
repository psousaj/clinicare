import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  buildProtectedAad, decryptValue, encryptValue, getDatabase,
  followupItems, followups, patients, procedures, appointments, appointmentItems, attendances, attendancePhotos,
} from '@clinicare/db';
import { downloadUrl, uploadUrl } from './storage';
import { civilDateOf } from './civil-date';

const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });
const activeAppointmentStatuses = ['planned', 'confirmed', 'rescheduled'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idShape = (row: any) => ({ ...row, _id: row.id });
const photoShape = (tenantId: string, row: any) => ({ id: row.id, _id: row.id, attendanceId: row.attendanceId, objectKey: row.objectKey, contentHash: row.contentHash, phase: row.phase, notes: unprotect(row, tenantId, 'attendance_photos', row.id, 'notes'), createdAt: row.createdAt });
const validUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const uploadSecret = () => {
  const secret = process.env.UPLOAD_SIGNING_KEY;
  if (!secret) throw new Error('UPLOAD_SIGNING_KEY is required for photo uploads.');
  return secret;
};
const photoUploadToken = (tenantId: string, attendanceId: string, key: string, contentHash = '') => createHmac('sha256', uploadSecret()).update(`${tenantId}:${attendanceId}:${key}:${contentHash}`).digest('base64url');

const protect = (tenantId: string, table: string, id: string, column: string, value: unknown) => {
  if (value == null || (typeof value === 'string' && !value.trim())) return { [`${column}Ciphertext`]: null, [`${column}Nonce`]: null, [`${column}KeyVersion`]: null };
  const encrypted = encryptValue(typeof value === 'string' ? value : JSON.stringify(value), buildProtectedAad(tenantId, table, id, column));
  return { [`${column}Ciphertext`]: encrypted.ciphertext, [`${column}Nonce`]: encrypted.nonce, [`${column}KeyVersion`]: encrypted.keyVersion };
};

function unprotect(row: any, tenantId: string, table: string, id: string, column: string): unknown {
  const ciphertext = row[`${column}Ciphertext`], nonce = row[`${column}Nonce`], keyVersion = row[`${column}KeyVersion`];
  if (!ciphertext) return null;
  if (!nonce || !keyVersion) throw new Error(`Invalid encrypted ${table} ${column} value.`);
  const value = decryptValue({ ciphertext, nonce, keyVersion }, buildProtectedAad(tenantId, table, id, column));
  if (column === 'data') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function appointmentResponse(row: any, items: any[]) {
  return { id: row.id, _id: row.id, tenantId: row.tenantId, patientId: row.patientId, startsAt: row.startsAt, endsAt: row.endsAt, status: row.status, noShowReason: row.noShowReason, deletedAt: row.deletedAt, createdAt: row.createdAt, updatedAt: row.updatedAt, notes: unprotect(row, row.tenantId, 'appointments', row.id, 'notes'), items: items.map(idShape) };
}
function attendanceShape(row: any) {
  return { id: row.id, _id: row.id, tenantId: row.tenantId, patientId: row.patientId, followupId: row.followupId, followupItemId: row.followupItemId, appointmentId: row.appointmentId, procedureId: row.procedureId, procedureName: row.procedureName, performedAt: row.performedAt, durationMinutes: row.durationMinutes, schemaSnapshot: row.schemaSnapshot, status: row.status, cancellationReason: row.cancellationReason, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
async function attendanceResponse(row: any, executor = getDatabase()) {
  const photos = await executor.select().from(attendancePhotos)
    .where(and(eq(attendancePhotos.tenantId, row.tenantId), eq(attendancePhotos.attendanceId, row.id), isNull(attendancePhotos.deletedAt)))
    .orderBy(asc(attendancePhotos.createdAt));
  return { ...attendanceShape(row), data: unprotect(row, row.tenantId, 'attendances', row.id, 'data'), notes: unprotect(row, row.tenantId, 'attendances', row.id, 'notes'), photos: await Promise.all(photos.map(async (photo: any) => ({ ...photoShape(row.tenantId, photo), url: await downloadUrl(photo.objectKey) }))) };
}

async function readAppointment(tenantId: string, id: string, executor: any) {
  const row = (await executor.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))).at(0);
  if (!row) return null;
  const items = await executor.select().from(appointmentItems)
    .where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.appointmentId, id)))
    .orderBy(asc(appointmentItems.createdAt));
  return appointmentResponse(row, items);
}

async function lockAppointment(tx: any, tenantId: string, id: string) {
  const result = await tx.execute(sql`select id from appointments where tenant_id = ${tenantId} and id = ${id} for update`);
  return result.rows?.length > 0;
}
async function lockItems(tx: any, tenantId: string, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.execute(sql`select id from followup_items where tenant_id = ${tenantId} and id = ${id} for update`);
}
async function reservationCount(tx: any, tenantId: string, itemId: string, excludeAppointmentId?: string) {
  const rows = await tx.select({ total: sql<number>`coalesce(sum(${appointmentItems.quantity}), 0)` })
    .from(appointmentItems)
    .innerJoin(appointments, and(eq(appointments.tenantId, appointmentItems.tenantId), eq(appointments.id, appointmentItems.appointmentId)))
    .where(and(
      eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.followupItemId, itemId),
      inArray(appointments.status, [...activeAppointmentStatuses]), isNull(appointments.deletedAt),
      sql`${appointmentItems.confirmationStatus} <> 'deselected'`,
      excludeAppointmentId ? sql`${appointments.id} <> ${excludeAppointmentId}` : sql`true`,
    ));
  return Number(rows[0]?.total ?? 0);
}

export async function listAppointments(tenantId: string, from: Date, to: Date) {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) throw invalid('Período de agendamentos inválido.');
  const rows = await getDatabase().select().from(appointments).where(and(
    eq(appointments.tenantId, tenantId), sql`${appointments.startsAt} >= ${from}`, sql`${appointments.startsAt} < ${to}`,
    isNull(appointments.deletedAt), inArray(appointments.status, [...activeAppointmentStatuses]),
  )).orderBy(asc(appointments.startsAt));
  const items = rows.length ? await getDatabase().select().from(appointmentItems).where(and(eq(appointmentItems.tenantId, tenantId), inArray(appointmentItems.appointmentId, rows.map((row) => row.id)))) : [];
  return rows.map((row) => appointmentResponse(row, items.filter((item) => item.appointmentId === row.id)));
}

export async function createAppointment(tenantId: string, input: any) {
  if (!validUuid(input?.patientId) || !Array.isArray(input?.items) || !input.items.length) throw invalid('Agendamento inválido.');
  const startsAt = new Date(input.startsAt), endsAt = new Date(input.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw invalid('Agendamento inválido.');
  return getDatabase().transaction(async (tx) => {
    const patient = (await tx.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, input.patientId), isNull(patients.deletedAt)))).at(0);
    if (!patient) throw notFound('Paciente não encontrado.');
    await lockItems(tx, tenantId, input.items.map((item: any) => item.followupItemId).filter(validUuid));
    const normalized: any[] = [], seen = new Set<string>(); let minutes = 0;
    for (const entry of input.items) {
      const quantity = entry?.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1) throw invalid('Agendamento inválido.');
      const key = entry.followupItemId ?? entry.procedureId;
      if (!validUuid(key) || seen.has(key)) throw invalid('Procedimento repetido no agendamento; use a quantidade.');
      seen.add(key);
      if (validUuid(entry.followupItemId)) {
        const item = (await tx.select({ item: followupItems, followup: followups }).from(followupItems)
          .innerJoin(followups, and(eq(followups.tenantId, followupItems.tenantId), eq(followups.id, followupItems.followupId)))
          .where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.id, entry.followupItemId), eq(followups.patientId, input.patientId)))).at(0);
        if (!item || item.followup.status !== 'active') throw notFound('Procedimento não pertence a um acompanhamento ativo deste paciente.');
        assertEventDay(item.followup, startsAt);
        const reserved = await reservationCount(tx, tenantId, item.item.id);
        if (quantity > item.item.sessionsTotal - item.item.sessionsPerformed - reserved) throw conflict(`${item.item.procedureName}: sessões insuficientes para reservar.`);
        minutes += quantity * item.item.durationMinutes;
        normalized.push({ tenantId, followupId: item.item.followupId, followupItemId: item.item.id, procedureId: item.item.procedureId, procedureName: item.item.procedureName, quantity, minutesEach: item.item.durationMinutes });
      } else {
        const procedure = (await tx.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, entry.procedureId), eq(procedures.active, true)))).at(0);
        if (!procedure || !procedure.standalone) throw notFound('Procedimento não encontrado.');
        if (quantity !== 1) throw conflict(`${procedure.name}: procedimento avulso permite uma única sessão.`);
        minutes += procedure.durationMinutes;
        normalized.push({ tenantId, procedureId: procedure.id, procedureName: procedure.name, quantity, minutesEach: procedure.durationMinutes });
      }
    }
    const capacity = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
    if (minutes > capacity) throw conflict(`Os procedimentos somam ${minutes} min e o agendamento tem ${capacity} min.`);
    const id = crypto.randomUUID();
    await tx.insert(appointments).values({ id, tenantId, patientId: input.patientId, startsAt, endsAt, status: 'planned', ...protect(tenantId, 'appointments', id, 'notes', input.notes) });
    await tx.insert(appointmentItems).values(normalized.map((item) => ({ ...item, appointmentId: id })));
    return readAppointment(tenantId, id, tx);
  });
}

// Evento: execução só no dia civil do evento (fuso da clínica); não sobra execução para depois.
function assertEventDay(followup: { offerType: string; eventDate: string | null }, instant: Date) {
  if (followup.offerType === 'event' && followup.eventDate && civilDateOf(instant) !== followup.eventDate) throw conflict('Acompanhamento de evento só pode ser agendado ou realizado na data do evento.');
}

// Valor realizado do evento: sessão de procedimento avulso pelo preço da sessão; combo pelo preço do pacote, uma vez, quando todo o pacote foi realizado.
function eventRealizedCents(items: any[]) {
  let total = 0;
  const packages = new Map<string, any[]>();
  for (const item of items) {
    if (!item.comboId) total += item.sessionsPerformed * item.priceCents;
    else packages.set(item.comboId, [...(packages.get(item.comboId) ?? []), item]);
  }
  for (const rows of packages.values()) if (rows.every((row) => row.sessionsPerformed >= row.sessionsTotal)) total += rows[0].packagePriceCents ?? 0;
  return total;
}

// Combo escolhido é pacote fechado: o ato de baixa precisa cobrir todas as sessões restantes de todos os itens do combo.
async function assertAtomicCombos(tx: any, tenantId: string, chosen: any[]) {
  const quantityByItem = new Map<string, number>();
  for (const item of chosen) if (item.followupItemId) quantityByItem.set(item.followupItemId, (quantityByItem.get(item.followupItemId) ?? 0) + (item.quantity ?? 1));
  const picked = quantityByItem.size ? await tx.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), inArray(followupItems.id, [...quantityByItem.keys()]))) : [];
  const checked = new Set<string>();
  for (const row of picked.filter((entry: any) => entry.comboId)) {
    const key = `${row.followupId}:${row.comboId}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const owner = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, row.followupId)))).at(0);
    if (owner?.offerType !== 'event') continue;
    const pack = await tx.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.followupId, row.followupId), eq(followupItems.comboId, row.comboId)));
    if (pack.some((member: any) => (quantityByItem.get(member.id) ?? 0) !== member.sessionsTotal - member.sessionsPerformed)) throw conflict(`${row.comboName}: o combo é um pacote fechado e deve ser baixado inteiro, com todas as sessões restantes de todos os procedimentos no mesmo ato.`);
  }
}

async function recomputeFollowup(tx: any, tenantId: string, followupId: string) {
  const items = await tx.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.followupId, followupId)));
  const owner = (await tx.select({ offerType: followups.offerType }).from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)))).at(0);
  if (owner?.offerType === 'event') await tx.update(followups).set({ priceCents: eventRealizedCents(items) }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
  const complete = items.length > 0 && items.every((item: any) => item.sessionsPerformed >= item.sessionsTotal);
  await tx.update(followups).set({
    status: sql`case when ${followups.status} = 'cancelled' then 'cancelled' when ${complete} then 'completed' else 'active' end`,
    completedAt: sql`case when ${followups.status} = 'cancelled' then ${followups.completedAt} when ${complete} then coalesce(${followups.completedAt}, now()) else null end`,
    updatedAt: new Date(),
  }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
}

export async function updateAppointment(tenantId: string, id: string, input: any) {
  return getDatabase().transaction(async (tx) => {
    if (!validUuid(id) || !(await lockAppointment(tx, tenantId, id))) return null;
    const existing = (await tx.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))).at(0);
    if (!existing) return null;
    const status = input?.status;
    if (status === 'no_show' && (typeof input?.reason !== 'string' || !input.reason.trim())) throw invalid('Informe o motivo do não comparecimento.');
    if (status && !['planned', 'confirmed', 'rescheduled', 'cancelled', 'no_show'].includes(status)) throw invalid('Status de agendamento inválido.');
    // Confirmation creates attendances and advances contracted sessions atomically. It
    // must go through /confirm rather than being smuggled into a generic PATCH.
    if (status === 'confirmed') throw conflict('Use a rota de confirmação para confirmar o agendamento.');
    if (status === 'no_show' && existing.endsAt > new Date()) throw conflict('Um agendamento só pode ser marcado como falta depois do horário final.');
    if (status === 'confirmed' && existing.status === 'confirmed') throw conflict('Agendamento já confirmado.');
    if (status === 'confirmed' && !['planned', 'rescheduled'].includes(existing.status)) throw conflict('Somente agendamentos planejados ou remarcados podem ser confirmados.');
    if (existing.status === 'confirmed' && status === 'cancelled') throw conflict('Atendimentos confirmados não podem ser excluídos ou cancelados.');
    if (['cancelled', 'no_show'].includes(existing.status) && status && status !== existing.status) throw conflict('Agendamento já encerrado.');
    if (status === 'cancelled' && ['cancelled', 'no_show'].includes(existing.status)) throw conflict('Agendamento já encerrado.');
    if (status === 'no_show' && ['cancelled', 'no_show', 'confirmed'].includes(existing.status)) throw conflict('Estado do agendamento não permite marcar falta.');
    const startsAt = input?.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input?.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (!(endsAt > startsAt)) throw invalid('O fim deve ser depois do início.');
    const items = await tx.select().from(appointmentItems).where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.appointmentId, id)));
    await lockItems(tx, tenantId, items.map((item: any) => item.followupItemId).filter((value: unknown): value is string => !!value));
    if (status === 'planned' || status === 'rescheduled' || input?.startsAt) {
      for (const item of items.filter((x: any) => x.followupItemId && x.confirmationStatus !== 'deselected')) {
        const row = (await tx.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.id, item.followupItemId!)))).at(0);
        const owner = row ? (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, row.followupId)))).at(0) : null;
        if (owner) assertEventDay(owner, startsAt);
        if (!row || item.quantity > row.sessionsTotal - row.sessionsPerformed - await reservationCount(tx, tenantId, item.followupItemId!, id)) throw conflict('Sessões insuficientes para o reagendamento.');
      }
    }
    await tx.update(appointments).set({ startsAt, endsAt, ...(status ? { status, noShowReason: status === 'no_show' ? input.reason.trim() : null } : {}), updatedAt: new Date() }).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)));
    return readAppointment(tenantId, id, tx);
  });
}
export async function deleteAppointment(tenantId: string, id: string) { return updateAppointment(tenantId, id, { status: 'cancelled' }); }

export async function listAttendances(tenantId: string) {
  const rows = await getDatabase().select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.status, 'performed'))).orderBy(desc(attendances.performedAt));
  return Promise.all(rows.map((row) => attendanceResponse(row)));
}

export async function getAttendance(tenantId: string, id: string) {
  if (!validUuid(id)) throw notFound('Atendimento não encontrado.');
  const row = (await getDatabase().select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, id)))).at(0);
  return row ? attendanceResponse(row) : null;
}

export async function updateAttendance(tenantId: string, id: string, input: any) {
  if (!validUuid(id)) throw notFound('Atendimento não encontrado.');
  const duration = input?.durationMinutes;
  if (duration !== undefined && duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) throw invalid('A duração deve estar entre 1 e 1440 minutos.');
  if (input?.data !== undefined && input.data !== null && (typeof input.data !== 'object' || Array.isArray(input.data))) throw invalid('Dados do atendimento inválidos.');
  if (input?.notes !== undefined && input.notes !== null && typeof input.notes !== 'string') throw invalid('Observações do atendimento inválidas.');
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select id from attendances where tenant_id = ${tenantId} and id = ${id} for update`);
    const existing = (await tx.select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, id)))).at(0);
    if (!existing) return null;
    if (existing.status !== 'performed') throw conflict('Atendimentos cancelados não podem ser alterados.');
    const patch: any = { updatedAt: new Date() };
    if (duration !== undefined) patch.durationMinutes = duration;
    if (input?.data !== undefined) Object.assign(patch, protect(tenantId, 'attendances', id, 'data', input.data));
    if (input?.notes !== undefined) Object.assign(patch, protect(tenantId, 'attendances', id, 'notes', input.notes));
    const changed = (await tx.update(attendances).set(patch).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, id), eq(attendances.status, 'performed'))).returning()).at(0);
    return changed ? attendanceResponse(changed, tx) : null;
  });
}

async function perform(tx: any, tenantId: string, appointmentId: string | null, selected: string[] | undefined, input: any, returnAttendance = false) {
  if (input?.durationMinutes !== undefined && input.durationMinutes !== null && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440)) throw invalid('A duração deve estar entre 1 e 1440 minutos.');
  if (input?.performedAt !== undefined && !Number.isFinite(new Date(input.performedAt).getTime())) throw invalid('Data do atendimento inválida.');
  let appointment = appointmentId ? (await tx.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId)))).at(0) : null;
  if (appointmentId && (!appointment || !(await lockAppointment(tx, tenantId, appointmentId)))) throw notFound('Agendamento não encontrado.');
  if (appointmentId) appointment = (await tx.select().from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId)))).at(0);
  if (appointmentId && !appointment) throw notFound('Agendamento não encontrado.');
  if (appointment && !['planned', 'rescheduled'].includes(appointment.status)) throw conflict('Somente agendamentos planejados ou remarcados podem ser confirmados.');
  const items: any[] = appointmentId
    ? await tx.select().from(appointmentItems).where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.appointmentId, appointmentId))).orderBy(asc(appointmentItems.id))
    : input?.followupItemId ? [{ id: null, followupItemId: input.followupItemId, quantity: 1 }] : [];
  const directPatientId = appointment?.patientId ?? input?.patientId;
  if (!validUuid(directPatientId)) throw invalid('Paciente é obrigatório.');
  if (selected) {
    if (!selected.length || selected.some((id) => !validUuid(id)) || new Set(selected).size !== selected.length) throw notFound('Item de agendamento não encontrado.');
    const ids = new Set(items.map((item) => item.id));
    if (selected.some((id) => !ids.has(id))) throw notFound('Item de agendamento não encontrado.');
  }
  const chosen = items.filter((item: any) => !selected || selected.includes(item.id));
  if (!chosen.length) throw invalid('Selecione ao menos um item.');
  await lockItems(tx, tenantId, chosen.map((item: any) => item.followupItemId).filter((value: any): value is string => !!value));
  await assertAtomicCombos(tx, tenantId, chosen);
  if (selected && appointmentId) {
    for (const item of items) if (!selected.includes(item.id)) {
      await tx.update(appointmentItems).set({ confirmationStatus: 'deselected' }).where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.id, item.id)));
    }
  }
  let firstAttendance: any = null;
  for (const item of chosen) {
    const current = item.followupItemId ? (await tx.select({ item: followupItems, followup: followups }).from(followupItems).innerJoin(followups, and(eq(followups.tenantId, followupItems.tenantId), eq(followups.id, followupItems.followupId))).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.id, item.followupItemId), eq(followups.patientId, directPatientId)))).at(0) : null;
    if (item.followupItemId && (!current || current.followup.status !== 'active')) throw notFound('Procedimento não pertence ao paciente deste atendimento.');
    if (current) assertEventDay(current.followup, input?.performedAt ? new Date(input.performedAt) : new Date());
    const repetitions = item.quantity ?? 1;
    for (let occurrence = 0; occurrence < repetitions; occurrence++) {
      if (current && current.item.sessionsPerformed + 1 > current.item.sessionsTotal) throw conflict(`${current.item.procedureName}: todas as sessões já foram realizadas.`);
      const aid = crypto.randomUUID();
      const [createdAttendance] = await tx.insert(attendances).values({ id: aid, tenantId, patientId: directPatientId, followupId: current?.item.followupId ?? null, followupItemId: current?.item.id ?? null, appointmentId, procedureId: current?.item.procedureId ?? item.procedureId, procedureName: current?.item.procedureName ?? item.procedureName, performedAt: input?.performedAt ? new Date(input.performedAt) : new Date(), durationMinutes: input?.durationMinutes ?? current?.item.durationMinutes ?? item.minutesEach, schemaSnapshot: current?.item.sessionSchema ?? {}, status: 'performed', ...protect(tenantId, 'attendances', aid, 'data', input?.data ?? null), ...protect(tenantId, 'attendances', aid, 'notes', input?.notes ?? null) }).returning();
      firstAttendance ??= createdAttendance;
      if (current) {
        await tx.update(followupItems).set({ sessionsPerformed: sql`${followupItems.sessionsPerformed} + 1` }).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.id, current.item.id)));
        await recomputeFollowup(tx, tenantId, current.item.followupId);
      }
    }
    if (item.id) await tx.update(appointmentItems).set({ confirmationStatus: 'confirmed' }).where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.id, item.id)));
  }
  if (appointment) await tx.update(appointments).set({ status: 'confirmed', updatedAt: new Date() }).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointment.id)));
  if (returnAttendance && firstAttendance) return attendanceResponse(firstAttendance, tx);
  return appointmentId ? readAppointment(tenantId, appointmentId, tx) : null;
}

export async function createAttendance(tenantId: string, input: any) {
  if (!input?.appointmentId && !validUuid(input?.followupItemId)) throw notFound('Procedimento contratado não encontrado.');
  return getDatabase().transaction((tx) => perform(tx, tenantId, input.appointmentId ?? null, undefined, input, true));
}
export async function confirmAppointment(tenantId: string, id: string, selected?: string[]) {
  return getDatabase().transaction((tx) => perform(tx, tenantId, id, selected, {}));
}
export async function presignAttendancePhoto(tenantId: string, attendanceId: string, contentType: string, contentHash: string | null) {
  if (!validUuid(attendanceId) || !/^image\/(jpeg|png|webp)$/.test(contentType)) throw invalid('Imagem inválida.');
  const attendance = (await getDatabase().select({ id: attendances.id }).from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, attendanceId)))).at(0);
  if (!attendance) throw notFound('Atendimento não encontrado.');
  const key = randomUUID(), signedUploadUrl = await uploadUrl(key, contentType);
  return { uploadUrl: signedUploadUrl, objectKey: key, uploadToken: photoUploadToken(tenantId, attendanceId, key, contentHash ?? ''), expiresInSeconds: 300 };
}

export async function addAttendancePhoto(tenantId: string, attendanceId: string, input: any) {
  if (!validUuid(attendanceId)) throw notFound('Atendimento não encontrado.');
  if (!input || typeof input.objectKey !== 'string' || !/^[\w-]{20,}$/.test(input.objectKey) || typeof input.uploadToken !== 'string' || !['before', 'during', 'after'].includes(input.phase)) throw invalid('Foto inválida.');
  const expected = photoUploadToken(tenantId, attendanceId, input.objectKey, typeof input.contentHash === 'string' ? input.contentHash : '');
  const provided = Buffer.from(input.uploadToken), wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) throw notFound('Upload de foto não autorizado.');
  const attendance = (await getDatabase().select({ id: attendances.id }).from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, attendanceId)))).at(0);
  if (!attendance) throw notFound('Atendimento não encontrado.');
  const id = randomUUID();
  const [photo] = await getDatabase().insert(attendancePhotos).values({ id, tenantId, attendanceId, objectKey: input.objectKey, contentHash: input.contentHash ?? null, phase: input.phase, ...protect(tenantId, 'attendance_photos', id, 'notes', input.notes ?? null) }).returning();
  return photoShape(tenantId, photo);
}

export async function removeAttendancePhoto(tenantId: string, attendanceId: string, photoId: string) {
  if (!validUuid(attendanceId) || !validUuid(photoId)) throw notFound('Foto não encontrada.');
  const photo = (await getDatabase().select().from(attendancePhotos).where(and(
    eq(attendancePhotos.tenantId, tenantId), eq(attendancePhotos.attendanceId, attendanceId), eq(attendancePhotos.id, photoId), isNull(attendancePhotos.deletedAt),
  ))).at(0);
  if (!photo) throw notFound('Foto não encontrada.');
  await getDatabase().update(attendancePhotos).set({ deletedAt: new Date() }).where(and(eq(attendancePhotos.tenantId, tenantId), eq(attendancePhotos.id, photoId)));
  return { deleted: true, objectKey: photo.objectKey };
}

export async function cancelAttendance(tenantId: string, id: string, reason: string) {
  if (!reason.trim()) throw invalid('Motivo do cancelamento é obrigatório.');
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select id from attendances where tenant_id = ${tenantId} and id = ${id} for update`);
    const row = (await tx.select().from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, id), eq(attendances.status, 'performed')))).at(0);
    if (!row) throw notFound('Atendimento não encontrado.');
    const changed = (await tx.update(attendances).set({ status: 'cancelled', cancellationReason: reason.trim(), updatedAt: new Date() }).where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, id), eq(attendances.status, 'performed'))).returning()).at(0);
    if (!changed) throw notFound('Atendimento já cancelado.');
    if (row.followupItemId) {
      await tx.execute(sql`select id from followup_items where tenant_id = ${tenantId} and id = ${row.followupItemId} for update`);
      const performed = (await tx.select({ count: sql<number>`count(*)` }).from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.followupItemId, row.followupItemId), eq(attendances.status, 'performed')))).at(0);
      await tx.update(followupItems).set({ sessionsPerformed: Number(performed?.count ?? 0) }).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.id, row.followupItemId)));
      if (row.followupId) await recomputeFollowup(tx, tenantId, row.followupId);
    }
    return attendanceResponse(changed, tx);
  });
}
