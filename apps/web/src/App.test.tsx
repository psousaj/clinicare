import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from './router';

type Handler = (init: RequestInit | undefined) => unknown;
const marina = { _id: 'p1', fullName: 'Marina Alves', phone: '11999990000', email: null, notes: null, createdAt: '2026-09-29T10:00:00Z' };
let routes: Record<string, Handler>;
let calls: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  calls = [];
  routes = {
    'GET /api/auth/get-session': () => ({ user: { id: 'u1', tenantId: 't1' } }),
    'GET /api/patients': () => [marina],
  };
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
  it('redirects unauthenticated visitors to login', async () => {
    routes['GET /api/auth/get-session'] = () => null;
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Entrar na sua clínica' })).toBeInTheDocument();
  });

  it('shows patient entry point and recently attended patients from the API (_id → id)', async () => {
    routes['GET /api/attendances'] = () => [
      { _id: 's2', patientId: { _id: 'p1', fullName: 'Marina Alves' }, procedureName: 'Peeling', performedAt: '2026-09-29T15:00:00Z', schemaSnapshot: {}, photos: [] },
      { _id: 's1', patientId: { _id: 'p1', fullName: 'Marina Alves' }, procedureName: 'Limpeza de pele', performedAt: '2026-09-01T15:00:00Z', schemaSnapshot: {}, photos: [] },
    ];
    renderAt('/');
    expect(await screen.findByRole('link', { name: /novo paciente/i })).toHaveAttribute('href', '/pacientes/novo');
    expect(await screen.findByText(/Gestão de pacientes, procedimentos e cuidados/i)).toBeInTheDocument();
    const row = await screen.findByRole('link', { name: /Marina Alves/ });
    expect(row).toHaveAttribute('href', '/pacientes/p1');
    expect(row).toHaveTextContent('Peeling · 29/09/2026');
    expect(screen.getAllByRole('link', { name: /Marina Alves/ })).toHaveLength(1);
  });

  it('only lists patients with a performed attendance as recently attended', async () => {
    renderAt('/');
    expect(await screen.findByText(/Nenhum atendimento realizado ainda/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Marina Alves/ })).not.toBeInTheDocument();
  });

  it('filters patients through the validated ?q= search param', async () => {
    const router = renderAt('/pacientes?q=zzz');
    await screen.findByRole('heading', { name: 'Pacientes', level: 2 });
    await waitFor(() => expect(calls.some((call) => call.url === '/api/patients')).toBe(true));
    expect(screen.queryByRole('link', { name: /^MAMarina/ })).not.toBeInTheDocument();
    await router.navigate({ to: '/pacientes', search: { q: 'mari' } });
    expect(await screen.findByRole('link', { name: /^MAMarina/ })).toBeInTheDocument();
  });

  it('validates and posts a new patient', async () => {
    routes['POST /api/patients'] = () => ({ ...marina, _id: 'p2' });
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('link', { name: /novo paciente/i }));
    await user.type(await screen.findByLabelText(/nome completo/i), 'Paula Souza');
    await user.type(screen.getByLabelText('Telefone'), '11999990000');
    await user.type(screen.getByLabelText(/e-mail/i), 'paula@example.com');
    await user.type(screen.getByLabelText('CPF'), '12345678901');
    await user.click(screen.getByRole('button', { name: /salvar paciente/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ fullName: 'Paula Souza', birthDate: null, phone: '11999990000', email: 'paula@example.com', cpf: '123.456.789-01', notes: null }));
    expect(await screen.findByRole('heading', { name: 'Pacientes', level: 2 })).toBeInTheDocument();
  });
});

describe('Finance', () => {
  it('shows received amount, open balance and payment status separately', async () => {
    routes['GET /api/followups'] = () => [{ _id: 'f1', patientId: 'p1', offerName: 'Combo facial', priceCents: 10000, payments: [{ amountCents: 2500 }], items: [], contracts: [], anamneses: [] }];
    const user = userEvent.setup();
    renderAt('/financeiro');
    expect(await screen.findByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();
    expect(await screen.findByText('Parcial')).toBeInTheDocument();
    expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
    expect(screen.getByText('Falta receber')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /registrar pagamento/i }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/falta R\$\s*75,00/i);
    expect(screen.getByLabelText(/valor recebido/i)).toHaveValue(75);
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
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Limpeza de pele', baseSessions: 3, durationMinutes: 60, standalone: false, active: true, priceCents: 15000, versions: [] }];
    routes['GET /api/combos'] = () => [{ _id: 'c0', name: 'Combo verão', priceCents: 50000, promotionalPriceCents: 40000, validUntil: '2999-01-01T00:00:00Z', items: [{}, {}] }];
    routes['POST /api/combos'] = () => ({ _id: 'c1' });
    const user = userEvent.setup();
    renderAt('/procedimentos');
    await user.click(await screen.findByRole('tab', { name: /combos/i }));
    expect(await screen.findByText('Promocional')).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: /novo combo/i }));
    await user.type(await screen.findByLabelText(/^Nome/), 'Combo facial');
    await user.click(screen.getByRole('button', { name: /adicionar procedimento/i }));
    await user.type(await screen.findByLabelText('Buscar procedimento'), 'zzz');
    expect(await screen.findByText(/nenhum procedimento encontrado/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar procedimento'));
    await user.click(await screen.findByRole('button', { name: /Limpeza de pele/ }));
    const sessions = screen.getByLabelText(/sessões de limpeza de pele/i);
    expect(sessions).toHaveValue(3);
    await user.clear(sessions);
    await user.type(sessions, '5');
    expect(screen.getByLabelText(/preço do combo/i)).toHaveValue(750);
    expect(screen.getByText(/Valor integral: R\$\s*750,00/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /combo promocional/i }));
    await user.type(screen.getByLabelText(/preço promocional/i), '400');
    await user.click(screen.getByRole('button', { name: 'Válido até' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: /ano/i }), '2030');
    await user.selectOptions(screen.getByRole('combobox', { name: /mês/i }), '11');
    await user.click(screen.getByRole('button', { name: /31 de dezembro de 2030/i }));
    expect(screen.getByRole('button', { name: /válido até/i })).toHaveTextContent('31/12/2030');
    await user.click(screen.getByRole('button', { name: /salvar combo/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/combos')).toBe(true));
    expect(calls.find((call) => call.method === 'POST')!.body).toMatchObject({ name: 'Combo facial', priceCents: 75000, promotionalPriceCents: 40000, validUntil: '2030-12-31', items: [{ procedureId: 'pr1', sessions: 5 }] });
  });
});

describe('Catalog list and editing', () => {
  const limpeza = { _id: 'pr1', name: 'Limpeza de pele', description: 'Higienização', durationMinutes: 60, priceCents: 15000, active: true, sessionSchema: {}, versions: [] };
  const peeling = { ...limpeza, _id: 'pr2', name: 'Peeling', active: false };
  const verao = { _id: 'c0', name: 'Combo verão', priceCents: 80000, promotionalPriceCents: 40000, validUntil: '2999-01-01T00:00:00Z', active: true, requireNewAnamnesis: false, items: [{ procedureId: 'pr1', sessionsOverride: 5 }] };

  it('lists procedures with status filter, and deactivates one through PUT', async () => {
    routes['GET /api/procedures'] = () => [limpeza, peeling];
    routes['PUT /api/procedures/pr1'] = () => limpeza;
    const user = userEvent.setup();
    renderAt('/procedimentos');
    const row = (await screen.findByRole('link', { name: 'Limpeza de pele' })).closest('tr')!;
    expect(screen.queryByRole('link', { name: 'Peeling' })).not.toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação' }), 'todos');
    expect(await screen.findByRole('link', { name: 'Peeling' })).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ active: false }));
    expect(calls.find((call) => call.method === 'PUT')!.url).toBe('/api/procedures/pr1');
  });

  it('edits a procedure and saves it with a PUT', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['PUT /api/procedures/pr1'] = () => limpeza;
    const user = userEvent.setup();
    renderAt('/procedimentos');
    await user.click(await screen.findByRole('link', { name: 'Editar Limpeza de pele' }));
    const name = await screen.findByLabelText(/^Nome/);
    expect(name).toHaveValue('Limpeza de pele');
    await user.clear(name);
    await user.type(name, 'Limpeza profunda');
    expect(screen.getByLabelText(/duração por sessão/i)).toHaveValue(60);
    await user.type(screen.getByLabelText(/sessões base/i), '3');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    expect(calls.find((call) => call.method === 'PUT')!.body).toMatchObject({ name: 'Limpeza profunda', baseSessions: 3, durationMinutes: 60, priceCents: 15000, active: true });
    expect(await screen.findByRole('tab', { name: /procedimentos/i })).toBeInTheDocument();
  });

  it('edits a combo and shows its procedures by name', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [verao];
    routes['PUT /api/combos/c0'] = () => verao;
    const user = userEvent.setup();
    renderAt('/procedimentos?aba=combos');
    expect(await screen.findByText('Limpeza de pele · 5x')).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Editar Combo verão' }));
    const name = await screen.findByLabelText(/^Nome/);
    await user.clear(name);
    await user.type(name, 'Combo verão 2');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    expect(calls.find((call) => call.method === 'PUT')!.url).toBe('/api/combos/c0');
    expect(calls.find((call) => call.method === 'PUT')!.body).toMatchObject({ name: 'Combo verão 2', priceCents: 80000, promotionalPriceCents: 40000, items: [{ procedureId: 'pr1', sessions: 5 }] });
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

describe('Contract edit and versions', () => {
  const contract = () => ({
    _id: 'c1',
    id: 'c1',
    title: 'Contrato padrão',
    kind: 'standard',
    active: true,
    currentVersion: 1,
    draftDocxHash: null,
    versions: [
      { version: 1, origin: 'created', createdAt: '2026-01-01T10:00:00Z', hasSourceDocx: true, hasRenderedPdf: false, allowedPlaceholders: ['patient.name'], requiredPlaceholders: [] },
    ],
  });

  it('lists contracts with the published version status', async () => {
    routes['GET /api/contracts'] = () => [contract()];
    renderAt('/contratos');
    expect(await screen.findByText(/1 versão · atual v1/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /editar/i })).toHaveAttribute('href', '/contratos/c1');
  });

  it('shows the immutable version notice and saves metadata through PATCH', async () => {
    routes['GET /api/contracts'] = () => [contract()];
    routes['PATCH /api/contracts/c1'] = () => ({});
    const user = userEvent.setup();
    renderAt('/contratos/c1');
    expect(await screen.findByText(/^Versão atual/)).toHaveTextContent('Versão atual v1 (imutável). Publicar o draft gera a v2');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({ url: '/api/contracts/c1' }));
    expect(calls.some((call) => call.url === '/api/contracts/c1/versions')).toBe(false);
  });

  it('shows draft upload, placeholders and publish without legacy text editing', async () => {
    routes['GET /api/contracts'] = () => [contract()];
    routes['GET /api/contracts/placeholders'] = () => ['patient.name', 'clinic.name'];
    renderAt('/contratos/c1');
    expect(await screen.findByRole('heading', { name: /draft docx/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Texto do contrato')).not.toBeInTheDocument();
    expect(await screen.findByText('{patient.name}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publicar v2/i })).toBeInTheDocument();
  });

  it('hashes and uploads a DOCX draft without depending on crypto.subtle', async () => {
    routes['GET /api/contracts'] = () => [contract()];
    routes['GET /api/contracts/placeholders'] = () => ['patient.name'];
    routes['POST /api/contracts/c1/draft/presign'] = () => ({ objectKey: 'object-1', uploadUrl: 'https://storage.example/upload' });
    routes['PUT https://storage.example/upload'] = () => ({});
    routes['PUT /api/contracts/c1/draft'] = () => ({});
    const user = userEvent.setup();
    renderAt('/contratos/c1');
    await user.upload(await screen.findByLabelText('Arquivo .docx'), new File(['docx fixture'], 'contract.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    await user.click(await screen.findByRole('button', { name: /salvar draft/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/contracts/c1/draft' && call.method === 'PUT')?.body).toMatchObject({
      objectKey: 'object-1', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 12,
    }));
    expect((calls.find((call) => call.url === '/api/contracts/c1/draft' && call.method === 'PUT')?.body as { contentHash: string }).contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('lists published versions as read-only history', async () => {
    routes['GET /api/contracts'] = () => [contract()];
    const user = userEvent.setup();
    renderAt('/contratos');
    await user.click(await screen.findByRole('button', { name: /versões/i }));
    expect(await screen.findByText(/não há rollback de texto/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fazer rollback/i })).not.toBeInTheDocument();
  });

  it('requires the procedure when the contract is specific to one', async () => {
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Peeling', baseSessions: 1, priceCents: 1000, versions: [] }];
    routes['POST /api/contracts'] = () => ({});
    const user = userEvent.setup();
    renderAt('/contratos/novo');
    await user.type(await screen.findByLabelText('Nome do contrato'), 'Contrato do peeling');
    await user.click(screen.getByRole('radio', { name: /procedimento/i }));
    await user.click(screen.getByRole('button', { name: /salvar contrato/i }));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.selectOptions(screen.getByLabelText('Procedimento'), 'pr1');
    await user.click(screen.getByRole('button', { name: /salvar contrato/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ kind: 'procedure', procedureId: 'pr1', comboId: null }));
    expect(calls.find((call) => call.method === 'POST')?.body).not.toMatchObject({ content: expect.anything() });
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
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
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

  it('uses full-width title, description and validity fields', async () => {
    renderAt('/formularios-anamnese/nova');
    const name = await screen.findByLabelText(/nome do formulário/i);
    const description = screen.getByLabelText(/descrição para o paciente/i);
    const validity = screen.getByLabelText(/validade \(meses\)/i);
    for (const field of [name, description, validity]) expect(field.closest('label')).not.toHaveClass('max-w-xl', 'max-w-2xl', 'max-w-3xl');
    expect(validity).not.toHaveClass('max-w-52');
  });

  it('previews the form as the patient sees it without saving', async () => {
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/nova');
    await user.type(await screen.findByLabelText(/nome do formulário/i), 'Anamnese facial');
    await user.type(screen.getByLabelText(/descrição para o paciente/i), 'Conte seu histórico.');
    await user.click(await screen.findByRole('button', { name: /adicionar campo/i }));
    await user.click(screen.getByRole('button', { name: /pré-visualizar/i }));
    const preview = await screen.findByRole('dialog', { name: /pré-visualização/i });
    expect(within(preview).getByRole('heading', { name: 'Anamnese facial' })).toBeInTheDocument();
    expect(within(preview).getByText('Conte seu histórico.')).toBeInTheDocument();
    expect(within(preview).getByText(/equipe da clínica a conhecer seu histórico/)).toBeInTheDocument();
    expect(within(preview).getByText('Campo 1')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.click(within(preview).getByRole('button', { name: /fechar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /pré-visualização/i })).not.toBeInTheDocument());
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

describe('Attendance page', () => {
  it('records a session from a full page using the procedure fields', async () => {
    routes['GET /api/followups'] = () => [{ _id: 'pl1', patientId: 'p1', offerName: 'Limpeza', priceCents: 1000, payments: [], items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3, sessionSchema: { type: 'object', properties: { produto: { type: 'string', title: 'Produto' } } } }] }];
    routes['POST /api/attendances'] = () => ({ _id: 's1' });
    routes['GET /api/attendances/s1'] = () => ({ _id: 's1', patientId: 'p1', procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', data: {}, schemaSnapshot: { type: 'object', properties: {} }, photos: [] });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/novo-atendimento/it1');
    await user.type(await screen.findByLabelText('Produto'), 'Ácido');
    await user.type(screen.getByLabelText('Observações'), 'Sem intercorrências');
    await user.click(screen.getByRole('button', { name: /salvar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ followupId: 'pl1', followupItemId: 'it1', data: { produto: 'Ácido' }, notes: 'Sem intercorrências' }));
  });
});

describe('Agenda', () => {
  const appointment = { _id: 'ap1', patientId: { _id: 'p1', fullName: 'Marina Alves' }, items: [{ _id: 'ai1', followupId: 'pl1', followupItemId: 'it1', procedureId: 'pr1', procedureName: 'Limpeza de pele', quantity: 2, minutesEach: 30, confirmationStatus: 'pending' }], startsAt: '2026-10-06T14:00:00Z', endsAt: '2026-10-06T15:00:00Z', status: 'planned', notes: 'Trazer exames' };
  const followup = { _id: 'pl1', patientId: 'p1', offerName: 'Limpeza', priceCents: 1000, payments: [], items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3 }] };

  it('opens an appointment directly in the edit dialog and deletes it after confirmation', async () => {
    routes['GET /api/appointments'] = () => [appointment];
    routes['GET /api/followups'] = () => [followup];
    routes['DELETE /api/appointments/ap1'] = () => ({ deleted: true });
    const user = userEvent.setup();
    renderAt('/agenda');
    const event = await screen.findByTitle('Marina Alves · Agendado');
    await user.click(event);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Editar agendamento' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Limpeza de pele/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /excluir agendamento/i }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: /confirmar exclusão/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/appointments/ap1')).toBe(true));
  });

  it('opens a new appointment when a calendar time cell is clicked', async () => {
    routes['GET /api/appointments'] = () => [];
    const user = userEvent.setup();
    renderAt('/agenda');
    await screen.findByRole('heading', { name: 'Semana de agendamentos' });
    const cell = document.querySelector('.fc-timegrid-slot-lane[data-time="10:00:00"]');
    expect(cell).not.toBeNull();
    await user.click(cell!);
    expect(await screen.findByRole('heading', { name: /agendamento/i })).toBeInTheDocument();
  });

  it('saves date and time changes from the calendar event editor', async () => {
    routes['GET /api/appointments'] = () => [appointment];
    routes['GET /api/followups'] = () => [followup];
    routes['PATCH /api/appointments/ap1'] = () => appointment;
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(await screen.findByTitle('Marina Alves · Agendado'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH' && call.url === '/api/appointments/ap1')).toBe(true));
  });

  it('does not offer delete for a confirmed calendar appointment', async () => {
    routes['GET /api/appointments'] = () => [{ ...appointment, status: 'confirmed' }];
    routes['GET /api/followups'] = () => [followup];
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(await screen.findByTitle('Marina Alves · Confirmado'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /excluir agendamento/i })).not.toBeInTheDocument();
  });

  it('sends the currently selected appointment items when confirming', async () => {
    routes['GET /api/appointments'] = () => [appointment];
    routes['GET /api/followups'] = () => [followup];
    routes['POST /api/appointments/ap1/confirm'] = () => appointment;
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(await screen.findByTitle('Marina Alves · Agendado'));
    const dialog = await screen.findByRole('dialog');
    const checkbox = within(dialog).getByRole('checkbox', { name: /selecionar limpeza de pele/i });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: /confirmar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.url === '/api/appointments/ap1/confirm')?.body).toEqual({ selectedItemIds: [] }));
  });

  it('asks for payment when confirming an unpaid follow-up session', async () => {
    routes['GET /api/appointments'] = () => [appointment];
    routes['GET /api/followups'] = () => [followup];
    routes['POST /api/appointments/ap1/confirm'] = () => appointment;
    routes['POST /api/payments'] = () => ({ _id: 'payment1' });
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(await screen.findByTitle('Marina Alves · Agendado'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Pagamento do acompanhamento pendente/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /continuar para pagamento/i }));
    await user.type(within(dialog).getByLabelText('Valor recebido do plano'), '5');
    await user.click(within(dialog).getByRole('button', { name: /registrar e confirmar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.url === '/api/payments')?.body).toMatchObject({ followupId: 'pl1', amountCents: 500 }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/appointments/ap1/confirm')).toBe(true));
  });
});

describe('Attendance follow-up', () => {
  const session = (photos: unknown[] = []) => ({ _id: 's1', patientId: { _id: 'p1', fullName: 'Marina Alves' }, procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', notes: 'Pele sensível', data: { produto: 'Ácido' }, schemaSnapshot: { type: 'object', properties: { produto: { type: 'string', title: 'Produto' } } }, photos });

  it('edits notes and data of a performed attendance', async () => {
    routes['GET /api/attendances/s1'] = () => session();
    routes['PATCH /api/attendances/s1'] = () => ({});
    const user = userEvent.setup();
    renderAt('/pacientes/p1/atendimentos/s1');
    const notes = await screen.findByLabelText(/observações do atendimento/i);
    expect(notes).toHaveValue('Pele sensível');
    await user.clear(notes);
    await user.type(notes, 'Sem reações');
    await user.click(screen.getByRole('button', { name: /salvar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ data: { produto: 'Ácido' }, notes: 'Sem reações', durationMinutes: null }));
  });

  it('attaches a photo (presign → upload → register) and removes another', async () => {
    routes['GET /api/attendances/s1'] = () => session([{ _id: 'ph1', objectKey: 'uploads/a', phase: 'before', notes: 'Antes do peeling', url: 'https://files.test/a.png' }]);
    routes['POST /api/uploads/presign'] = () => ({ uploadUrl: 'https://files.test/upload', objectKey: 'uploads/new', uploadToken: 'signed-token' });
    routes['PUT https://files.test/upload'] = () => ({});
    routes['POST /api/attendances/s1/photos'] = () => ({ _id: 'ph2' });
    routes['DELETE /api/attendances/s1/photos/ph1'] = () => ({ deleted: true });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/atendimentos/s1');
    expect(await screen.findByAltText('Antes do peeling')).toHaveAttribute('src', 'https://files.test/a.png');
    await user.click(screen.getByRole('radio', { name: 'Depois' }));
    await user.type(screen.getByLabelText(/legenda da foto/i), 'Resultado');
    await user.upload(screen.getByLabelText(/selecionar fotos/i), new File(['x'], 'depois.png', { type: 'image/png' }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/attendances/s1/photos')?.body).toMatchObject({ objectKey: 'uploads/new', phase: 'after', notes: 'Resultado', contentHash: expect.stringMatching(/^sha256:/), uploadToken: 'signed-token' }));
    expect(calls.some((call) => call.method === 'PUT' && call.url === 'https://files.test/upload')).toBe(true);
    await user.click(screen.getByRole('button', { name: /remover foto/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/attendances/s1/photos/ph1')).toBe(true));
  });

  it('rejects files that are not images', async () => {
    routes['GET /api/attendances/s1'] = () => session();
    const user = userEvent.setup({ applyAccept: false });
    renderAt('/pacientes/p1/atendimentos/s1');
    await user.upload(await screen.findByLabelText(/selecionar fotos/i), new File(['x'], 'nota.pdf', { type: 'application/pdf' }));
    expect(calls.some((call) => call.url === '/api/uploads/presign')).toBe(false);
  });
});

const pendingFollowup = (extra: Record<string, unknown> = {}) => ({
  _id: 'at1', patientId: 'p1', offerType: 'combo', offerName: 'Combo pele', priceCents: 15000, payments: [], contracts: [{ title: 'Contrato padrão', signedAt: null }], blocked: true,
  items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3, sessionsPerformed: 0 }],
  anamneses: [{ id: 'pa1', title: 'Anamnese geral', required: true, answered: false, schemaSnapshot: { type: 'object', properties: { alergias: { type: 'string', title: 'Alergias' } } } }],
  ...extra,
});

describe('Eventos', () => {
  it('supports keyboard selection and shows an empty event without hiding its filters', async () => {
    routes['GET /api/events'] = () => [
      { _id: 'ev1', name: 'Dia facial', eventDate: '2026-10-15', active: false, items: [], contractIds: [], enrolledPatients: [] },
    ];
    const user = userEvent.setup();
    renderAt('/eventos');
    const patients = await screen.findByRole('region', { name: 'Pacientes por evento' });
    const badge = within(patients).getByRole('button', { name: /Dia facial/ });
    expect(badge).toHaveAttribute('aria-pressed', 'false');
    badge.focus();
    await user.keyboard('{Enter}');
    expect(badge).toHaveAttribute('aria-pressed', 'true');
    expect(within(patients).getByText('Nenhum paciente inscrito')).toBeInTheDocument();
    expect(within(patients).getByText('15/10/2026')).toHaveAttribute('datetime', '2026-10-15');
    expect(screen.getByRole('button', { name: 'Reativar Dia facial' })).toBeInTheDocument();
    await user.click(within(patients).getByRole('button', { name: 'Limpar seleção' }));
    expect(badge).toHaveAttribute('aria-pressed', 'false');
    expect(within(patients).getByText('Nenhum evento selecionado')).toBeInTheDocument();
  });

  it('lists enrolled patients after selecting an event badge', async () => {
    routes['GET /api/events'] = () => [
      { _id: 'ev1', name: 'Dia facial', eventDate: '2026-10-15', items: [], contractIds: [], anamnesisIds: [], enrolledPatients: [{ id: 'p1', fullName: 'Ana Souza' }] },
      { _id: 'ev2', name: 'Dia corporal', eventDate: '2026-10-16', items: [], contractIds: [], anamnesisIds: [], enrolledPatients: [{ id: 'p2', fullName: 'Bruno Lima' }] },
    ];
    const user = userEvent.setup();
    renderAt('/eventos');
    expect(await screen.findByText('Nenhum evento selecionado')).toBeInTheDocument();
    const catalog = screen.getByRole('region', { name: 'Eventos cadastrados' });
    const patients = screen.getByRole('region', { name: 'Pacientes por evento' });
    expect(catalog.compareDocumentPosition(patients) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(patients).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(patients).getByRole('button', { name: /dia facial/i }));
    expect(within(patients).getByRole('heading', { name: 'Dia facial' })).toBeInTheDocument();
    expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(within(catalog).getByText('Dia corporal')).toBeInTheDocument();
    await user.click(within(patients).getByRole('button', { name: /dia corporal/i }));
    expect(within(patients).getByRole('link', { name: /Bruno Lima/ })).toHaveAttribute('href', '/pacientes/p2');
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    await user.click(within(patients).getByRole('button', { name: 'Limpar seleção' }));
    expect(within(patients).getByText('Nenhum evento selecionado')).toBeInTheDocument();
    expect(within(patients).queryByRole('link')).not.toBeInTheDocument();
  });

  it('creates an event picking menu items through search, tabs and the selected block', async () => {
    routes['GET /api/procedures'] = () => [
      { _id: 'pr1', name: 'Botox', baseSessions: 1, priceCents: 1000, active: true, versions: [] },
      { _id: 'pr2', name: 'Peeling', baseSessions: 1, priceCents: 2000, active: true, versions: [] },
    ];
    routes['GET /api/combos'] = () => [{ _id: 'c1', name: 'Combo facial', priceCents: 5000, active: true, items: [] }];
    routes['GET /api/contracts'] = () => [{ _id: 'k1', title: 'Padrão', kind: 'standard', active: true, versions: [] }];
    routes['GET /api/anamneses'] = () => [{ _id: 'a1', title: 'Pré', validityMonths: 12, procedureIds: [], versions: [] }];
    routes['GET /api/events'] = () => [];
    routes['POST /api/events'] = () => ({ _id: 'ev1' });
    const user = userEvent.setup();
    renderAt('/eventos');
    await user.click(await screen.findByRole('link', { name: /novo evento/i }));
    await screen.findByRole('heading', { name: /novo evento/i });
    await user.type(screen.getByLabelText(/nome do evento/i), 'Dia da clínica');
    fireEvent.change(screen.getByLabelText(/data do evento/i), { target: { value: '2026-10-15' } });
    // A busca filtra o catálogo antes de marcar.
    await user.type(screen.getByRole('searchbox', { name: /buscar procedimentos/i }), 'bot');
    expect(screen.queryByRole('checkbox', { name: 'Peeling' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Botox' }));
    expect(await screen.findByText(/selecionados \(1\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Combos' }));
    await user.click(screen.getByRole('checkbox', { name: /combo facial/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Padrão' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pré' }));
    await user.click(screen.getByRole('button', { name: /^salvar evento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Dia da clínica', eventDate: '2026-10-15',
      items: [{ kind: 'procedure', procedureId: 'pr1', sessions: 1 }, { kind: 'combo', comboId: 'c1' }],
      contractIds: ['k1'], anamnesisIds: ['a1'],
    }));
  });
});

describe('Offer-owned anamneses', () => {
  const forms = () => [
    { _id: 'a1', title: 'Pré-operatória', validityMonths: 12, procedureIds: [], versions: [] },
    { _id: 'a2', title: 'Alergias', validityMonths: 12, procedureIds: [], versions: [] },
  ];

  it('links forms from the procedure screen through its own endpoint', async () => {
    routes['GET /api/procedures'] = () => [];
    routes['GET /api/anamneses'] = forms;
    routes['POST /api/procedures'] = () => ({ _id: 'pr1' });
    routes['PUT /api/procedures/pr1/anamneses'] = () => ({ _id: 'pr1', anamnesisIds: ['a1'] });
    const user = userEvent.setup();
    renderAt('/procedimentos/novo');
    await user.type(await screen.findByLabelText(/^Nome/), 'Botox');
    await user.click(screen.getByRole('checkbox', { name: 'Pré-operatória' }));
    await user.click(screen.getByRole('button', { name: /salvar procedimento/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/procedures/pr1/anamneses')?.body).toEqual({ anamnesisIds: ['a1'] }));
  });

  it('sends the plan-owned forms and shows the ones inherited from procedures', async () => {
    const limpeza = { _id: 'pr1', name: 'Limpeza de pele', baseSessions: 1, priceCents: 15000, anamnesisIds: ['a2'], versions: [] };
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/anamneses'] = forms;
    routes['GET /api/contracts'] = () => [{ _id: 'c1', title: 'Contrato padrão', kind: 'standard', active: true, versions: [] }];
    routes['POST /api/plans'] = () => ({ _id: 'pl1' });
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.type(await screen.findByLabelText('Nome do plano'), 'Plano Pele');
    await user.click(await screen.findByRole('checkbox', { name: /limpeza de pele/i }));
    expect(await screen.findByText(/também exigidas pelos procedimentos/i)).toHaveTextContent('Alergias (via Limpeza de pele)');
    await user.click(screen.getByRole('checkbox', { name: 'Pré-operatória' }));
    await user.click(await screen.findByRole('checkbox', { name: /contrato padrão/i }));
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/plans')?.body).toMatchObject({ anamnesisIds: ['a1'] }));
  });

  it('sends the combo-owned forms', async () => {
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Limpeza de pele', baseSessions: 1, durationMinutes: 60, active: true, priceCents: 15000, versions: [] }];
    routes['GET /api/anamneses'] = forms;
    routes['POST /api/combos'] = () => ({ _id: 'c1' });
    const user = userEvent.setup();
    renderAt('/procedimentos/combos/novo');
    await user.type(await screen.findByLabelText(/^Nome/), 'Combo facial');
    await user.click(screen.getByRole('button', { name: /adicionar procedimento/i }));
    await user.click(await screen.findByRole('button', { name: /Limpeza de pele/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Pré-operatória' }));
    await user.click(screen.getByRole('button', { name: /salvar combo/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/combos')?.body).toMatchObject({ anamnesisIds: ['a1'] }));
  });

  it('no longer asks on the anamnesis form which procedures require it', async () => {
    routes['GET /api/anamneses'] = () => [{ _id: 'a1', title: 'Facial', validityMonths: 12, procedureIds: ['pr1'], versions: [{ version: 1, schema: { type: 'object', properties: {} }, origin: 'created', createdAt: '2026-01-01T10:00:00Z' }] }];
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Limpeza', priceCents: 100, versions: [] }];
    const user = userEvent.setup();
    renderAt('/formularios-anamnese/a1');
    await screen.findByDisplayValue('Facial');
    expect(screen.queryByRole('group', { name: /procedimentos que exigem/i })).not.toBeInTheDocument();
    expect(screen.getByText(/vínculo com procedimentos, combos, planos e eventos/i)).toBeInTheDocument();
  });
});

describe('Acompanhamentos', () => {
  it('does not offer "Solicitar anamnese" on the patient list', async () => {
    renderAt('/pacientes');
    await screen.findByRole('link', { name: /^MAMarina/ });
    expect(screen.queryByRole('button', { name: /solicitar anamnese/i })).not.toBeInTheDocument();
  });

  it('starts an followup from the dashboard choosing patient and offer', async () => {
    routes['GET /api/combos'] = () => [{ _id: 'c1', name: 'Combo verão', priceCents: 80000, active: true, items: [] }];
    routes['GET /api/plans'] = () => [{ _id: 'pl1', name: 'Plano Pele', priceCents: 90000, items: [{ offerType: 'procedure', offerId: 'pr1' }], contractIds: [] }];
    routes['POST /api/followups'] = () => ({ _id: 'at1' });
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /novo acompanhamento/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Paciente' }));
    await user.click(await screen.findByRole('option', { name: 'Marina Alves' }));
    expect(within(within(dialog).getByLabelText('Oferta')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Selecione…', 'Combo - Combo verão', 'Plano - Plano Pele']);
    await user.selectOptions(within(dialog).getByLabelText('Oferta'), 'plan:pl1');
    await user.click(within(dialog).getByRole('button', { name: /iniciar acompanhamento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ patientId: 'p1', offerType: 'plan', offerId: 'pl1' }));
  });

  it('enrolls a patient in an event with the whole menu, without picking items in the dialog', async () => {
    routes['GET /api/combos'] = () => [{ _id: 'c1', name: 'Combo facial', priceCents: 5000, active: true, items: [] }];
    routes['GET /api/events'] = () => [{ _id: 'ev1', name: 'Dia da clínica', eventDate: '2026-10-15', active: true, items: [{ kind: 'procedure', procedureId: 'pr1', sessions: 1 }, { kind: 'combo', comboId: 'c1' }], contractIds: ['k1'] }];
    routes['POST /api/followups'] = () => ({ _id: 'at1' });
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /novo acompanhamento/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Paciente' }));
    await user.click(await screen.findByRole('option', { name: 'Marina Alves' }));
    await user.selectOptions(within(dialog).getByLabelText('Oferta'), 'event:ev1');
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /iniciar acompanhamento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ patientId: 'p1', offerType: 'event', offerId: 'ev1' }));
  });

  it('shows the realized value, not a contracted price, for event followups', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({ offerType: 'event', offerName: 'Dia da clínica', priceCents: 2500, blocked: false, anamneses: [] })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    renderAt('/pacientes/p1');
    const card = await screen.findByRole('article', { name: /dia da clínica \(evento\)/i });
    expect(within(card).getByText('Dia da clínica')).toBeInTheDocument();
    expect(within(card).getByText(/realizado R\$\s?25,00/)).toBeInTheDocument();
  });

  it('cancels an unused event item from the followup card', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({
      offerType: 'event', offerName: 'Dia da clínica', priceCents: 0, blocked: false, anamneses: [],
      items: [
        { _id: 'it1', procedureName: 'Botox', sessionsTotal: 1, sessionsPerformed: 0 },
        { _id: 'it2', procedureName: 'Peeling', sessionsTotal: 1, sessionsPerformed: 0, cancelledAt: '2026-10-07T12:00:00.000Z' },
      ],
    })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    routes['POST /api/followups/at1/items/it1/cancel'] = () => ({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt('/pacientes/p1');
    expect(await screen.findByText('Não realizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /não realizar peeling/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /não realizar botox/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/followups/at1/items/it1/cancel')).toBe(true));
  });

  it('lists pending anamneses on the patient page and copies the link', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup()];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    routes['POST /api/anamnesis-requests'] = () => ({ _id: 'rq1', url: '/formulario/tok9' });
    const user = userEvent.setup();
    renderAt('/pacientes/p1');
    expect(await screen.findByRole('button', { name: /novo acompanhamento/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /solicitar anamnese/i })).not.toBeInTheDocument();
    const pending = await screen.findByRole('region', { name: /anamneses pendentes/i });
    expect(within(pending).getByText('Anamnese geral')).toBeInTheDocument();
    await user.click(within(pending).getByRole('button', { name: /copiar link/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/anamnesis-requests')?.body).toEqual({ patientAnamnesisId: 'pa1' }));
    expect(await screen.findByLabelText('Link da anamnese')).toHaveValue(`${location.origin}/formulario/tok9`);
  });

  it('shows a single area per contract after reprocessing (cancelled row hidden)', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({
      anamneses: [],
      contracts: [
        { id: 'c-old', title: 'Contrato padrão', signedAt: null, status: 'cancelled' },
        { id: 'c-new', title: 'Contrato padrão', signedAt: null, status: 'pending' },
      ],
    })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    renderAt('/pacientes/p1');
    const list = await screen.findByRole('list', { name: 'Contratos de Combo pele' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByRole('button', { name: /histórico de assinaturas/i })).toBeInTheDocument();
  });

  it('disables attendance registration while the followup is idle', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({ offerType: 'plan', status: 'idle', anamneses: [], contracts: [] })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    renderAt('/pacientes/p1');
    const button = await screen.findByRole('button', { name: /registrar atendimento/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Disponível após a assinatura do paciente.');
  });

  it('cancels the followup through a modal with a required reason', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({ anamneses: [], contracts: [] })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    routes['POST /api/followups/at1/cancel'] = () => ({ _id: 'at1' });
    const user = userEvent.setup();
    renderAt('/pacientes/p1');
    await user.click(await screen.findByRole('button', { name: /cancelar acompanhamento/i }));
    const dialog = await screen.findByRole('dialog', { name: /cancelar acompanhamento/i });
    expect(within(dialog).getByRole('button', { name: /confirmar cancelamento/i })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/motivo do cancelamento/i), 'paciente desistiu');
    await user.click(within(dialog).getByRole('button', { name: /confirmar cancelamento/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/followups/at1/cancel')).toBe(true));
    expect(calls.find((call) => call.method === 'POST' && call.url === '/api/followups/at1/cancel')?.body).toEqual({ reason: 'paciente desistiu' });
  });

  it('lists pending and signed contracts below the answered anamneses with shortcuts', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({
      anamneses: [],
      contracts: [
        { id: 'c1', title: 'Contrato padrão', signedAt: null, status: 'generating' },
        { id: 'c2', title: 'Termo adicional', signedAt: '2026-10-07T00:00:05.000Z', status: 'signed' },
      ],
    })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    renderAt('/pacientes/p1');
    const summary = await screen.findByRole('region', { name: 'Contratos' });
    expect(within(summary).getByText('Contrato padrão')).toBeInTheDocument();
    expect(within(summary).getByText('Gerando documento')).toBeInTheDocument();
    expect(within(summary).getByText('Termo adicional')).toBeInTheDocument();
    expect(within(summary).getByText('Assinado')).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: /contrato padrão/i })).toHaveAttribute('href', '#followup-contract-c1');
    expect(within(summary).getByRole('link', { name: /termo adicional/i })).toHaveAttribute('href', '#followup-contract-c2');
  });

  it('lists answered anamneses on the patient page with a link to the answers', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({ anamneses: [{ id: 'pa1', title: 'Anamnese geral', required: true, answered: true, submittedAt: '2026-10-01T10:00:00.000Z', schemaSnapshot: { type: 'object', properties: {} } }] })];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    renderAt('/pacientes/p1');
    const answered = await screen.findByRole('region', { name: /anamneses respondidas/i });
    expect(within(answered).getByText('Anamnese geral')).toBeInTheDocument();
    expect(within(answered).getByRole('link', { name: /ver respostas/i })).toHaveAttribute('href', '/pacientes/p1/anamneses/pa1/respostas');
    expect(screen.queryByRole('region', { name: /anamneses pendentes/i })).not.toBeInTheDocument();
  });

  it('shows submitted anamnesis answers read-only on the answers page', async () => {
    routes['GET /api/patient-anamneses/pa1'] = () => ({
      id: 'pa1', title: 'Anamnese geral', submittedAt: '2026-10-01T10:00:00.000Z',
      schemaSnapshot: { type: 'object', properties: { alergias: { type: 'string', title: 'Alergias' } } },
      answers: { alergias: 'Nenhuma' },
    });
    renderAt('/pacientes/p1/anamneses/pa1/respostas');
    expect(await screen.findByRole('heading', { name: 'Anamnese geral' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Alergias')).toHaveValue('Nenhuma');
    expect(screen.getByLabelText('Alergias')).toBeDisabled();
  });

  it('edits patient data from the patient detail page', async () => {
    routes['GET /api/patients/p1/history'] = () => ({
      patient: { ...marina, phone: '5511999990000', email: 'marina@example.com', cpf: '12345678901', birthDate: '1990-04-12', notes: 'Observação atual' },
      events: [], pending: [],
    });
    routes['PUT /api/patients/p1'] = () => ({});
    const user = userEvent.setup();
    renderAt('/pacientes/p1');
    await user.click(await screen.findByRole('button', { name: /editar paciente/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('CPF')).toHaveValue('123.456.789-01');
    await user.clear(within(dialog).getByLabelText('Nome completo'));
    await user.type(within(dialog).getByLabelText('Nome completo'), 'Marina Souza');
    await user.clear(within(dialog).getByLabelText('Telefone'));
    await user.type(within(dialog).getByLabelText('Telefone'), '11988887777');
    await user.click(within(dialog).getByRole('button', { name: /salvar alterações/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/patients/p1' && call.method === 'PUT')?.body).toEqual({
      fullName: 'Marina Souza', email: 'marina@example.com', phone: '11988887777', cpf: '123.456.789-01', birthDate: '1990-04-12', notes: 'Observação atual',
    }));
  });

  it('lets the professional fill a pending anamnesis on the spot', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup()];
    routes['POST /api/patient-anamneses/pa1/answers'] = () => ({});
    const user = userEvent.setup();
    renderAt('/pacientes/p1/anamneses/pa1');
    await user.type(await screen.findByLabelText('Alergias'), 'Nenhuma');
    await user.click(screen.getByRole('button', { name: /salvar respostas/i }));
    await waitFor(() => expect(calls.find((call) => call.url === '/api/patient-anamneses/pa1/answers')?.body).toEqual({ answers: { alergias: 'Nenhuma' } }));
  });

  it('disables scheduling of items whose followup has a pending anamnesis', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup()];
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /novo agendamento/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Paciente' }));
    await user.click(await screen.findByRole('option', { name: 'Marina Alves' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/anamnese pendente/i);
    expect(within(dialog).getByLabelText(/sessões de limpeza de pele/i)).toBeDisabled();
  });

  it('lists active followup items and standalone procedures only, limited by the appointment minutes', async () => {
    const item = (id: string, procedureId: string, name: string, done: number) => ({ _id: id, procedureId, procedureName: name, sessionsTotal: 4, sessionsPerformed: done });
    const proc = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ _id: id, name, baseSessions: 1, durationMinutes: 30, standalone: true, active: true, priceCents: 10000, versions: [], ...extra });
    routes['GET /api/procedures'] = () => [proc('pr1', 'Limpeza de pele', { durationMinutes: 60 }), proc('pr2', 'Peeling', { standalone: false, baseSessions: 4 }), proc('pr3', 'Massagem', { active: false })];
    routes['GET /api/followups'] = () => [
      pendingFollowup({ _id: 'a2', offerType: 'plan', offerName: 'Plano Pele', blocked: false, items: [item('i2', 'pr2', 'Peeling', 1)] }),
      pendingFollowup({ _id: 'a4', patientId: 'p2', offerType: 'combo', offerName: 'Outro', blocked: false, items: [item('i5', 'pr1', 'Outro', 0)] }),
    ];
    routes['POST /api/appointments'] = () => ({ _id: 'ap1' });
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /novo agendamento/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'Paciente' }));
    await user.click(await screen.findByRole('option', { name: 'Marina Alves' }));
    expect(await within(dialog).findByLabelText('Sessões de Peeling (Plano Pele) — abate do plano')).toBeInTheDocument();
    expect(within(dialog).getByText('Do acompanhamento')).toBeInTheDocument();
    expect(within(dialog).getByText('ABATE SESSÕES')).toBeInTheDocument();
    expect(within(dialog).getByText('Avulso')).toBeInTheDocument();
    expect(within(dialog).getByText('COBRADO À PARTE')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Sessões de Outro/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /Limpeza de pele/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /Peeling/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /Massagem/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Defina o horário/)).toBeInTheDocument();
  });
});

describe('Atendimento avulso', () => {
  it('lists charged standalone procedures apart from acompanhamentos and blocks scheduling while their anamnesis is pending', async () => {
    const proc = { _id: 'pr1', name: 'Limpeza de pele', baseSessions: 1, durationMinutes: 60, standalone: true, active: true, priceCents: 15000, sessionSchema: {}, versions: [] };
    routes['GET /api/procedures'] = () => [proc];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    routes['GET /api/followups'] = () => [
      pendingFollowup({ _id: 'av1', offerType: 'procedure', offerName: 'Limpeza de pele', items: [{ _id: 'it9', procedureId: 'pr1', procedureName: 'Limpeza de pele', sessionsTotal: 1, sessionsPerformed: 0, durationMinutes: 60 }] }),
    ];
    const user = userEvent.setup();
    renderAt('/pacientes/p1');
    expect(await screen.findByRole('heading', { name: 'Atendimentos avulsos' })).toBeInTheDocument();
    expect(screen.getAllByText(/Anamnese pendente/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /novo agendamento/i }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/anamnese pendente/i);
    expect(within(dialog).getByRole('checkbox', { name: /Limpeza de pele/ })).toBeDisabled();
  });

  it('picks a standalone procedure from the patient page and opens its registration', async () => {
    routes['GET /api/procedures'] = () => [
      { _id: 'pr1', name: 'Limpeza de pele', baseSessions: 1, durationMinutes: 60, standalone: true, active: true, priceCents: 15000, sessionSchema: {}, versions: [] },
      { _id: 'pr2', name: 'Peeling', baseSessions: 4, durationMinutes: 45, standalone: false, active: true, priceCents: 9000, sessionSchema: {}, versions: [] },
    ];
    routes['GET /api/patients/p1/history'] = () => ({ patient: marina, events: [], pending: [] });
    const user = userEvent.setup();
    const router = renderAt('/pacientes/p1');
    await user.click(await screen.findByRole('button', { name: /atendimento avulso/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(within(dialog).getByLabelText('Procedimento')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Selecione…', expect.stringContaining('Limpeza de pele')]);
    await user.selectOptions(within(dialog).getByLabelText('Procedimento'), 'pr1');
    await user.click(within(dialog).getByRole('button', { name: /continuar/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pacientes/p1/avulso/pr1'));
  });

  it('registers a standalone session without a followup', async () => {
    routes['GET /api/procedures'] = () => [{ _id: 'pr1', name: 'Limpeza de pele', baseSessions: 1, durationMinutes: 45, standalone: true, active: true, priceCents: 15000, sessionSchema: { type: 'object', properties: {} }, versions: [] }];
    routes['POST /api/attendances'] = () => ({ _id: 's1' });
    routes['GET /api/attendances/s1'] = () => ({ _id: 's1', patientId: 'p1', procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', data: {}, schemaSnapshot: { type: 'object', properties: {} }, photos: [] });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/avulso/pr1');
    await user.type(await screen.findByLabelText('Observações'), 'Tudo certo');
    await user.click(screen.getByRole('button', { name: /salvar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ patientId: 'p1', procedureId: 'pr1', notes: 'Tudo certo' }));
  });
});

describe('Planos', () => {
  const standard = { _id: 'c1', title: 'Contrato padrão', kind: 'standard', active: true, versions: [] };
  const procedureContract = { _id: 'c3', title: 'Contrato da limpeza', kind: 'procedure', procedureId: 'pr1', active: true, versions: [] };
  const comboContract = { _id: 'c2', title: 'Contrato do combo', kind: 'combo', comboId: 'cb1', active: true, versions: [] };
  const limpeza = { _id: 'pr1', name: 'Limpeza de pele', baseSessions: 3, priceCents: 15000, versions: [] };
  const combo = { _id: 'cb1', name: 'Combo Facial', priceCents: 50000, active: true, items: [{ procedureId: 'pr1', sessions: 2 }] };
  const savedBody = () => calls.find((call) => call.method === 'POST' && call.url === '/api/plans')?.body;

  it('creates a catalog plan grouping procedures', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/contracts'] = () => [standard];
    routes['POST /api/plans'] = () => ({ _id: 'pl1' });
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.type(await screen.findByLabelText('Nome do plano'), 'Plano Pele');
    await user.type(screen.getByLabelText(/preço do plano/i), '900');
    await user.click(await screen.findByRole('checkbox', { name: /limpeza de pele/i }));
    await user.click(await screen.findByRole('checkbox', { name: /contrato padrão/i }));
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));
    await waitFor(() => expect(savedBody()).toMatchObject({ name: 'Plano Pele', priceCents: 90000, items: [{ offerType: 'procedure', offerId: 'pr1', sessions: 3 }], contractIds: ['c1'] }));
  });

  it('adds a combo, pre-selects its contract, suggests the price and sends the combo by reference', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [combo];
    routes['GET /api/contracts'] = () => [standard, procedureContract, comboContract];
    routes['POST /api/plans'] = () => ({ _id: 'pl1' });
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.type(await screen.findByLabelText('Nome do plano'), 'Plano Combo');
    await user.click(await screen.findByRole('button', { name: 'Combos' }));
    await user.click(await screen.findByRole('checkbox', { name: /combo facial/i }));
    const selected = within(screen.getByRole('region', { name: 'Itens selecionados' }));
    expect(selected.getByText('Combo Facial')).toBeInTheDocument();
    expect(selected.getByText(/Limpeza de pele ×2/)).toBeInTheDocument();
    expect(selected.queryByLabelText(/sessões de combo facial/i)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /contrato do combo/i })).toBeChecked();
    expect(screen.getByText(/Automático · Combo Facial/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /contrato da limpeza/i })).not.toBeChecked();
    expect(screen.getByLabelText(/preço do plano/i)).toHaveValue(500);
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));
    await waitFor(() => expect(savedBody()).toMatchObject({ priceCents: 50000, items: [{ offerType: 'combo', offerId: 'cb1' }], contractIds: ['c2'] }));
    expect((savedBody() as { items: Array<Record<string, unknown>> }).items[0]).not.toHaveProperty('sessions');
  });

  it('keeps a manually typed price and offers to go back to the suggested one', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/contracts'] = () => [standard];
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.click(await screen.findByRole('checkbox', { name: /limpeza de pele/i }));
    const price = screen.getByLabelText(/preço do plano/i);
    expect(price).toHaveValue(450);
    await user.clear(price);
    await user.type(price, '300');
    await user.clear(screen.getByLabelText('Sessões de Limpeza de pele'));
    await user.type(screen.getByLabelText('Sessões de Limpeza de pele'), '4');
    expect(price).toHaveValue(300);
    await user.click(screen.getByRole('button', { name: /usar sugerido/i }));
    expect(price).toHaveValue(600);
  });

  it('refuses to save when no applicable contract remains selected', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/contracts'] = () => [procedureContract];
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.type(await screen.findByLabelText('Nome do plano'), 'Sem contrato');
    await user.click(await screen.findByRole('checkbox', { name: /limpeza de pele/i }));
    const contract = screen.getByRole('checkbox', { name: /contrato da limpeza/i });
    expect(contract).toBeChecked();
    await user.click(contract);
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));
    expect(await screen.findByText(/ao menos um contrato aplicável/i)).toBeInTheDocument();
    expect(savedBody()).toBeUndefined();
  });

  it('searches and paginates the catalog without losing the selected items', async () => {
    routes['GET /api/procedures'] = () => Array.from({ length: 10 }, (_, index) => ({ _id: `pr${index + 1}`, name: `Procedimento ${String(index + 1).padStart(2, '0')}`, baseSessions: 1, priceCents: 1000, versions: [] }));
    routes['GET /api/contracts'] = () => [standard];
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await screen.findByRole('checkbox', { name: 'Procedimento 01' });
    const available = async () => within(await screen.findByRole('group', { name: /procedimentos disponíveis/i }));
    expect((await available()).getAllByRole('checkbox')).toHaveLength(8);
    await user.click((await available()).getByRole('checkbox', { name: 'Procedimento 01' }));
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect((await available()).getAllByRole('checkbox')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect((await available()).getByRole('checkbox', { name: 'Procedimento 01' })).toBeChecked();
    await user.type(screen.getByLabelText('Buscar procedimentos'), '09');
    expect((await available()).getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: /páginas/i })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Itens selecionados' })).getByText('Procedimento 01')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar procedimentos'));
    await user.type(screen.getByLabelText('Buscar procedimentos'), 'zzz');
    expect(screen.getByText(/nenhum procedimento encontrado/i)).toBeInTheDocument();
  });

  it('does not submit the form when pressing Enter in the search box and hides inactive combos', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [combo, { ...combo, _id: 'cb2', name: 'Combo Inativo', active: false }];
    routes['GET /api/contracts'] = () => [standard];
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.type(await screen.findByLabelText('Nome do plano'), 'Enter teste');
    await user.click(await screen.findByRole('button', { name: 'Combos' }));
    await screen.findByRole('checkbox', { name: /combo facial/i });
    expect(screen.queryByRole('checkbox', { name: /combo inativo/i })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar combos'), 'facial{Enter}');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    expect(screen.getByLabelText('Buscar combos')).toHaveValue('facial');
  });

  it('drops the automatic contract of a combo when the combo is removed and hides the price hint with no items', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [combo];
    routes['GET /api/contracts'] = () => [standard, comboContract];
    const user = userEvent.setup();
    renderAt('/planos/novo');
    await user.click(await screen.findByRole('button', { name: 'Combos' }));
    const comboBox = await screen.findByRole('checkbox', { name: /combo facial/i });
    await user.click(comboBox);
    const contract = screen.getByRole('checkbox', { name: /contrato do combo/i });
    expect(contract).toBeChecked();
    expect(screen.getByText(/sugerido: r\$\s*500,00/i)).toBeInTheDocument();
    await user.click(contract);
    expect(screen.getByText(/Sugerido · Combo Facial/)).toBeInTheDocument();
    await user.click(contract);
    await user.click(screen.getByRole('button', { name: /remover combo facial/i }));
    expect(screen.getByRole('checkbox', { name: /contrato do combo/i })).not.toBeChecked();
    expect(screen.queryByText(/sugerido: r\$/i)).not.toBeInTheDocument();
  });

  it('auto-selects the contract of an item added while editing a saved plan', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [combo];
    routes['GET /api/contracts'] = () => [standard, procedureContract, comboContract];
    routes['GET /api/plans'] = () => [{ _id: 'pl1', name: 'Plano salvo', priceCents: 70000, contractIds: ['c1'], items: [{ offerType: 'procedure', offerId: 'pr1', sessions: 5 }] }];
    const user = userEvent.setup();
    renderAt('/planos/novo?planId=pl1');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /contrato padrão/i })).toBeChecked());
    expect(screen.getByRole('checkbox', { name: /contrato da limpeza/i })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Combos' }));
    await user.click(await screen.findByRole('checkbox', { name: /combo facial/i }));
    expect(screen.getByRole('checkbox', { name: /contrato do combo/i })).toBeChecked();
  });

  it('loads an existing plan with its combos, sessions and saved contracts', async () => {
    routes['GET /api/procedures'] = () => [limpeza];
    routes['GET /api/combos'] = () => [combo];
    routes['GET /api/contracts'] = () => [standard, procedureContract, comboContract];
    routes['GET /api/plans'] = () => [{ _id: 'pl1', name: 'Plano salvo', priceCents: 70000, contractIds: ['c1'], items: [{ offerType: 'procedure', offerId: 'pr1', sessions: 5 }, { offerType: 'combo', offerId: 'cb1', comboName: 'Combo Facial', items: [] }] }];
    routes['PUT /api/plans/pl1'] = () => ({ _id: 'pl1' });
    const user = userEvent.setup();
    renderAt('/planos/novo?planId=pl1');
    const selected = within(await screen.findByRole('region', { name: 'Itens selecionados' }));
    expect(await selected.findByText('Combo Facial')).toBeInTheDocument();
    expect(selected.getByLabelText('Sessões de Limpeza de pele')).toHaveValue(5);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /contrato padrão/i })).toBeChecked());
    expect(screen.getByRole('checkbox', { name: /contrato do combo/i })).not.toBeChecked();
    expect(screen.getByLabelText(/preço do plano/i)).toHaveValue(700);
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ priceCents: 70000, items: [{ offerType: 'procedure', offerId: 'pr1', sessions: 5 }, { offerType: 'combo', offerId: 'cb1' }], contractIds: ['c1'] }));
  });
});

describe('Relacionamento do paciente', () => {
  const report = (extra: Record<string, unknown> = {}) => ({
    totals: { followups: 1, attendancesPerformed: 2, attendancesContracted: 4, minutesTotal: 135, attendancesWithoutDuration: 0, contractedCents: 40000, paidCents: 15000, pendingCents: 25000, dueForPerformedCents: 5000, noShows: 1 },
    firstAttendanceAt: '2026-09-01T15:00:00Z', lastAttendanceAt: '2026-09-29T15:00:00Z', nextAppointmentAt: null, averageIntervalDays: 28,
    monthly: [{ month: '2026-09', attendances: 2, minutes: 135, paidCents: 15000 }],
    followups: [{ id: 'at1', offerName: 'Drenagem', priceCents: 40000, paidCents: 15000, pendingCents: 25000, sessionsTotal: 4, sessionsPerformed: 2 }],
    procedures: [{ name: 'Drenagem', attendances: 2, minutes: 135 }],
    ...extra,
  });

  it('shows attendances, total time, paid and pending values', async () => {
    routes['GET /api/patients/p1/relationship'] = () => report();
    renderAt('/pacientes/p1/relacionamento');
    expect(await screen.findByText('2 de 4')).toBeInTheDocument();
    expect(screen.getByText('2h 15min')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*150,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*250,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s*50,00 já realizados e não pagos/)).toBeInTheDocument();
    expect(screen.getByText(/28 dias/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atendimentos por mês' })).toBeInTheDocument();
  });

  it('explains when the patient has no followups yet', async () => {
    routes['GET /api/patients/p1/relationship'] = () => report({ totals: { ...report().totals, followups: 0 } });
    renderAt('/pacientes/p1/relacionamento');
    expect(await screen.findByText(/ainda não tem acompanhamentos/)).toBeInTheDocument();
  });

  it('registers one manual followup session without asking for duration', async () => {
    routes['GET /api/followups'] = () => [pendingFollowup({ blocked: false, items: [{ _id: 'it1', procedureName: 'Limpeza de pele', sessionsTotal: 3, sessionsPerformed: 0, sessionSchema: { type: 'object', properties: {} } }] })];
    routes['POST /api/attendances'] = () => ({ _id: 's1' });
    routes['GET /api/attendances/s1'] = () => ({ _id: 's1', patientId: 'p1', procedureName: 'Limpeza de pele', performedAt: '2026-09-29T15:00:00Z', data: {}, schemaSnapshot: { type: 'object', properties: {} }, photos: [] });
    const user = userEvent.setup();
    renderAt('/pacientes/p1/novo-atendimento/it1');
    expect(await screen.findByText(/Este registro baixa uma sessão do acompanhamento/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Duração (minutos)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /salvar atendimento/i }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ patientId: 'p1', followupItemId: 'it1' }));
    expect(calls.find((call) => call.method === 'POST')?.body).not.toHaveProperty('durationMinutes');
  });
});

describe('Configurações', () => {
  it('saves the professional registration and previews the stamp', async () => {
    routes['GET /api/auth/get-session'] = () => ({ user: { id: 'u1', name: 'Dra. Paula', email: 'paula@example.com' } });
    routes['GET /api/auth/professional-profile'] = () => null;
    routes['PUT /api/auth/professional-profile'] = (init) => ({ id: 'prof1', userId: 'u1', ...(JSON.parse(init?.body as string) as Record<string, unknown>), active: true });
    const user = userEvent.setup();
    renderAt('/configuracoes');
    expect(await screen.findByRole('heading', { name: 'Registro no conselho' })).toBeInTheDocument();
    expect(screen.getByText(/sem registro/i)).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Conselho'), 'CRM');
    await user.type(screen.getByLabelText(/número do registro/i), '123456');
    await user.selectOptions(screen.getByLabelText(/UF/), 'SP');
    expect(await screen.findByText('CRM 123456/SP')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /salvar registro/i }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ registrationType: 'CRM', registrationNumber: '123456', registrationState: 'SP' });
  });
});

describe('Documentos', () => {
  const queue = () => [
    { participantId: 'prof1', role: 'professional', status: 'pending', followupId: 'at1', contractId: 'c1', title: 'Contrato padrão', blocking: false, patient: { id: 'p1', fullName: 'Marina Alves' } },
    { participantId: 'pat1', role: 'patient', status: 'pending', followupId: 'at1', contractId: 'c1', title: 'Contrato padrão', blocking: true, patient: { id: 'p1', fullName: 'Marina Alves' } },
  ];

  it('lists the representative queue and the patient queue', async () => {
    routes['GET /api/signature-pending'] = () => queue();
    renderAt('/documentos');
    expect(await screen.findByRole('heading', { name: 'Sua assinatura' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /revisar e assinar/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Falta o paciente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir paciente/i })).toHaveAttribute('href', '/pacientes/p1');
  });

  it('shows an empty state when nothing is waiting', async () => {
    routes['GET /api/signature-pending'] = () => [];
    renderAt('/documentos');
    expect(await screen.findByText(/nenhum contrato esperando sua assinatura/i)).toBeInTheDocument();
  });
});

describe('Conta', () => {
  it('shows the logged user and clinic in the sidebar', async () => {
    routes['GET /api/auth/me'] = () => ({ user: { id: 'u1', name: 'Dra. Paula', email: 'paula@example.com' }, tenant: { id: 't1', name: 'Clínica Essenza' } });
    routes['GET /api/auth/professional-profile'] = () => ({ id: 'prof1', userId: 'u1', registrationType: 'CRM', registrationNumber: '123456', registrationState: 'SP', active: true });
    renderAt('/');
    expect((await screen.findAllByText('Dra. Paula')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('Clínica Essenza')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('CRM 123456/SP')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Administradora')).not.toBeInTheDocument();
    expect(screen.queryByText('Clínica Vitta')).not.toBeInTheDocument();
  });
});
