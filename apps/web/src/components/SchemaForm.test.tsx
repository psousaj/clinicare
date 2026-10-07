import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SchemaForm } from './SchemaForm';

describe('SchemaForm boolean fields', () => {
  afterEach(cleanup);

  it('shows explicit Sim/Não choices and stores boolean values', async () => {
    const user = userEvent.setup();
    let answers: Record<string, unknown> = {};
    render(<SchemaForm schema={{ type: 'object', properties: { allergy: { type: 'boolean', 'x-kind': 'boolean', title: 'Possui alguma alergia?' } } }} onChange={(value) => { answers = value; }} />);

    expect(screen.getByRole('radio', { name: 'Sim' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Não' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Possui alguma alergia?' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(answers.allergy).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Não' }));
    expect(answers.allergy).toBe(false);
  });

  it('shows dependent fields only for the configured answer and removes hidden answers', async () => {
    const user = userEvent.setup();
    let answers: Record<string, unknown> = {};
    const schema = {
      type: 'object',
      required: ['medication', 'medicationDetails'],
      properties: {
        medication: { type: 'boolean', 'x-kind': 'boolean', title: 'Toma medicamento regularmente?' },
        medicationDetails: { type: 'string', title: 'Qual medicamento?', 'x-visibleWhen': { field: 'medication', equals: true } },
      },
    };
    render(<SchemaForm schema={schema} onChange={(value) => { answers = value; }} />);

    expect(screen.queryByLabelText('Qual medicamento?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(answers.medication).toBe(true);
    const details = await screen.findByLabelText(/Qual medicamento/);
    await user.type(details, 'Vitamina D');
    expect(answers.medicationDetails).toBe('Vitamina D');

    await user.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.queryByLabelText('Qual medicamento?')).not.toBeInTheDocument();
    expect(answers).toEqual({ medication: false });
  });

  it('renders notice blocks as text and never submits them', async () => {    const user = userEvent.setup();
    let answers: Record<string, unknown> = {};
    let submitted: Record<string, unknown> | null = null;
    render(
      <SchemaForm
        schema={{
          type: 'object',
          required: ['name'],
          properties: {
            name_a1b2: { type: 'string', title: 'Nome' },
            payment_c3d4: { type: 'string', 'x-kind': 'notice', title: 'Pagamento', description: 'Após a ficha, **será enviado o link de pagamento**.\n\nTraga um documento com foto.' },
          },
        }}
        onChange={(value) => { answers = value; }}
        onSubmit={(value) => { submitted = value; }}
        actions={(<button type="submit">Enviar respostas</button>)}
      />,
    );

    expect(screen.getByText(/será enviado o link de pagamento/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Pagamento')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Nome/), 'Ana');
    await user.click(screen.getByRole('button', { name: /enviar respostas/i }));
    expect(submitted).toEqual({ name_a1b2: 'Ana' });
    expect(answers).toEqual({ name_a1b2: 'Ana' });
  });

  it('follows x-propertyOrder via ui:order even when properties come shuffled (jsonb)', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          'x-propertyOrder': ['terceiro_c3', 'primeiro_a1', 'segundo_b2'],
          properties: {
            // Ordem embaralhada de propósito, como o jsonb devolve do banco.
            segundo_b2: { type: 'string', title: 'Segundo' },
            primeiro_a1: { type: 'string', title: 'Primeiro' },
            terceiro_c3: { type: 'string', title: 'Terceiro' },
          },
        }}
        onChange={() => undefined}
      />,
    );
    const labels = screen.getAllByRole('textbox').map((input) => (input as HTMLInputElement).labels?.[0]?.textContent?.replace(/\*$/, ''));
    expect(labels).toEqual(['Terceiro', 'Primeiro', 'Segundo']);
  });
});
