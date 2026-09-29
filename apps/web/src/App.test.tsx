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
    calls.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
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
    expect(await screen.findByRole('link', { name: /novo paciente/i })).toHaveAttribute('href', '/pacientes/novo');
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
    await user.click(await screen.findByRole('link', { name: /novo paciente/i }));
    await user.type(await screen.findByLabelText(/nome completo/i), 'Paula Souza');
    await user.type(screen.getByLabelText(/e-mail/i), 'paula@example.com');
    await user.click(screen.getByRole('button', { name: /salvar paciente/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ fullName: 'Paula Souza', phone: null, notes: null, email: 'paula@example.com' }));
    expect(await screen.findByRole('heading', { name: 'Pacientes', level: 2 })).toBeInTheDocument();
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

describe('New anamnesis page', () => {
  it('derives unique identifiers from the field name plus a salt and saves the whole schema', async () => {
    routes['POST /api/anamneses'] = () => ({ _id: 'a1', title: 'Facial', versions: [] });
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/nova');
    await user.type(await screen.findByLabelText(/nome do formulário/i), 'Facial');
    await user.click(screen.getByRole('button', { name: /adicionar campo/i }));
    await user.click(screen.getByRole('button', { name: /adicionar campo/i }));
    const names = screen.getAllByLabelText('Nome', { selector: 'input' });
    for (const input of names) {
      await user.clear(input);
      await user.type(input, 'Data de nascimento');
    }
    const identifiers = screen.getAllByText(/^data_de_nascimento_[a-z0-9]{4}$/).map((node) => node.textContent);
    expect(identifiers).toHaveLength(2);
    expect(new Set(identifiers).size).toBe(2);
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /salvar formulário/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    const { title, schema } = calls.find((call) => call.method === 'POST')!.body as { title: string; schema: { properties: Record<string, { title: string; type: string }>; required: string[] } };
    expect(title).toBe('Facial');
    expect(Object.keys(schema.properties)).toEqual(identifiers);
    expect(schema.required).toEqual([identifiers[0]]);
  });

  it('requires at least one field', async () => {
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/nova');
    await user.type(await screen.findByLabelText(/nome do formulário/i), 'Vazio');
    await user.click(screen.getByRole('button', { name: /salvar formulário/i }));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('Combos', () => {
  it('creates a promotional combo with procedures and validity', async () => {
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Limpeza de pele', baseSessions: 3, priceCents: 15000, versions: [] }];
    routes['GET /api/combos'] = () => [{ _id: 'c0', name: 'Combo verão', priceCents: 50000, promotionalPriceCents: 40000, validUntil: '2999-01-01T00:00:00Z', items: [{}, {}] }];
    routes['POST /api/combos'] = () => ({ _id: 'c1' });
    const user = userEvent.setup();
    renderAt('/procedimentos');
    expect(await screen.findByText('Promocional')).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: /novo combo/i }));
    await user.type(await screen.findByLabelText(/^Nome/), 'Combo facial');
    await user.type(screen.getByLabelText(/preço do combo/i), '500');
    await user.click(screen.getByRole('checkbox', { name: /limpeza de pele/i }));
    await user.type(screen.getByLabelText(/sessões de limpeza de pele/i), '5');
    await user.click(screen.getByRole('checkbox', { name: /combo promocional/i }));
    await user.type(screen.getByLabelText(/preço promocional/i), '400');
    await user.click(screen.getByRole('button', { name: 'Válido até' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: /ano/i }), '2030');
    await user.selectOptions(screen.getByRole('combobox', { name: /mês/i }), '11');
    await user.click(screen.getByRole('button', { name: /31 de dezembro de 2030/i }));
    expect(screen.getByRole('button', { name: /válido até/i })).toHaveTextContent('31/12/2030');
    await user.click(screen.getByRole('button', { name: /salvar combo/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/combos')).toBe(true));
    expect(calls.find((call) => call.method === 'POST')!.body).toMatchObject({ name: 'Combo facial', priceCents: 50000, promotionalPriceCents: 40000, validUntil: '2030-12-31', items: [{ procedureId: 'pr1', sessionsOverride: 5 }] });
  });
});

describe('Field types', () => {
  it('offers date, phone, digits-only and choice fields and stores them in the schema', async () => {
    routes['POST /api/anamneses'] = () => ({ _id: 'a2', title: 'Tipos', versions: [] });
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/nova');
    await user.type(await screen.findByLabelText(/nome do formulário/i), 'Tipos');
    const add = async (name: string, kind: string) => {
      await user.click(screen.getByRole('button', { name: /adicionar campo/i }));
      const nameInput = screen.getAllByLabelText('Nome', { selector: 'input' }).at(-1)!;
      await user.clear(nameInput);
      await user.type(nameInput, name);
      await user.selectOptions(screen.getAllByLabelText('Tipo').at(-1)!, kind);
    };
    await add('Nascimento', 'date');
    await add('Celular', 'phone');
    await add('RG', 'digits');
    await add('Turno', 'choice');
    await user.click(screen.getByRole('button', { name: /salvar formulário/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    const { schema } = calls.find((call) => call.method === 'POST')!.body as { schema: { properties: Record<string, Record<string, unknown>> } };
    const byKind = Object.fromEntries(Object.values(schema.properties).map((field) => [field['x-kind'], field]));
    expect(byKind.date).toMatchObject({ type: 'string', format: 'date' });
    expect(byKind.phone).toMatchObject({ type: 'string', pattern: expect.stringContaining('\\d{4,5}') });
    expect(byKind.digits).toMatchObject({ pattern: '^\\d+$' });
    expect(byKind.choice).toMatchObject({ enum: ['Opção 1', 'Opção 2'] });
  });

  it('masks phone and keeps only digits in numeric fields on the public form', async () => {
    routes['GET /public/anamnesis/mask'] = () => ({
      title: 'Contato',
      schema: { type: 'object', properties: { tel: { type: 'string', title: 'Telefone', 'x-kind': 'phone', pattern: '^\\(\\d{2}\\) \\d{4,5}-\\d{4}$' }, rg: { type: 'string', title: 'RG', 'x-kind': 'digits', pattern: '^\\d+$' } } },
      draft: {},
    });
    const user = userEvent.setup();
    renderAt('/formulario/mask');
    await user.type(await screen.findByLabelText('Telefone'), '11987654321');
    await user.type(screen.getByLabelText('RG'), '12.3a4-5');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98765-4321');
    expect(screen.getByLabelText('RG')).toHaveValue('12345');
  });
});

describe('Anamnesis edit and versions', () => {
  const schema = (title: string) => ({ type: 'object', properties: { alergias_ab12: { type: 'string', title, 'x-kind': 'text' } } });
  const facial = () => ({
    _id: 'a1',
    title: 'Facial',
    versions: [
      { version: 1, schema: schema('Alergias'), origin: 'created', createdAt: '2026-01-01T10:00:00Z' },
      { version: 2, schema: schema('Alergias e reações'), origin: 'edited', createdAt: '2026-02-01T10:00:00Z' },
    ],
  });

  it('saves an edit as a new version through the versions endpoint', async () => {
    routes['GET /api/anamneses'] = () => [facial()];
    routes['POST /api/anamneses/a1/versions'] = () => ({});
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/a1');
    const name = await screen.findByDisplayValue('Alergias e reações');
    await user.clear(name);
    await user.type(name, 'Alergias conhecidas');
    await user.click(screen.getByRole('button', { name: /salvar como v3/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.url).toBe('/api/anamneses/a1/versions'));
    const body = calls.find((call) => call.method === 'POST')!.body as { schema: { properties: Record<string, { title: string }> } };
    expect(Object.values(body.schema.properties)[0].title).toBe('Alergias conhecidas');
  });

  it('lists versions and restores the chosen one as a new version (rollback)', async () => {
    routes['GET /api/anamneses'] = () => [facial()];
    routes['POST /api/anamneses/a1/versions'] = () => ({});
    const user = userEvent.setup();
    renderAt('/formularios-anamnese');
    await user.click(await screen.findByRole('button', { name: /versões/i }));
    const list = await screen.findByRole('radiogroup', { name: /versões disponíveis/i });
    expect(within(list).getByRole('radio', { name: /v2.*atual/i })).toBeDisabled();
    await user.click(within(list).getByRole('radio', { name: /v1/i }));
    expect(screen.getByText(/será criada a/i)).toHaveTextContent('v3 como cópia da v1');
    await user.click(screen.getByRole('button', { name: /fazer rollback/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ restoreVersion: 1 }));
  });

  it('has a usable preview: typing fills the field and Limpar resets it', async () => {
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/nova');
    await user.click(await screen.findByRole('button', { name: /adicionar campo/i }));
    const nameInput = screen.getAllByLabelText('Nome', { selector: 'input' })[0];
    await user.clear(nameInput);
    await user.type(nameInput, 'Observação');
    expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    const preview = (await screen.findAllByLabelText('Observação')).at(-1)!;
    await user.type(preview, 'teste');
    expect(preview).toHaveValue('teste');
    await user.click(screen.getByRole('button', { name: /^limpar$/i }));
    expect(screen.getAllByLabelText('Observação').at(-1)).toHaveValue('');
  });
});

describe('Session page', () => {
  it('records a session from a full page using the procedure fields', async () => {
    routes['GET /api/plans'] = () => [{ _id: 'pl1', patientId: 'p1', offerName: 'Limpeza', priceCents: 1000, payments: [], items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3, sessionSchema: { type: 'object', properties: { produto: { type: 'string', title: 'Produto' } } } }] }];
    routes['POST /api/sessions'] = () => ({ _id: 's1' });
    routes['GET /api/sessions/s1'] = () => ({ _id: 's1', patientId: 'p1', procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', data: {}, schemaSnapshot: { type: 'object', properties: {} }, photos: [] });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/sessao/it1');
    await user.type(await screen.findByLabelText('Produto'), 'Ácido');
    await user.type(screen.getByLabelText('Observações'), 'Sem intercorrências');
    await user.click(screen.getByRole('button', { name: /salvar sessão/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ planId: 'pl1', planItemId: 'it1', data: { produto: 'Ácido' }, notes: 'Sem intercorrências' }));
  });
});

describe('Agenda', () => {
  const appointment = { _id: 'ap1', patientId: { _id: 'p1', fullName: 'Marina Alves' }, planItemIds: ['it1'], startsAt: '2026-09-29T14:00:00Z', endsAt: '2026-09-29T15:00:00Z', status: 'planned', notes: 'Trazer exames' };
  const plan = { _id: 'pl1', patientId: 'p1', offerName: 'Limpeza', priceCents: 1000, payments: [], items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3 }] };

  it('opens an appointment to view its details and deletes it after confirmation', async () => {
    routes['GET /api/appointments'] = () => [appointment];
    routes['GET /api/plans'] = () => [plan];
    routes['DELETE /api/appointments/ap1'] = () => ({ deleted: true });
    const user = userEvent.setup();
    renderAt('/agenda');
    const event = await screen.findByTitle('Marina Alves · Agendado');
    await user.click(event);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Limpeza de pele')).toBeInTheDocument();
    expect(within(dialog).getByText('Trazer exames')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /excluir/i }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: /sim, excluir/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/appointments/ap1')).toBe(true));
  });
});

describe('Session follow-up', () => {
  const session = (photos: unknown[] = []) => ({ _id: 's1', patientId: { _id: 'p1', fullName: 'Marina Alves' }, procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', notes: 'Pele sensível', data: { produto: 'Ácido' }, schemaSnapshot: { type: 'object', properties: { produto: { type: 'string', title: 'Produto' } } }, photos });

  it('edits notes and data of a performed session', async () => {
    routes['GET /api/sessions/s1'] = () => session();
    routes['PATCH /api/sessions/s1'] = () => ({});
    const user = userEvent.setup();
    renderAt('/pacientes/p1/sessoes/s1');
    const notes = await screen.findByLabelText(/observações da sessão/i);
    expect(notes).toHaveValue('Pele sensível');
    await user.clear(notes);
    await user.type(notes, 'Sem reações');
    await user.click(screen.getByRole('button', { name: /salvar acompanhamento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ data: { produto: 'Ácido' }, notes: 'Sem reações' }));
  });

  it('attaches a photo (presign → upload → register) and removes another', async () => {
    routes['GET /api/sessions/s1'] = () => session([{ _id: 'ph1', objectKey: 'uploads/a', phase: 'before', notes: 'Antes do peeling', url: 'https://files.test/a.png' }]);
    routes['POST /api/uploads/presign'] = () => ({ uploadUrl: 'https://files.test/upload', objectKey: 'uploads/new' });
    routes['PUT https://files.test/upload'] = () => ({});
    routes['POST /api/sessions/s1/photos'] = () => ({ _id: 'ph2' });
    routes['DELETE /api/sessions/s1/photos/ph1'] = () => ({ deleted: true });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/sessoes/s1');
    expect(await screen.findByAltText('Antes do peeling')).toHaveAttribute('src', 'https://files.test/a.png');
    await user.click(screen.getByRole('radio', { name: 'Depois' }));
    await user.type(screen.getByLabelText(/legenda da foto/i), 'Resultado');
    await user.upload(screen.getByLabelText(/selecionar fotos/i), new File(['x'], 'depois.png', { type: 'image/png' }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/sessions/s1/photos')?.body).toEqual({ objectKey: 'uploads/new', phase: 'after', notes: 'Resultado' }));
    expect(calls.some((call) => call.method === 'PUT' && call.url === 'https://files.test/upload')).toBe(true);
    await user.click(screen.getByRole('button', { name: /remover foto/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/sessions/s1/photos/ph1')).toBe(true));
  });

  it('rejects files that are not images', async () => {
    routes['GET /api/sessions/s1'] = () => session();
    const user = userEvent.setup({ applyAccept: false });
    renderAt('/pacientes/p1/sessoes/s1');
    await user.upload(await screen.findByLabelText(/selecionar fotos/i), new File(['x'], 'nota.pdf', { type: 'application/pdf' }));
    expect(calls.some((call) => call.url === '/api/uploads/presign')).toBe(false);
  });
});
