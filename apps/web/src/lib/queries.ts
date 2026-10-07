import { queryOptions, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from './api';
import { sha256Hex } from './sha256';
import { anamnesisSchema, anySchema, accountSchema, appointmentSchema, appliedAnamnesisSchema, contractSchema, createdSchema, comboSchema, planSchema, patientHistorySchema, professionalProfileSchema, relationshipSchema, patientSchema, followupSchema, procedureSchema, publicAnamnesisSchema, publicFormSchema, requestSchema, attendanceSchema, sessionSchema, signatureHistorySchema, signaturePendingSchema } from './schemas';

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
  professionalProfile: ['professional-profile'] as const,
  session: ['session'] as const,
  signatureHistory: (followupContractId: string) => ['signature-history', followupContractId] as const,
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
export const professionalProfileQuery = queryOptions({
  queryKey: keys.professionalProfile,
  queryFn: () => api('/api/auth/professional-profile', { schema: professionalProfileSchema.nullable(), fallbackError: 'Não foi possível carregar o registro profissional.' }),
});
export const sessionQuery = queryOptions({
  queryKey: keys.session,
  queryFn: () => api('/api/auth/get-session', { schema: sessionSchema, fallbackError: 'Não foi possível carregar a sessão.' }),
});
export const accountQuery = queryOptions({
  queryKey: ['account'] as const,
  queryFn: () => api('/api/auth/me', { schema: accountSchema, fallbackError: 'Não foi possível carregar os dados da conta.' }),
});
export const useSaveProfessionalProfile = () =>
  useApiMutation({
    mutationFn: (body: { registrationType: string; registrationNumber: string; registrationState?: string | null }) =>
      api('/api/auth/professional-profile', { method: 'PUT', body, schema: professionalProfileSchema }),
    invalidate: [keys.professionalProfile],
    success: 'Registro profissional salvo. Novos contratos já saem carimbados.',
  });
export const signatureHistoryQuery = (followupContractId: string) =>
  queryOptions({ queryKey: keys.signatureHistory(followupContractId), queryFn: () => api(`/api/signature-history?followupContractId=${followupContractId}`, { schema: signatureHistorySchema, fallbackError: 'Não foi possível carregar o histórico de assinaturas.' }) });
export const appliedAnamnesisQuery = (id: string) =>
  queryOptions({ queryKey: ['applied-anamnesis', id] as const, queryFn: () => api(`/api/patient-anamneses/${id}`, { schema: appliedAnamnesisSchema, fallbackError: 'Não foi possível carregar as respostas.' }) });
export const attendancesQuery = list(keys.attendances, '/api/attendances', attendanceSchema);
export const appointmentsQuery = list(keys.appointments, '/api/appointments', appointmentSchema);
export const attendanceQuery = (id: string) =>
  queryOptions({ queryKey: keys.attendance(id), queryFn: () => api(`/api/attendances/${id}`, { schema: attendanceSchema, fallbackError: 'Não foi possível carregar o atendimento.' }) });
export const relationshipQuery = (patientId: string) =>
  queryOptions({ queryKey: keys.relationship(patientId), queryFn: () => api(`/api/patients/${patientId}/relationship`, { schema: relationshipSchema, fallbackError: 'Não foi possível carregar o relacionamento.' }) });
export const patientHistoryQuery = (patientId: string) =>
  queryOptions({ queryKey: keys.history(patientId), queryFn: () => api(`/api/patients/${patientId}/history`, { schema: patientHistorySchema, fallbackError: 'Não foi possível carregar o paciente.' }) });
export const publicFormQuery = (token: string) =>
  queryOptions({ queryKey: keys.publicForm(token), retry: false, queryFn: () => api(`/public/anamnesis/${token}`, { schema: publicAnamnesisSchema, fallbackError: 'Link inválido, expirado ou já enviado.' }) });

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
export const useUpdatePatient = (id: string) =>
  useApiMutation({ mutationFn: (body: unknown) => api(`/api/patients/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.patients, keys.history(id), keys.relationship(id)], success: 'Dados do paciente atualizados.' });
export const useDeletePatient = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/patients/${id}`, { method: 'DELETE', schema: anySchema }), invalidate: [keys.patients], success: 'Paciente excluído.' });
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
export const useDeleteAnamnesis = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/anamneses/${id}`, { method: 'PATCH', body: { active: false }, schema: anySchema }), invalidate: [keys.anamneses], success: 'Formulário excluído.' });
export const useCreateContract = () => useApiMutation({ mutationFn: (body: { title: string; kind: string; procedureId?: string | null; comboId?: string | null }) => post('/api/contracts', body), invalidate: [keys.contracts], success: 'Contrato criado. Agora envie o draft DOCX.' });
export const useUpdateContract = () =>
  useApiMutation({
    mutationFn: ({ id, settings }: { id: string; settings: { title?: string; kind?: string; procedureId?: string | null; comboId?: string | null; active?: boolean } }) =>
      api(`/api/contracts/${id}`, { method: 'PATCH', body: settings, schema: anySchema }),
    invalidate: [keys.contracts, keys.followups],
    success: 'Contrato atualizado.',
  });
export const useDeleteContract = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/contracts/${id}`, { method: 'PATCH', body: { active: false }, schema: anySchema }), invalidate: [keys.contracts, keys.followups], success: 'Contrato excluído.' });
export const contractPlaceholdersQuery = queryOptions({ queryKey: ['contract-placeholders'] as const, queryFn: () => api('/api/contracts/placeholders', { schema: z.array(z.string()), fallbackError: 'Não foi possível carregar os placeholders.' }) });
export const useSaveContractDraft = () =>
  useApiMutation({
    mutationFn: async ({ id, file, contexts, allowedPlaceholders, requiredPlaceholders }: { id: string; file: File; contexts: Record<string, { enabled: boolean; required: boolean }>; allowedPlaceholders: string[]; requiredPlaceholders: string[] }) => {
      const contentHash = await sha256Hex(file);
      const presign = await post(`/api/contracts/${id}/draft/presign`, {}, z.looseObject({ objectKey: z.string(), uploadUrl: z.string() }));
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, body: file });
      if (!upload.ok) throw new Error('Não foi possível enviar o DOCX.');
      return api(`/api/contracts/${id}/draft`, { method: 'PUT', body: { objectKey: presign.objectKey, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contentHash, size: file.size, contexts, allowedPlaceholders, requiredPlaceholders }, schema: anySchema });
    },
    invalidate: [keys.contracts],
    success: 'Draft DOCX salvo.',
  });
export const usePublishContractDraft = () =>
  useApiMutation({ mutationFn: (id: string) => post(`/api/contracts/${id}/publish`, {}, anySchema), invalidate: [keys.contracts, keys.followups], success: 'Nova versão publicada a partir do draft.' });
export const usePresignContractVersionPdf = () =>
  useApiMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const contentHash = await sha256Hex(file);
      const presign = await post(`/api/contracts/${id}/versions/rendered-pdf/presign`, { contentType: 'application/pdf', contentHash, size: file.size }, z.looseObject({ uploadIntentId: z.string(), uploadUrl: z.string() }));
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: file });
      if (!upload.ok) throw new Error('Não foi possível enviar o PDF.');
      return api(`/api/contracts/${id}/versions/rendered-pdf`, { method: 'POST', body: { uploadIntentId: presign.uploadIntentId }, schema: anySchema });
    },
    invalidate: [keys.contracts],
    success: 'PDF renderizado anexado à versão atual.',
  });
export const useUpdateProcedure = () =>
  useApiMutation({ mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api(`/api/procedures/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.procedures], success: 'Procedimento atualizado.' });
export const useUpdateCombo = () =>
  useApiMutation({ mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api(`/api/combos/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.combos], success: 'Combo atualizado.' });
export const useCreateCombo = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/combos', body), invalidate: [keys.combos], success: 'Combo cadastrado.' });
export const useCreateFollowup = () =>
  useApiMutation({
    mutationFn: (body: unknown) => post('/api/followups', body),
    invalidate: everything,
    success: (result) => {
      const contracts = (result as { contracts?: Array<{ status?: string }> } | null)?.contracts ?? [];
      return contracts.some((contract) => contract.status === 'generating')
        ? 'Acompanhamento iniciado. Gerando documento em segundo plano.'
        : 'Acompanhamento iniciado.';
    },
  });
export const useCreatePlan = () => useApiMutation({ mutationFn: (body: unknown) => post('/api/plans', body), invalidate: [keys.plans], success: 'Plano cadastrado.' });
export const useUpdatePlan = () => useApiMutation({ mutationFn: ({ id, ...body }: { id: string; active?: boolean; expectedVersion?: number } & Record<string, unknown>) => api(`/api/plans/${id}`, { method: 'PUT', body, schema: anySchema }), invalidate: [keys.plans], success: 'Plano atualizado.' });
export const useDeletePlan = () =>
  useApiMutation({ mutationFn: (id: string) => api(`/api/plans/${id}`, { method: 'PUT', body: { active: false }, schema: anySchema }), invalidate: [keys.plans], success: 'Plano excluído.' });
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
      const contentHash = `sha256:${await sha256Hex(file)}`;
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

// Geração sob demanda do contrato aplicado (DOCX->PDF): sem cron/worker,
// o POST /api/followups já tenta gerar inline, e o card permite retry manual
// quando fica em generating/failed.
export const useGenerateFollowupContract = () =>
  useApiMutation({
    mutationFn: (followupContractId: string) => post(`/api/followup-contracts/${followupContractId}/generate`, {}, anySchema),
    invalidate: [keys.followups, ['signature-history']],
    success: 'Documento do contrato gerado.',
  });
// Cerimônia do representante da clínica (lado profissional): prévia e
// confirmação usam os endpoints autenticados do painel, com o mesmo corpo de
// evidência do fluxo do paciente (documentId, baseRevisionId, PNG, posição,
// idempotência, fingerprint, aceite). A prévia devolve bytes, não JSON.
async function postParticipantPdf(participantId: string, action: 'preview' | 'confirm', body: Record<string, unknown>) {
  const response = await fetch(`/api/signature-participants/${participantId}/${action}`, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? 'Não foi possível concluir.');
  return response;
}

export async function previewProfessionalSignature(participantId: string, body: Record<string, unknown>): Promise<{ url: string; hash: string | null }> {
  const response = await postParticipantPdf(participantId, 'preview', body);
  const url = URL.createObjectURL(await response.blob());
  return { url, hash: response.headers.get('etag')?.replaceAll('"', '') ?? null };
}

export async function confirmProfessionalSignature(participantId: string, body: Record<string, unknown>): Promise<unknown> {
  return postParticipantPdf(participantId, 'confirm', body).then((response) => response.json());
}

export const usePreviewProfessionalSignature = () =>
  useMutation({
    mutationFn: ({ participantId, body }: { participantId: string; body: Record<string, unknown> }) => previewProfessionalSignature(participantId, body),
  });

export const useConfirmProfessionalSignature = () =>
  useApiMutation({
    mutationFn: ({ participantId, body }: { participantId: string; body: Record<string, unknown> }) =>
      postParticipantPdf(participantId, 'confirm', body).then((response) => response.json()),
    invalidate: [keys.signaturePending, keys.followups, ['signature-history']],
    success: 'Assinatura do representante registrada.',
  });

export async function fetchProfessionalPdf(participantId: string): Promise<string> {
  const response = await fetch(`/api/signature-participants/${participantId}/pdf`, { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível carregar o PDF do contrato.');
  return URL.createObjectURL(await response.blob());
}
// Gera um link novo de assinatura para o paciente (revoga o anterior) e devolve
// a URL pública pronta para copiar e enviar. Sem token (já assinado) vira erro amigável.
export const useRefreshSignatureLink = () =>
  useApiMutation({
    mutationFn: async (participantId: string) => {
      const result = await api(`/api/signature-participants/${participantId}/refresh`, { method: 'POST', body: {}, schema: z.looseObject({ participantId: z.string(), token: z.string().optional(), alreadySigned: z.boolean().optional() }) });
      if (result.alreadySigned || !result.token) throw new Error('Este contrato já foi assinado pelo paciente.');
      return `${location.origin}/assinatura/${result.token}`;
    },
    invalidate: [],
  });

export const useSaveDraft = (token: string) => useApiMutation({ mutationFn: (draft: unknown) => api(`/public/anamnesis/${token}/draft`, { method: 'PUT', body: { draft }, schema: anySchema }), invalidate: [], success: 'Rascunho salvo.' });
export const useSubmitAnamnesis = (token: string) => useApiMutation({ mutationFn: (answers: unknown) => post(`/public/anamnesis/${token}/submit`, { answers }), invalidate: [] });
