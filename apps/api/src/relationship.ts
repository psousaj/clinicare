const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// Métricas de relacionamento de um paciente, calculadas a partir dos acompanhamentos, sessões, pagamentos e agendamentos.
export function buildRelationship(followups: any[], attendances: any[], payments: any[], appointments: any[], now = new Date()) {
  const paidBy = new Map<string, number>();
  for (const payment of payments) paidBy.set(String(payment.followupId), (paidBy.get(String(payment.followupId)) ?? 0) + payment.amountCents);

  const followupRows = followups.map((followup) => {
    const paidCents = paidBy.get(String(followup._id)) ?? 0;
    const sessionsTotal = sum(followup.items.map((item: any) => item.sessionsTotal));
    const sessionsPerformed = sum(followup.items.map((item: any) => item.sessionsPerformed ?? 0));
    // Evento não tem preço contratado: priceCents já é o valor realizado (baixado), sem proporção por sessões.
    const isEvent = followup.offerType === 'event';
    const performedValue = isEvent ? followup.priceCents : sessionsTotal ? Math.round((followup.priceCents * sessionsPerformed) / sessionsTotal) : 0;
    return {
      id: String(followup._id), offerName: followup.offerName, priceCents: followup.priceCents, isEvent, paidCents,
      pendingCents: Math.max(0, followup.priceCents - paidCents), dueForPerformedCents: Math.max(0, performedValue - paidCents), sessionsTotal, sessionsPerformed,
    };
  });

  const performedAt = attendances.map((attendance) => new Date(attendance.performedAt).getTime()).sort((a, b) => a - b);
  const gaps = performedAt.slice(1).map((time, index) => (time - performedAt[index]) / 86400000);
  const upcoming = appointments.filter((appointment) => appointment.startsAt > now && ['planned', 'confirmed', 'rescheduled'].includes(appointment.status)).map((appointment) => appointment.startsAt.getTime()).sort((a, b) => a - b);

  const months = new Map<string, { attendances: number; minutes: number; paidCents: number }>();
  const bucket = (date: Date) => {
    const key = monthKey(date);
    if (!months.has(key)) months.set(key, { attendances: 0, minutes: 0, paidCents: 0 });
    return months.get(key)!;
  };
  for (const attendance of attendances) { const row = bucket(new Date(attendance.performedAt)); row.attendances += 1; row.minutes += attendance.durationMinutes ?? 0; }
  for (const payment of payments) bucket(new Date(payment.receivedAt)).paidCents += payment.amountCents;
  const monthly: { month: string; attendances: number; minutes: number; paidCents: number }[] = [];
  if (months.size) {
    const first = new Date([...months.keys()].sort()[0] + '-01T12:00:00');
    const cursor = new Date(Math.max(first.getTime(), new Date(now.getFullYear(), now.getMonth() - 11, 1, 12).getTime()));
    for (; monthKey(cursor) <= monthKey(now); cursor.setMonth(cursor.getMonth() + 1)) monthly.push({ month: monthKey(cursor), ...(months.get(monthKey(cursor)) ?? { attendances: 0, minutes: 0, paidCents: 0 }) });
  }

  const byProcedure = new Map<string, { name: string; attendances: number; minutes: number }>();
  for (const attendance of attendances) {
    const row = byProcedure.get(attendance.procedureName) ?? { name: attendance.procedureName, attendances: 0, minutes: 0 };
    row.attendances += 1; row.minutes += attendance.durationMinutes ?? 0;
    byProcedure.set(attendance.procedureName, row);
  }

  const paidCents = sum(followupRows.map((row) => row.paidCents));
  const contractedCents = sum(followupRows.filter((row) => !row.isEvent).map((row) => row.priceCents));
  return {
    totals: {
      followups: followups.length, attendancesPerformed: attendances.length, attendancesContracted: sum(followupRows.map((row) => row.sessionsTotal)),
      minutesTotal: sum(attendances.map((attendance) => attendance.durationMinutes ?? 0)), attendancesWithoutDuration: attendances.filter((attendance) => !attendance.durationMinutes).length,
      contractedCents, paidCents, pendingCents: sum(followupRows.map((row) => row.pendingCents)), dueForPerformedCents: sum(followupRows.map((row) => row.dueForPerformedCents)),
      noShows: appointments.filter((appointment) => appointment.status === 'no_show').length,
    },
    firstAttendanceAt: performedAt.length ? new Date(performedAt[0]) : null,
    lastAttendanceAt: performedAt.length ? new Date(performedAt.at(-1)!) : null,
    nextAppointmentAt: upcoming.length ? new Date(upcoming[0]) : null,
    averageIntervalDays: gaps.length ? Math.round((sum(gaps) / gaps.length) * 10) / 10 : null,
    monthly,
    followups: followupRows,
    procedures: [...byProcedure.values()].sort((a, b) => b.attendances - a.attendances),
  };
}
