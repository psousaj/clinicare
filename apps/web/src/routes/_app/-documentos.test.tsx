import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from '../../router';

const historyResponse = () => ({
  process: { id: 'proc1', status: 'pending', statusLabel: 'Pendente', followupContractId: 'c1' },
  contract: { id: 'c1', title: 'Contrato padrão', version: 1, required: true, status: 'ready' },
  document: {
    id: 'd1', currentRevisionId: 'r1',
    revisions: [{ id: 'r1', version: 1, originLabel: 'Original', hash: 'a'.repeat(64), createdAt: '2026-10-06T09:00:00.000Z', promotedBy: null, downloadUrl: null }],
  },
  participants: [
    { id: 'pat1', role: 'patient', roleLabel: 'Paciente', status: 'signed', statusLabel: 'Assinada', signedAt: '2026-10-06T10:00:00.000Z' },
    { id: 'prof1', role: 'professional', roleLabel: 'Representante da clínica', status: 'pending', statusLabel: 'Pendente', signedAt: null },
  ],
  operations: [],
  externalAttempts: [],
  events: [],
});

const queue = () => [
  { participantId: 'prof1', role: 'professional', status: 'pending', followupId: 'at1', contractId: 'c1', title: 'Contrato padrão', blocking: false, patient: { id: 'p1', fullName: 'Marina Alves' } },
];

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async () => ({
        getViewport: () => ({ width: 612, height: 792 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  }),
}));

vi.mock('signature_pad', () => ({
  default: class SignaturePadMock {
    off() {}
    clear() {}
    isEmpty() { return false; }
    toDataURL() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; }
  },
}));

describe('representative signature page', () => {
  let calls: { url: string; method: string; body: unknown }[];
  beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      if (url === '/api/auth/get-session') return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', name: 'Dra. Paula', email: 'paula@example.com' } }) };
      if (url === '/api/auth/me') return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', name: 'Dra. Paula', email: 'paula@example.com' }, tenant: { id: 't1', name: 'Clínica Teste' } }) };
      if (url === '/api/auth/professional-profile') return { ok: true, status: 200, json: async () => ({ id: 'prof9', userId: 'u1', registrationType: 'CRM', registrationNumber: '123456', registrationState: 'SP', active: true }) };
      if (url === '/api/signature-pending') return { ok: true, status: 200, json: async () => queue() };
      if (url.startsWith('/api/signature-history')) return { ok: true, status: 200, json: async () => historyResponse() };
      if (url === '/api/signature-participants/prof1/pdf') return { ok: true, status: 200, blob: async () => new Blob(['%PDF-1.4']) };
      if (url === '/api/signature-participants/prof1/preview') return { ok: true, status: 200, headers: { get: () => `"${'b'.repeat(64)}"` }, blob: async () => new Blob(['%PDF-1.4']) };
      if (url === '/api/signature-participants/prof1/confirm') return { ok: true, status: 200, json: async () => ({ signed: true }) };
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderPage = () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/documentos'] }));
    render(<QueryClientProvider client={createQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  };

  it('navigates to the dedicated page with the patient-like reading step', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('link', { name: /revisar e assinar/i }));
    // O representante começa direto na assinatura: não repete a leitura do contrato.
    expect(await screen.findByRole('heading', { name: 'Assinar como representante' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Área para desenhar sua assinatura')).toBeInTheDocument();
  });

  it('shows validation where the user is looking when the aceite is missing', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('link', { name: /revisar e assinar/i }));
    expect(await screen.findByRole('heading', { name: 'Assinar como representante' })).toBeInTheDocument();
    // Sem aceite, o fluxo segue no painel e não envia nada.
    await user.click((await screen.findAllByRole('button', { name: /continuar para confirmação/i }))[0]!);
    expect(calls.some((call) => call.url.endsWith('/confirm'))).toBe(false);
  });
});
