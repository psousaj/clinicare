import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from './api';
import { anamnesisSchema, anySchema, appointmentSchema, contractSchema, createdSchema, comboSchema, planSchema, patientHistorySchema, relationshipSchema, patientSchema, followupSchema, procedureSchema, publicFormSchema, requestSchema, attendanceSchema, signaturePendingSchema } from './schemas';

export const keys = {
  patients: ['patients'] as const,
  procedures: ['procedures'] as const,
  anamneses: ['anamneses'] as const,
  contracts: ['contracts'] as const,
  combos: ['combos'] as const,
  plans: ['plans'] as const,
  followups: ['followups'] as const,
  appointments: ['appointments'] as const,
  history: (patientId: string) => ['patients', patientId, 'history'] as const,
  attendances: ['attendances'] as const,
  relationship: (patientId: string) => ['patients', patientId, 'relationship'] as const,
  attendance: (id: string) => ['attendances', id] as const,
  publicForm: (token: string) => ['public-form', token] as const,
  signaturePending: ['signature-pending'] as const,
};

const list = <S extends z.ZodType>(key: QueryKey, path: string, schema: S) =>
  queryOptions({ queryKey: key, queryFn: () => api(path, { schema: z.array(schema), fallbackError: 'Não foi possível carregar os dados.' }) });

export const patientsQuery = list(keys.patients, '/api/patients', patientSchema);
export const proceduresQuery = list(keys.procedures, '/api/procedures', procedureSchema);
export const anamnesesQuery = list(keys.anamneses, '/api/anamneses', anamnesisSchema);
export const contractsQuery = list(keys.contracts, '/api/contracts', contractSchema);
export const combosQuery = list(keys.combos, '/api/combos', comboSchema);
export const plansQuery = list(keys.plans, '/api/plans', planSchema);
export const followupsQuery = list(keys.followups, '/api/followups', followupSchema);
export const signaturePendingQuery = list(keys.signaturePending, '/api/signature-pending', signaturePendingSchema);
export const attendancesQuery = list(keys.attendances, '/api/attendances', attendanceSchema);
export const appointmentsQuery = list(keys.appointments, '/api/appointments', appointmentSchema);
export const attendanceQuery = (id: string) =>
  queryOptions({ queryKey: keys.attendance(id), queryFn: () => api(`/api/attendances/${id}`, { schema: attendanceSchema, fallbackError: 'Não foi possível carregar o atendimento.' }) });
export const relationshipQuery = (patientId: string) =>
  queryOptions({ queryKey: keys.relationship(patientId), queryFn: () => api(`/api/patients/${patientId}/relationship`, { schema: relationshipSchema, fallbackError: 'Não foi possível carregar o relacionamento.' }) });
export const patientHistoryQuery = (patientId: string) =>
  queryOptions({ queryKey: keys.history(patientId), queryFn: () => api(`/api/patients/${patientId}/history`, { schema: patientHistorySchema, fallbackError: 'Não foi possível carregar o paciente.' }) });
export const publicFormQuery = (token: string) =>
  queryOptions({ queryKey: keys.publicForm(token), retry: false, queryFn: () => api(`/public/anamnesis/${token}`, { schema: publicFormSchema, fallbackError: 'Link inválido, expirado ou já enviado.' }) });

type MutationConfig<V, R> = { mutationFn: (variables: V) => Promise<R>; invalidate: QueryKey[]; success?: string | ((result: R, variables: V) => string) };

// Invalida as listas afetadas e mostra o resultado (ou o erro da API) como toast.
export function useApiMutation<V, R = unknown>({ mutationFn, invalidate, success }: MutationConfig<V, R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (success) toast.success(typeof success === 'function' ? success(result, variables) : success);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

const post = <S extends z.ZodType>(path: string, body: unknown, schema: S = anySchema as unknown as S) => api(path, { method: 'POST', body, schema });
const patientRefresh = [keys.patients];
const everything = [keys.patients, keys.procedures, keys.anamneses, keys.contracts, keys.combos, keys.plans, keys.followups, keys.appointments, keys.attendances];

export const useCreatePatient = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/patients', body), invalidate: patientRefresh, success: 'Paciente cadastrado.' });
export const useCreateProcedure = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/procedures', body), invalidate: [keys.procedures], success: 'Procedimento cadastrado.' });
export const useCreateAnamnesis = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/anamneses', body), invalidate: [keys.anamneses], success: 'Formulário de anamnese criado.' });
export const useRestoreAnamnesis = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/anamneses/${id}/versions`, { restoreVersion: version }), invalidate: [keys.anamneses], success: (_, { version }) => `Rollback feito: nova versão criada a partir da v${version}.` });
export const useUpdateAnamnesis = () =>
  useApiMutation({
    mutationFn: async ({ id, title, schema, validityMonths, procedureIds }: { id: string; title?: string; schema?: Record<string, unknown>; validityMonths?: number; procedureIds?: string[] }) => {
      if (title !== undefined) await api(`/api/anamneses/${id}`, { method: 'PATCH', body: { title, validityMonths }, schema: anySchema });
      if (procedureIds) await api(`/api/anamneses/${id}/associations`, { method: 'PUT', body: { procedures: procedureIds.map((procedureId) => ({ procedureId, required: true })) }, schema: anySchema });
      if (schema) await post(`/api/anamneses/${id}/versions`, { schema });
    },
    invalidate: [keys.anamneses],
    success: 'Formulário de anamnese atualizado.',
  });
export const useCreateContract = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/contracts', body), invalidate: [keys.contracts], success: 'Contrato criado.' });
export const useRestoreContract = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/contracts/${id}/versions`, { restoreVersion: version }), invalidate: [keys.contracts], success: (_, { version }) => `Rollback feito: nova versão criada a partir da v${version}.` });
export const useUpdateContract = () =>
  useApiMutation({
    mutationFn: async ({ id, settings, content }: { id: string; settings?: { title: string; kind: string; procedureId?: string | null; comboId?: string | null }; content?: string }) => {
      if (settings) await api(`/api/contracts/${id}`, { method: 'PATCH', body: settings, schema: anySchema });
      if (content !== undefined) await post(`/api/contracts/${id}/versions`, { content });
    },
    invalidate: [keys.contracts, keys.followups],
    success: 'Contrato atualizado.',
  });
export const useUpdateProcedure = () =>
  useApiMutation({ mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api(`/api/procedures/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.procedures], success: 'Procedimento atualizado.' });
export const useUpdateCombo = () =>
  useApiMutation({ mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api(`/api/combos/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.combos], success: 'Combo atualizado.' });
export const useCreateCombo = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/combos', body), invalidate: [keys.combos], success: 'Combo cadastrado.' });
export const useCreateFollowup = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/followups', body), invalidate: everything, success: 'Acompanhamento iniciado.' });
export const useCreatePlan = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/plans', body), invalidate: [keys.plans], success: 'Plano cadastrado.' });
export const useUpdatePlan = () => useApiMutation({ mutationFn: ({ id, ...body }: { id: string; active?: boolean; expectedVersion?: number } & Record<string, unknown>) => api(`/api/plans/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.plans], success: 'Plano atualizado.' });
export const useAnswerAnamnesis = () =>
  useApiMutation({ mutationFn: ({ id, answers }: { id: string; answers: Record<string, unknown> }) => post(`/api/patient-anamneses/${id}/answers`, { answers }), invalidate: [keys.followups, keys.patients], success: 'Anamnese registrada.' });
export const useCreateAppointment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/appointments', body), invalidate: [keys.appointments, keys.patients], success: 'Agendamento criado.' });
export const useUpdateAppointment = () => useApiMutation({ mutationFn: ({ id, ...body }: { id: string; startsAt: string; endsAt: string }) => api(`/api/appointments/${id}`, { method: 'PATCH', body, schema: anySchema }), invalidate: [keys.appointments, keys.patients], success: 'Agendamento atualizado.' });
export const useCreatePayment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/payments', body), invalidate: [keys.followups, keys.patients], success: 'Pagamento registrado.' });
export const useDeleteAppointment = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/appointments/${id}`, { method: 'DELETE', schema: anySchema }), invalidate: [keys.appointments, keys.patients], success: 'Agendamento cancelado.' });
export const useConfirmAppointment = () => useApiMutation({ mutationFn: ({ id, selectedItemIds }: { id: string; selectedItemIds?: string[] }) => post(`/api/appointments/${id}/confirm`, { selectedItemIds }), invalidate: everything, success: 'Atendimento confirmado.' });
export const useNoShowAppointment = () => useApiMutation({ mutationFn: (id: string) => post(`/api/appointments/${id}/no-show`, {}), invalidate: [keys.appointments, keys.followups, keys.patients], success: 'Não comparecimento registrado.' });
export const useCancelAttendance = () => useApiMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/api/attendances/${id}/cancel`, { method: 'PATCH', body: { reason }, schema: anySchema }), invalidate: everything, success: 'Atendimento cancelado.' });
export const useUpdateAttendance = (id: string) =>
  useApiMutation({ mutationFn: (body: { notes?: string | null; data?: Record<string, unknown>; durationMinutes?: number | null }) => api(`/api/attendances/${id}`, { method: 'PATCH', body, schema: anySchema }), invalidate: [keys.attendance(id), keys.patients], success: 'Acompanhamento salvo.' });
export const useAddAttendancePhoto = (id: string) =>
  useApiMutation({
    mutationFn: async ({ file, phase, notes }: { file: File; phase: 'before' | 'during' | 'after'; notes: string }) => {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const contentHash = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      const presign = await post('/api/uploads/presign', { attendanceId: id, contentType: file.type, size: file.size, contentHash }, z.looseObject({ uploadUrl: z.string(), objectKey: z.string(), uploadToken: z.string() }));
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!upload.ok) throw new Error('Não foi possível enviar a imagem.');
      return post(`/api/attendances/${id}/photos`, { objectKey: presign.objectKey, uploadToken: presign.uploadToken, contentHash, phase, notes: notes.trim() || null });
    },
    invalidate: [keys.attendance(id), keys.patients],
    success: 'Foto anexada à sessão.',
  });
export const useDeleteAttendancePhoto = (id: string) =>
  useApiMutation({ mutationFn: (photoId: string) => api(`/api/attendances/${id}/photos/${photoId}`, { method: 'DELETE', schema: anySchema }), invalidate: [keys.attendance(id), keys.patients], success: 'Foto removida.' });
export const useCreateAttendance = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/attendances', body, createdSchema), invalidate: everything, success: 'Atendimento registrado como realizado.' });

export const useRequestAnamnesis = () =>
  useApiMutation({
    mutationFn: async (patientAnamnesisId: string) => {
      const request = await post('/api/anamnesis-requests', { patientAnamnesisId }, requestSchema);
      return `${location.origin}/formulario/${request.url.split('/').at(-1)}`;
    },
    invalidate: [],
  });

export const useSaveDraft = (token: string) => useApiMutation({ mutationFn: (draft: unknown) => api(`/public/anamnesis/${token}/draft`, { method: 'PUT', body: { draft }, schema: anySchema }), invalidate: [], success: 'Rascunho salvo.' });
export const useSubmitAnamnesis = (token: string) => useApiMutation({ mutationFn: (answers: unknown) => post(`/public/anamnesis/${token}/submit`, { answers }), invalidate: [] });
