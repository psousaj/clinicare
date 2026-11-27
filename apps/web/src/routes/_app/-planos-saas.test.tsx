import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaasPlansPage } from './planos-saas';

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: useQueryMock };
});

describe('SaaS plan comparison', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => options.queryKey[0] === 'saas-plans'
      ? { data: [
          { id: 'free', name: 'Free', capabilities: ['attendances.single_sessions'], priceCents: null, billingInterval: null },
          { id: 'standard', name: 'Standard', capabilities: ['attendances.single_sessions', 'contracts.generation'], priceCents: null, billingInterval: null },
          { id: 'pro', name: 'Pró', capabilities: ['attendances.single_sessions', 'contracts.generation', 'events'], priceCents: null, billingInterval: null },
        ], isPending: false, isError: false }
      : { data: { effectivePlan: 'free', subscription: null }, isPending: false, isError: false });
  });

  it('shows all plans, configurable pricing status, and states that selection does not grant access', () => {
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><SaasPlansPage /></QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Planos da Clínicare' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Standard' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pró' })).toBeTruthy();
    expect(screen.getAllByText('Preço a definir')).toHaveLength(3);
    expect(screen.getByText(/Escolher um plano não altera o acesso/)).toBeTruthy();
    expect(screen.getByText('Plano efetivo')).toBeTruthy();
    expect(screen.getByText('Sem assinatura paga')).toBeTruthy();
    expect(screen.getAllByText('Atendimentos avulsos')).toHaveLength(3);
    expect(screen.getAllByText('Geração de contratos com dados do paciente')).toHaveLength(2);
  });

  it('distinguishes paused from cancelled commercial status while access remains Free', () => {
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => options.queryKey[0] === 'saas-plans'
      ? { data: [{ id: 'free', name: 'Free', capabilities: [], priceCents: null, billingInterval: null }], isPending: false, isError: false }
      : { data: { effectivePlan: 'free', subscription: { planId: 'standard', status: 'paused', startedAt: '2026-01-01', endedAt: null } }, isPending: false, isError: false });
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><SaasPlansPage /></QueryClientProvider>);
    expect(screen.getByText('Pausada · acesso Free')).toBeTruthy();
    expect(screen.getAllByText(/Plano efetivo da clínica:/).at(-1)?.textContent).toContain('Free');
  });

  it.each([
    { status: 'active', effectivePlan: 'standard', label: 'Ativa' },
    { status: 'inactive', effectivePlan: 'free', label: 'Cancelada · acesso Free' },
  ] as const)('shows $label commercial state with effective plan $effectivePlan', ({ status, effectivePlan, label }) => {
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => options.queryKey[0] === 'saas-plans'
      ? { data: [{ id: 'free', name: 'Free', capabilities: [], priceCents: null, billingInterval: null }, { id: 'standard', name: 'Standard', capabilities: [], priceCents: null, billingInterval: null }], isPending: false, isError: false }
      : { data: { effectivePlan, subscription: { planId: 'standard', status, startedAt: '2026-01-01', endedAt: status === 'inactive' ? '2026-02-01' : null } }, isPending: false, isError: false });
    render(<QueryClientProvider client={new QueryClient()}><SaasPlansPage /></QueryClientProvider>);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Plano efetivo da clínica:').textContent).toContain(effectivePlan === 'standard' ? 'Standard' : 'Free');
  });
});
