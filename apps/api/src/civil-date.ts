// Data civil (AAAA-MM-DD) no fuso da clínica. O evento é um dia civil da clínica,
// então instantes (agendamento, atendimento) são comparados nesse fuso.
export const clinicTimeZone = () => process.env.CLINIC_TIME_ZONE?.trim() || 'America/Sao_Paulo';
export const civilDateOf = (instant: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: clinicTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
