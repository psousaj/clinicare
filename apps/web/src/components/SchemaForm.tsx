import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

type Schema = { type?: string; title?: string; description?: string; required?: string[]; properties?: Record<string, { type?: string; title?: string; description?: string; enum?: string[] }> };
type Props = { schema: Schema; value?: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; readOnly?: boolean };

export function SchemaEditor({ value, onChange }: { value: Schema; onChange: (schema: Schema) => void }) {
  const addField = () => {
    const properties = { ...(value.properties ?? {}) };
    let name = `campo_${Object.keys(properties).length + 1}`;
    while (name in properties) name += '_novo';
    properties[name] = { type: 'string', title: 'Novo campo' };
    onChange({ ...value, type: 'object', properties });
  };
  const editField = (key: string, field: NonNullable<Schema['properties']>[string]) => onChange({ ...value, type: 'object', properties: { ...value.properties, [key]: field } });
  const removeField = (key: string) => {
    const properties = { ...(value.properties ?? {}) };
    delete properties[key];
    onChange({ ...value, properties, required: value.required?.filter((item) => item !== key) });
  };
  return <div className="schema-builder"><div className="schema-toolbar"><div><strong>Campos do formulário</strong><small>Defina perguntas e visualize o resultado.</small></div><button className="secondary-button" type="button" onClick={addField}>＋ Adicionar campo</button></div><div className="schema-workspace"><div className="schema-fields">{Object.entries(value.properties ?? {}).map(([key, field]) => <div className="schema-field-editor" key={key}><label>Rótulo<input value={field.title ?? key} onChange={(event) => editField(key, { ...field, title: event.target.value })} /></label><label>Identificador<input value={key} disabled /></label><label>Tipo<select value={field.type ?? 'string'} onChange={(event) => editField(key, { ...field, type: event.target.value })}><option value="string">Texto</option><option value="number">Número</option><option value="boolean">Sim/não</option></select></label><label className="required-check"><input type="checkbox" checked={value.required?.includes(key) ?? false} onChange={(event) => onChange({ ...value, required: event.target.checked ? [...(value.required ?? []), key] : (value.required ?? []).filter((item) => item !== key) })} /> Obrigatório</label><button type="button" className="remove-field" onClick={() => removeField(key)} aria-label={`Remover ${field.title ?? key}`}>Remover</button></div>)}{!Object.keys(value.properties ?? {}).length && <div className="builder-empty">Adicione campos para montar seu formulário.</div>}</div><div className="schema-preview"><div className="preview-label">PRÉVIA DO FORMULÁRIO</div><div className="preview-form"><Form schema={value as never} validator={validator} onSubmit={() => undefined} disabled /></div></div></div></div>;
}

export function SchemaForm({ schema, value = {}, onChange, readOnly = false }: Props) {
  const [answers, setAnswers] = useState(value);
  const update = ({ formData }: { formData?: Record<string, unknown> }) => {
    const next = formData ?? {};
    setAnswers(next);
    onChange(next);
  };
  return <div className="schema-response-form"><Form schema={schema as never} validator={validator} formData={answers} onChange={update} disabled={readOnly} onSubmit={({ formData }) => { const next = formData ?? {}; setAnswers(next); onChange(next); }}><button className="primary-button" type="submit">Enviar respostas</button></Form></div>;
}
