import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { SchemaEditor } from './SchemaEditor';

const schema = {
  type: 'object',
  properties: {
    nome_a1b2: { type: 'string', title: 'Nome' },
    idade_c3d4: { type: 'number', title: 'Idade' },
    alergia_e5f6: { type: 'boolean', title: 'Alergia' },
  },
};
const titles = (result: ReturnType<typeof vi.fn>) => Object.values(result.mock.lastCall?.[0].properties ?? {}).map((field: any) => field.title);

describe('SchemaEditor order', () => {
  afterEach(cleanup);
  it('moves a field with the keyboard-accessible controls and emits that order', async () => {
    const onChange = vi.fn();
    render(<SchemaEditor value={schema} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mover Idade para cima' }));
    expect(titles(onChange)).toEqual(['Idade', 'Nome', 'Alergia']);
  });

  it('reorders fields by dragging their handle onto another field', () => {
    const onChange = vi.fn();
    render(<SchemaEditor value={schema} onChange={onChange} />);
    const transfer = { effectAllowed: 'none', setData: vi.fn(), getData: vi.fn(() => 'alergia_e5f6') };
    const editor = within(screen.getByRole('region', { name: 'Campos do formulário' }));
    fireEvent.dragStart(editor.getByRole('button', { name: 'Arraste para reordenar Alergia' }), { dataTransfer: transfer });
    const name = editor.getByRole('group', { name: 'Campo Nome' });
    fireEvent.dragOver(name, { dataTransfer: transfer });
    fireEvent.drop(name, { dataTransfer: transfer });
    expect(titles(onChange)).toEqual(['Alergia', 'Nome', 'Idade']);
  });

  it('saves a visibility rule from an earlier yes/no field', () => {
    const onChange = vi.fn();
    const value = {
      type: 'object',
      properties: {
        medication_a1b2: { type: 'boolean', 'x-kind': 'boolean', title: 'Toma medicamento regularmente?' },
        details_c3d4: { type: 'string', title: 'Qual medicamento?' },
      },
    };
    function ControlledEditor() {
      const [current, setCurrent] = useState(value);
      return <SchemaEditor value={current} onChange={(next) => { setCurrent(next as typeof value); onChange(next); }} />;
    }
    render(<ControlledEditor />);
    fireEvent.change(screen.getByLabelText('Pergunta que exibe Qual medicamento?'), { target: { value: 'medication_a1b2' } });
    fireEvent.change(screen.getByLabelText('Resposta que exibe Qual medicamento?'), { target: { value: 'true' } });
    expect(onChange.mock.lastCall?.[0].properties.details_c3d4['x-visibleWhen']).toEqual({ field: 'medication_a1b2', equals: true });
  });

  it('reflects field order in the preview after moving a field', async () => {
    const user = userEvent.setup();
    const value = {
      type: 'object',
      properties: {
        um_a1b2: { type: 'string', title: 'Campo um' },
        dois_c3d4: { type: 'string', title: 'Campo dois' },
        tres_e5f6: { type: 'string', title: 'Campo três' },
      },
    };
    function ControlledEditor() {
      const [current, setCurrent] = useState(value);
      return <SchemaEditor value={current} onChange={(next) => setCurrent(next as typeof value)} />;
    }
    render(<ControlledEditor />);
    const preview = () => within(screen.getByRole('region', { name: 'Prévia do formulário' }));
    const previewOrder = () => preview().getAllByRole('textbox').map((input) => (input as HTMLInputElement).labels?.[0]?.textContent?.replace(/\*$/, ''));
    expect(previewOrder()).toEqual(['Campo um', 'Campo dois', 'Campo três']);
    await user.click(screen.getByRole('button', { name: 'Mover Campo três para cima' }));
    expect(previewOrder()).toEqual(['Campo um', 'Campo três', 'Campo dois']);
  });

  it('applies visibility rules in the preview', async () => {
    const user = userEvent.setup();
    const value = {
      type: 'object',
      properties: {
        medication_a1b2: { type: 'boolean', 'x-kind': 'boolean', title: 'Toma medicamento?' },
        details_c3d4: { type: 'string', title: 'Qual medicamento?', 'x-visibleWhen': { field: 'medication_a1b2', equals: true } },
      },
    };
    function ControlledEditor() {
      const [current, setCurrent] = useState(value);
      return <SchemaEditor value={current} onChange={(next) => setCurrent(next as typeof value)} />;
    }
    render(<ControlledEditor />);
    const preview = () => within(screen.getByRole('region', { name: 'Prévia do formulário' }));
    expect(preview().queryByLabelText('Qual medicamento?')).not.toBeInTheDocument();
    await user.click(preview().getByRole('radio', { name: 'Sim' }));
    expect(await preview().findByLabelText('Qual medicamento?')).toBeInTheDocument();
  });

  it('edits notice content, hides required for notices and previews them in order', async () => {
    const user = userEvent.setup();
    const value = {
      type: 'object',
      properties: {
        nome_a1b2: { type: 'string', title: 'Nome' },
        aviso_c3d4: { type: 'string', 'x-kind': 'notice', title: 'Pagamento', description: 'Traga um documento.' },
      },
    };
    function ControlledEditor() {
      const [current, setCurrent] = useState(value);
      return <SchemaEditor value={current} onChange={(next) => setCurrent(next as typeof value)} />;
    }
    render(<ControlledEditor />);
    const card = () => within(screen.getByRole('group', { name: 'Campo Pagamento' }));
    expect(card().queryByRole('checkbox', { name: 'Obrigatório' })).not.toBeInTheDocument();
    const content = card().getByLabelText(/Texto de Pagamento/);
    await user.clear(content);
    await user.type(content, 'Após a ficha, **será enviado o link**.');
    const preview = () => within(screen.getByRole('region', { name: 'Prévia do formulário' }));
    expect(await preview().findByText(/será enviado o link/)).toBeInTheDocument();
    expect(preview().getByText(/será enviado o link/).tagName).toBe('STRONG');
  });
});
