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
export const duration = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}` : `${minutes}min`);
export const shortDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');
export const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');

export const offerKinds = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano' } as const;
export const offerLabel = (type: keyof typeof offerKinds, name: string) => `${offerKinds[type]} - ${name}`;
