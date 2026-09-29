import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from './api';
import { anamnesisSchema, anySchema, appointmentSchema, contractSchema, createdSchema, packSchema, patientHistorySchema, patientSchema, planSchema, procedureSchema, publicFormSchema, requestSchema } from './schemas';

export const keys = {
  patients: ['patients'] as const,
  procedures: ['procedures'] as const,
  anamneses: ['anamneses'] as const,
  contracts: ['contracts'] as const,
  packages: ['packages'] as const,
  plans: ['plans'] as const,
  appointments: ['appointments'] as const,
  history: (patientId: string) => ['patients', patientId, 'history'] as const,
  publicForm: (token: string) => ['public-form', token] as const,
};

const list = <S extends z.ZodType>(key: QueryKey, path: string, schema: S) =>
  queryOptions({ queryKey: key, queryFn: () => api(path, { schema: z.array(schema), fallbackError: 'Não foi possível carregar os dados.' }) });

export const patientsQuery = list(keys.patients, '/api/patients', patientSchema);
export const proceduresQuery = list(keys.procedures, '/api/procedures', procedureSchema);
export const anamnesesQuery = list(keys.anamneses, '/api/anamneses', anamnesisSchema);
export const contractsQuery = list(keys.contracts, '/api/contracts', contractSchema);
export const packagesQuery = list(keys.packages, '/api/packages', packSchema);
export const plansQuery = list(keys.plans, '/api/plans', planSchema);
export const appointmentsQuery = list(keys.appointments, '/api/appointments', appointmentSchema);
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
const everything = [keys.patients, keys.procedures, keys.anamneses, keys.contracts, keys.packages, keys.plans, keys.appointments];

export const useCreatePatient = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/patients', body), invalidate: patientRefresh, success: 'Paciente cadastrado.' });
export const useCreateProcedure = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/procedures', body), invalidate: [keys.procedures], success: 'Procedimento cadastrado.' });
export const useCreateAnamnesis = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/anamneses', body), invalidate: [keys.anamneses], success: 'Anamnese criada.' });
export const useRestoreAnamnesis = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/anamneses/${id}/versions`, { restoreVersion: version }), invalidate: [keys.anamneses], success: (_, { version }) => `Versão ${version} restaurada como nova versão.` });
export const useCreateContract = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/contracts', body), invalidate: [keys.contracts], success: 'Contrato criado.' });
export const useRestoreContract = () =>
  useApiMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => post(`/api/contracts/${id}/versions`, { restoreVersion: version }), invalidate: [keys.contracts], success: 'Nova versão criada.' });
export const useCreatePackage = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/packages', body), invalidate: [keys.packages], success: 'Pacote cadastrado.' });
export const useCreatePlan = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/plans', body), invalidate: everything, success: 'Contratação registrada.' });
export const useCreateAppointment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/appointments', body), invalidate: [keys.appointments], success: 'Agendamento criado.' });
export const useCreatePayment = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/payments', body), invalidate: [keys.plans], success: 'Pagamento registrado.' });
export const useCreateSession = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/sessions', body), invalidate: everything, success: 'Sessão registrada como realizada.' });

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
