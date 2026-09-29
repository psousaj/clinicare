import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from './api';
import { anamnesisSchema, anySchema, appointmentSchema, contractSchema, createdSchema, comboSchema, patientHistorySchema, patientSchema, planSchema, procedureSchema, publicFormSchema, requestSchema, sessionSchema } from './schemas';

export const keys = {
  patients: ['patients'] as const,
  procedures: ['procedures'] as const,
  anamneses: ['anamneses'] as const,
  contracts: ['contracts'] as const,
  combos: ['combos'] as const,
  plans: ['plans'] as const,
  appointments: ['appointments'] as const,
  history: (patientId: string) => ['patients', patientId, 'history'] as const,
  session: (id: string) => ['sessions', id] as const,
  publicForm: (token: string) => ['public-form', token] as const,
};

const list = <S extends z.ZodType>(key: QueryKey, path: string, schema: S) =>
  queryOptions({ queryKey: key, queryFn: () => api(path, { schema: z.array(schema), fallbackError: 'Não foi possível carregar os dados.' }) });

export const patientsQuery = list(keys.patients, '/api/patients', patientSchema);
export const proceduresQuery = list(keys.procedures, '/api/procedures', procedureSchema);
export const anamnesesQuery = list(keys.anamneses, '/api/anamneses', anamnesisSchema);
export const contractsQuery = list(keys.contracts, '/api/contracts', contractSchema);
export const combosQuery = list(keys.combos, '/api/combos', comboSchema);
export const plansQuery = list(keys.plans, '/api/plans', planSchema);
export const appointmentsQuery = list(keys.appointments, '/api/appointments', appointmentSchema);
export const sessionQuery = (id: string) =>
  queryOptions({ queryKey: keys.session(id), queryFn: () => api(`/api/sessions/${id}`, { schema: sessionSchema, fallbackError: 'Não foi possível carregar a sessão.' }) });
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
const everything = [keys.patients, keys.procedures, keys.anamneses, keys.contracts, keys.combos, keys.plans, keys.appointments];

export const useCreatePatient = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/patients', body), invalidate: patientRefresh, success: 'Paciente cadastrado.' });
export const useCreateProcedure = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/procedures', body), invalidate: [keys.procedures], success: 'Procedimento cadastrado.' });
export const useCreateAnamnesis = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/anamneses', body), invalidate: [keys.anamneses], success: 'Formulário de anamnese criado.' });
export const useRestoreAnamnesis = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/anamneses/${id}/versions`, { restoreVersion: version }), invalidate: [keys.anamneses], success: (_, { version }) => `Rollback feito: nova versão criada a partir da v${version}.` });
export const useUpdateAnamnesis = () =>
  useApiMutation({
    mutationFn: async ({ id, title, schema }: { id: string; title?: string; schema?: Record<string, unknown> }) => {
      if (title !== undefined) await api(`/api/anamneses/${id}`, { method: 'PATCH', body: { title }, schema: anySchema });
      if (schema) await post(`/api/anamneses/${id}/versions`, { schema });
    },
    invalidate: [keys.anamneses],
    success: 'Formulário de anamnese atualizado.',
  });
export const useCreateContract = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/contracts', body), invalidate: [keys.contracts], success: 'Contrato criado.' });
export const useRestoreContract = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/contracts/${id}/versions`, { restoreVersion: version }), invalidate: [keys.contracts], success: 'Nova versão criada.' });
export const useCreateCombo = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/combos', body), invalidate: [keys.combos], success: 'Combo cadastrado.' });
export const useCreatePlan = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/plans', body), invalidate: everything, success: 'Contratação registrada.' });
export const useCreateAppointment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/appointments', body), invalidate: [keys.appointments], success: 'Agendamento criado.' });
export const useCreatePayment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/payments', body), invalidate: [keys.plans], success: 'Pagamento registrado.' });
export const useDeleteAppointment = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/appointments/${id}`, { method: 'DELETE', schema: anySchema }), invalidate: [keys.appointments, keys.patients], success: 'Agendamento excluído.' });
export const useUpdateSession = (id: string) =>
  useApiMutation({ mutationFn: (body: { notes?: string | null; data?: Record<string, unknown> }) => api(`/api/sessions/${id}`, { method: 'PATCH', body, schema: anySchema }), invalidate: [keys.session(id), keys.patients], success: 'Acompanhamento salvo.' });
export const useAddSessionPhoto = (id: string) =>
  useApiMutation({
    mutationFn: async ({ file, phase, notes }: { file: File; phase: 'before' | 'during' | 'after'; notes: string }) => {
      const presign = await post('/api/uploads/presign', { contentType: file.type, size: file.size }, z.looseObject({ uploadUrl: z.string(), objectKey: z.string() }));
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!upload.ok) throw new Error('Não foi possível enviar a imagem.');
      return post(`/api/sessions/${id}/photos`, { objectKey: presign.objectKey, phase, notes: notes.trim() || null });
    },
    invalidate: [keys.session(id), keys.patients],
    success: 'Foto anexada à sessão.',
  });
export const useDeleteSessionPhoto = (id: string) =>
  useApiMutation({ mutationFn: (photoId: string) => api(`/api/sessions/${id}/photos/${photoId}`, { method: 'DELETE', schema: anySchema }), invalidate: [keys.session(id), keys.patients], success: 'Foto removida.' });
export const useCreateSession = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/sessions', body, createdSchema), invalidate: everything, success: 'Sessão registrada como realizada.' });

export const useRequestAnamnesis = () =>
  useApiMutation({
    mutationFn: async ({ patientId, anamnesisId }: { patientId: string; anamnesisId: string }) => {
      const applied = await post('/api/patient-anamneses', { patientId, anamnesisId }, createdSchema);
      const request = await post('/api/anamnesis-requests', { patientAnamnesisId: applied.id }, requestSchema);
      return `${location.origin}/formulario/${request.url.split('/').at(-1)}`;
    },
    invalidate: [],
  });

export const useSaveDraft = (token: string) => useApiMutation({ mutationFn: (draft: unknown) => api(`/public/anamnesis/${token}/draft`, { method: 'PUT', body: { draft }, schema: anySchema }), invalidate: [], success: 'Rascunho salvo.' });
export const useSubmitAnamnesis = (token: string) => useApiMutation({ mutationFn: (answers: unknown) => post(`/public/anamnesis/${token}/submit`, { answers }), invalidate: [] });
