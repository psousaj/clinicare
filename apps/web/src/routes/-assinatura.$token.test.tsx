import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from '../router';

const signatureResponse = () => ({
  participantId: 'participant-1',
  role: 'patient',
  status: 'pending',
  expiresAt: '2026-10-12T00:00:00.000Z',
  document: { id: 'document-1', revisionId: 'revision-1', version: 1, hash: 'a'.repeat(64), size: 100, url: '/public/signatures/test-token/pdf' },
  contract: { id: 'contract-1', title: 'Contrato de teste', version: 1, content: 'Leia este contrato.' },
});

const renderPage = () => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/assinatura/test-token'] }));
  render(<QueryClientProvider client={createQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
};

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

describe('patient signature workspace', () => {
  beforeEach(() => {
    cleanup();
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === '/public/signatures/test-token') return { ok: true, status: 200, json: async () => signatureResponse() };
      if (url === '/public/signatures/test-token/confirm') return { ok: true, status: 200, json: async () => ({ signed: true }) };
      if (url === '/public/signatures/test-token/preview') return { ok: true, status: 200, headers: { get: () => 'a'.repeat(64) }, blob: async () => new Blob(['%PDF-1.4']) };
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the selected PDF page and submits normalized placement after explicit confirmation', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Contrato de teste' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Página 2' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    await user.click(screen.getByRole('button', { name: 'Usar assinatura' }));
    await user.click(screen.getByRole('button', { name: 'Visualizar prévia do PDF' }));
    await waitFor(() => expect(screen.getByTitle('Prévia do PDF candidato')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /revisei o contrato/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar assinatura' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Assinatura registrada' })).toBeInTheDocument());
    const request = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/public/signatures/test-token/confirm' && init?.method === 'POST');
    expect(request).toBeDefined();
    const body = JSON.parse(request![1].body as string);
    expect(body.evidence.baseRevisionId).toBe('revision-1');
    expect(body.evidence.placement.pageIndex).toBe(1);
    expect(body.evidence.placement.x).toBeGreaterThanOrEqual(0);
    expect(body.evidence.placement.x + body.evidence.placement.width).toBeLessThanOrEqual(1);
    expect(body.evidence.confirmed).toBe(true);
  });

  it('notifies the patient and suggests reloading on a stale-document conflict', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === '/public/signatures/test-token') return { ok: true, status: 200, json: async () => signatureResponse() };
      if (url === '/public/signatures/test-token/confirm') return { ok: false, status: 409, json: async () => ({ error: 'STALE_DOCUMENT_REVISION', code: 'STALE_DOCUMENT_REVISION' }) };
      if (url === '/public/signatures/test-token/preview') return { ok: true, status: 200, headers: { get: () => 'a'.repeat(64) }, blob: async () => new Blob(['%PDF-1.4']) };
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Contrato de teste' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usar assinatura' }));
    await user.click(screen.getByRole('button', { name: 'Visualizar prévia do PDF' }));
    await waitFor(() => expect(screen.getByTitle('Prévia do PDF candidato')).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /revisei o contrato/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar assinatura' }));

    expect(await screen.findByText(/O documento foi atualizado antes da confirmação/i)).toBeInTheDocument();
  });

  it('walks through the GOV.BR export, import and validated acceptance', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/public/signatures/test-token') return { ok: true, status: 200, json: async () => signatureResponse() };
      if (url === '/public/signatures/test-token/external/export') return { ok: true, status: 200, json: async () => ({ attemptId: 'attempt-1', exportHash: 'a'.repeat(64), exportSize: 100, expiresAt: new Date(Date.now() + 3600000).toISOString() }) };
      if (url === '/public/signatures/test-token/external/import') return { ok: true, status: 200, json: async () => ({ receiptId: 'receipt-1', attemptId: 'attempt-1', validationStatus: 'validada', reason: 'ok', signer: { commonName: 'Paciente Teste' }, certificateFingerprint: 'b'.repeat(64) }) };
      if (url === '/public/signatures/test-token/external/confirm') {
        const body = JSON.parse(init?.body as string);
        expect(body.confirmed).toBe(true);
        expect(body.attemptId).toBe('attempt-1');
        return { ok: true, status: 200, json: async () => ({ signed: true }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Assinar pelo GOV.BR' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exportar revisão para o GOV.BR' }));
    expect(await screen.findByText(/Baixar o PDF exato da revisão/i)).toBeInTheDocument();
    const file = new File(['%PDF-1.4 signed'], 'retorno.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/PDF retornado pelo GOV.BR/i), file);
    expect(await screen.findByText(/validada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Paciente Teste/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /assinei este documento no GOV.BR/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar retorno validado' }));
    expect(await screen.findByText(/Retorno validado e incorporado/i)).toBeInTheDocument();
  });
});
