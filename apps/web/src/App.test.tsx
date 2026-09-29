import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from './router';

type Handler = (init: RequestInit | undefined) => unknown;
const marina = { _id: 'p1', fullName: 'Marina Alves', phone: '11999990000', email: null, notes: null, createdAt: '2026-09-29T10:00:00Z' };
let routes: Record<string, Handler>;
let calls: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  calls = [];
  routes = { 'GET /api/patients': () => [marina] };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = routes[`${method} ${url}`];
    if (!handler) return { ok: true, status: 200, json: async () => [] };
    const result = handler(init) as { status?: number; body: unknown } | unknown[];
    const failure = !Array.isArray(result) && typeof result === 'object' && result && 'status' in result ? result : null;
    return { ok: !failure, status: failure?.status ?? 200, json: async () => (failure ? failure.body : result) };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('Clinic dashboard', () => {
  it('shows prototype mode, patient entry point and patients from the API (_id → id)', async () => {
    renderAt('/');
    expect((await screen.findAllByText(/PROTÓTIPO · DADOS FICTÍCIOS/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: /novo paciente/i })).toBeInTheDocument();
    expect(await screen.findByText(/Gestão de pacientes, procedimentos e cuidados/i)).toBeInTheDocument();
    const row = await screen.findByRole('link', { name: /Marina Alves/ });
    expect(row).toHaveAttribute('href', '/pacientes/p1');
  });

  it('filters patients through the validated ?q= search param', async () => {
    const router = renderAt('/pacientes?q=zzz');
    await screen.findByRole('heading', { name: 'Pacientes', level: 2 });
    await waitFor(() => expect(calls.some((call) => call.url === '/api/patients')).toBe(true));
    expect(screen.queryByRole('link', { name: /Marina Alves/ })).not.toBeInTheDocument();
    await router.navigate({ to: '/pacientes', search: { q: 'mari' } });
    expect(await screen.findByRole('link', { name: /Marina Alves/ })).toBeInTheDocument();
  });

  it('validates and posts a new patient', async () => {
    routes['POST /api/patients'] = () => ({ ...marina, _id: 'p2' });
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /novo paciente/i }));
    const dialog = await screen.findByRole('dialog', { name: /cadastrar paciente/i });
    await user.type(within(dialog).getByLabelText(/nome completo/i), 'Paula Souza');
    await user.type(within(dialog).getByLabelText(/e-mail/i), 'paula@example.com');
    await user.click(within(dialog).getByRole('button', { name: /salvar paciente/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ fullName: 'Paula Souza', phone: null, email: 'paula@example.com' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Public anamnesis form', () => {
  it('loads by token, validates and submits the answers', async () => {
    routes['GET /public/anamnesis/tok'] = () => ({ title: 'Anamnese geral', schema: { type: 'object', required: ['alergias'], properties: { alergias: { type: 'string', title: 'Alergias' } } }, draft: {} });
    routes['POST /public/anamnesis/tok/submit'] = () => ({ submitted: true });
    const user = userEvent.setup();
    renderAt('/formulario/tok');
    expect(await screen.findByRole('heading', { name: 'Anamnese geral' })).toBeInTheDocument();
    expect(screen.queryByText('Enviar respostas')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /enviar anamnese/i }));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.type(screen.getByLabelText(/alergias/i), 'Pólen');
    await user.click(screen.getByRole('button', { name: /enviar anamnese/i }));
    expect(await screen.findByText(/Anamnese enviada. Obrigado!/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ answers: { alergias: 'Pólen' } });
  });

  it('shows the API error for invalid links', async () => {
    routes['GET /public/anamnesis/bad'] = () => ({ status: 404, body: { error: 'Link inválido, expirado ou já enviado.' } });
    renderAt('/formulario/bad');
    expect(await screen.findByRole('alert')).toHaveTextContent('Link inválido, expirado ou já enviado.');
  });
});
