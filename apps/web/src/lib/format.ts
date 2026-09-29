export const currency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR');

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';
export const appointmentStatus: Record<string, { label: string; tone: Tone }> = {
  planned: { label: 'Agendado', tone: 'neutral' },
  confirmed: { label: 'Confirmado', tone: 'success' },
  rescheduled: { label: 'Remarcado', tone: 'warning' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  no_show: { label: 'Faltou', tone: 'danger' },
};
export const statusLabel = (status: string) => appointmentStatus[status]?.label ?? status;
export const statusTone = (status: string): Tone => appointmentStatus[status]?.tone ?? 'neutral';
export const photoPhases = { before: 'Antes', during: 'Durante', after: 'Depois' } as const;
