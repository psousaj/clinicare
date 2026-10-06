import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractSignatureHistory } from './ContractSignatureHistory';

const historyResponse = () => ({
  process: { id: 'p1', status: 'pending', statusLabel: 'Pendente', followupContractId: 'c1' },
  contract: { id: 'c1', title: 'Contrato Teste', version: 1, required: true, status: 'pending' },
  document: {
    id: 'd1', currentRevisionId: 'r2', hasExternalSignatures: true,
    revisions: [
      { id: 'r1', version: 1, originLabel: 'Original', hash: 'a'.repeat(64), size: 100, parentRevisionId: null, createdAt: '2026-10-06T09:00:00.000Z', promotedBy: null, downloadUrl: null },
      { id: 'r2', version: 2, originLabel: 'Externa GOV.BR', hash: 'b'.repeat(64), size: 200, parentRevisionId: 'r1', createdAt: '2026-10-06T10:00:00.000Z', promotedBy: { role: 'patient', method: 'govbr_external', methodLabel: 'Externa GOV.BR' }, downloadUrl: '/api/signature-participants/pp1/revisions/r2/pdf' },
    ],
  },
  participants: [
    { id: 'pp1', role: 'patient', roleLabel: 'Paciente', status: 'signed', statusLabel: 'Assinada', signedAt: '2026-10-06T10:00:00.000Z', identity: { fullName: 'Paciente Teste' }, methods: [] },
    { id: 'pp2', role: 'professional', roleLabel: 'Representante da clínica', status: 'pending', statusLabel: 'Pendente', signedAt: null, identity: { role: 'professional' }, methods: [] },
  ],
  operations: [],
  externalAttempts: [{ id: 'a1', lifecycleLabel: 'Concluída', validationLabel: 'validada' }],
  events: [{ id: 'e1', type: 'signed', label: 'Assinatura confirmada', occurredAt: '2026-10-06T10:00:00.000Z', participantId: 'pp1', actor: { role: 'patient', name: 'Paciente Teste' }, method: 'Externa GOV.BR', revision: 'revisão 2' }],
  notice: 'Assinatura eletrônica simples. Este histórico não constitui certificado ICP-Brasil.',
});

describe('ContractSignatureHistory', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('expands panel history with states, revisions, attempts and timeline', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => historyResponse() })) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><ContractSignatureHistory followupContractId="c1" title="Contrato Teste" /></QueryClientProvider>);

    await user.click(screen.getByRole('button', { name: 'Histórico de assinaturas' }));
    expect((await screen.findAllByText('Pendente')).length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByText(/Externa GOV.BR/)).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText(/Assinatura confirmada/)).toBeInTheDocument();
    expect(await screen.findByText(/Paciente Teste/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Baixar PDF/ })).toHaveAttribute('href', '/api/signature-participants/pp1/revisions/r2/pdf');
    expect(await screen.findByText(/não constitui certificado ICP-Brasil/)).toBeInTheDocument();
    const request = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(request).toContain('/api/signature-history?followupContractId=c1');
  });
});
