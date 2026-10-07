import Form from '@rjsf/core';
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { slugify } from '@/lib/fields';
import { orderedPropertyEntries, useConditionalForm, withPropertyOrder } from '@/lib/conditionalSchema';
import { buildField, DEFAULT_OPTIONS, fieldKinds, hasOptions, kindOf, optionsOf, type FieldKind, type FormSchema, type SchemaField } from '@/lib/fieldKinds';
import { schemaFormProps } from '@/lib/schemaUi';
import { conditionWouldCycle, type VisibilityCondition } from '@/lib/conditionalSchema';

type Field = SchemaField;
type Schema = FormSchema;
type FieldPatch = { title?: string; kind?: FieldKind; options?: string[]; required?: boolean; description?: string; visibleWhen?: VisibilityCondition | null };
type SchemaEditorProps = { value: Record<string, unknown>; onChange: (schema: Record<string, unknown>) => void };

const SALT_LENGTH = 4;
const saltOf = (identifier: string) => identifier.slice(identifier.lastIndexOf('_') + 1);
const identifierFor = (name: string, salt: string) => `${slugify(name)}_${salt}`;
const conditionOf = (field: Field) => field['x-visibleWhen'] as VisibilityCondition | undefined;
const canControlVisibility = (field: Field) => ['boolean', 'choice'].includes(kindOf(field));

function newSalt(taken: Set<string>) {
  let salt: string;
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    salt = Array.from(bytes, (byte) => (byte % 36).toString(36)).join('');
  } while (taken.has(salt));
  return salt;
}

// O identificador é derivado do nome + um sufixo aleatório (salt) que evita colisão entre campos de mesmo nome.
export function SchemaEditor({ value, onChange }: SchemaEditorProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const previewRef = useRef<Form>(null);
  const schema = value as Schema;
  const fields = orderedPropertyEntries(schema) as Array<[string, Field]>;
  const required = schema.required ?? [];
  const emit = (properties: Record<string, Field>, nextRequired = required) => onChange({ ...schema, type: 'object', properties, required: nextRequired.filter((item) => item in properties), ...withPropertyOrder(properties) });

  const addField = () => {
    const name = `Campo ${fields.length + 1}`;
    const identifier = identifierFor(name, newSalt(new Set(fields.map(([key]) => saltOf(key)))));
    emit({ ...schema.properties, [identifier]: buildField('text', name) });
  };
  const updateField = (key: string, patch: FieldPatch) => {
    const current = schema.properties![key];
    const title = patch.title ?? current.title ?? '';
    const kind = patch.kind ?? kindOf(current);
    const options = patch.options ?? (optionsOf(current).length ? optionsOf(current) : DEFAULT_OPTIONS);
    const nextKey = patch.title === undefined ? key : identifierFor(title, saltOf(key));
    const description = patch.description ?? (typeof current.description === 'string' ? current.description : undefined);
    const nextField = buildField(kind, title, options);
    if (kind === 'notice' && description) nextField.description = description;
    const condition = patch.visibleWhen !== undefined ? patch.visibleWhen ?? undefined : conditionOf(current);
    const properties = Object.fromEntries(fields.map(([existing, field]) => {
      if (existing === key) return [nextKey, { ...nextField, ...(condition ? { 'x-visibleWhen': { ...condition, field: condition.field === key ? nextKey : condition.field } } : {}) }];
      const otherCondition = conditionOf(field);
      if (otherCondition?.field === key && nextKey !== key) return [existing, { ...field, 'x-visibleWhen': { ...otherCondition, field: nextKey } }];
      if (patch.kind && !canControlVisibility(buildField(kind, title, options)) && otherCondition?.field === key) {
        const { 'x-visibleWhen': _removed, ...unconditional } = field;
        return [existing, unconditional];
      }
      return [existing, field];
    }));
    const nextRequired = required.filter((item) => item !== key);
    if (patch.required ?? required.includes(key)) nextRequired.push(nextKey);
    emit(properties, nextRequired);
  };
  const removeField = (key: string) => emit(Object.fromEntries(fields.filter(([current]) => current !== key).map(([current, field]) => {
    if (conditionOf(field)?.field !== key) return [current, field];
    const { 'x-visibleWhen': _removed, ...unconditional } = field;
    return [current, unconditional];
  })));
  const moveField = (key: string, targetIndex: number) => {
    const fromIndex = fields.findIndex(([current]) => current === key);
    if (fromIndex < 0 || targetIndex < 0 || targetIndex >= fields.length || fromIndex === targetIndex) return;
    const reordered = [...fields];
    const [field] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, field!);
    emit(Object.fromEntries(reordered));
  };
  const moveFieldBefore = (key: string, targetKey: string) => {
    if (key === targetKey) return;
    const reordered = [...fields];
    const fromIndex = reordered.findIndex(([current]) => current === key);
    if (fromIndex < 0) return;
    const [field] = reordered.splice(fromIndex, 1);
    const targetIndex = reordered.findIndex(([current]) => current === targetKey);
    if (targetIndex < 0) return;
    reordered.splice(targetIndex, 0, field!);
    emit(Object.fromEntries(reordered));
  };
  const dropOnField = (event: DragEvent<HTMLDivElement>, targetKey: string) => {
    event.preventDefault();
    const dragged = draggedKey ?? event.dataTransfer.getData('text/plain');
    if (dragged) moveFieldBefore(dragged, targetKey);
    setDraggedKey(null);
    setDropTargetKey(null);
  };

  // O editor vive dentro do formulário da página: Enter num campo não pode salvar.
  const blockEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault();
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2" onKeyDown={blockEnter}>
      <section className="grid gap-3 rounded-xl border border-[#e3eae4] bg-white p-4" aria-label="Campos do formulário">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h3 className="m-0 text-sm font-semibold">Campos</h3>
          <p className="m-0 text-xs text-muted-foreground">{fields.length ? `${fields.length} ${fields.length === 1 ? 'campo' : 'campos'} · arraste para ordenar` : 'Nenhum campo ainda'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addField}><Plus /> Adicionar campo</Button>
        </header>
        {fields.map(([key, field], index) => (
          <div
            key={saltOf(key)}
            role="group"
            aria-label={`Campo ${field.title || key}`}
            onDragOver={(event) => { event.preventDefault(); if (draggedKey && draggedKey !== key) setDropTargetKey(key); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTargetKey(null); }}
            onDrop={(event) => dropOnField(event, key)}
            className={`schema-editor-field grid gap-3 rounded-lg border border-[#e3eae4] bg-[#f7f8f5] p-3 sm:grid-cols-[1fr_12rem]${draggedKey === key ? ' is-dragged' : ''}${dropTargetKey === key && draggedKey !== key ? ' is-drop-target' : ''}`}
          >
            {dropTargetKey === key && draggedKey !== key && <span className="schema-editor-drop-label" aria-live="polite">Soltar antes de “{field.title || key}”</span>}
            <div className="schema-editor-reorder flex items-center gap-1 sm:col-span-2">
              <button
                type="button"
                draggable
                className="schema-editor-drag-handle"
                aria-label={`Arraste para reordenar ${field.title || key}`}
                title="Arraste para mudar a ordem"
                onDragStart={(event) => { setDraggedKey(key); setDropTargetKey(null); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); }}
                onDragEnd={() => { setDraggedKey(null); setDropTargetKey(null); }}
              ><GripVertical aria-hidden="true" size={17} /> <span>Arraste para ordenar</span></button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mover ${field.title || key} para cima`} disabled={index === 0} onClick={() => moveField(key, index - 1)}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mover ${field.title || key} para baixo`} disabled={index === fields.length - 1} onClick={() => moveField(key, index + 1)}><ArrowDown /></Button>
            </div>
            <Label className="flex-col items-stretch gap-1.5">
              Nome
              <Input value={field.title ?? ''} onChange={(event) => updateField(key, { title: event.target.value })} className="bg-white" />
            </Label>
            <Label className="flex-col items-stretch gap-1.5">
              Tipo
              <NativeSelect value={kindOf(field)} onChange={(event) => updateField(key, { kind: event.target.value as FieldKind })}>
                {fieldKinds.map(({ kind, label }) => <NativeSelectOption key={kind} value={kind}>{label}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
            {kindOf(field) === 'notice' && (
              <div className="grid gap-2 sm:col-span-2">
                <Label className="flex-col items-stretch gap-1.5">
                  Texto exibido
                  <span className="text-xs font-normal text-muted-foreground">Quebras de linha separam parágrafos. Use **assim** para negrito.</span>
                  <Textarea
                    aria-label={`Texto de ${field.title || key}`}
                    className="min-h-28 bg-white"
                    value={typeof field.description === 'string' ? field.description : ''}
                    onChange={(event) => updateField(key, { description: event.target.value })}
                    placeholder={'Ex.: Após o preenchimento desta ficha, **será enviado o link de pagamento**.'}
                  />
                </Label>
              </div>
            )}
            {hasOptions(kindOf(field)) && (
              <div className="grid gap-2 sm:col-span-2" role="group" aria-label={`Opções de ${field.title || key}`}>
                <span className="text-sm font-medium">Opções</span>
                {optionsOf(field).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input aria-label={`Opção ${index + 1}`} value={option} className="bg-white" onChange={(event) => updateField(key, { options: optionsOf(field).map((current, position) => (position === index ? event.target.value : current)) })} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover opção ${index + 1}`} disabled={optionsOf(field).length <= 2} onClick={() => updateField(key, { options: optionsOf(field).filter((_, position) => position !== index) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => updateField(key, { options: [...optionsOf(field), `Opção ${optionsOf(field).length + 1}`] })}><Plus /> Adicionar opção</Button>
              </div>
            )}
            <VisibilityRule
              fieldKey={key}
              field={field}
              fields={fields}
              schema={schema}
              onChange={(visibleWhen) => updateField(key, { visibleWhen })}
            />
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Identificador: <code className="font-mono text-foreground">{key}</code></span>
              <div className="flex items-center gap-3">
                {kindOf(field) !== 'notice' && (
                  <Label className="cursor-pointer text-xs">
                    <Checkbox checked={required.includes(key)} onCheckedChange={(checked) => updateField(key, { required: checked === true })} /> Obrigatório
                  </Label>
                )}
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(key)} aria-label={`Remover ${field.title || key}`}><Trash2 /></Button>
              </div>
            </div>
          </div>
        ))}
        {!fields.length && <div className="rounded-lg border border-dashed border-[#d9e2dc] p-6 text-center text-sm text-muted-foreground">Adicione campos para montar seu formulário.</div>}
      </section>
      <section className="preview-panel grid gap-3 rounded-xl border border-[#e3eae4] bg-white p-4 lg:sticky lg:top-4" aria-label="Prévia do formulário">
        <header>
          <h3 className="m-0 text-sm font-semibold">Prévia</h3>
          <p className="m-0 text-xs text-muted-foreground">Preencha para testar como o paciente verá o formulário. Nada é salvo.</p>
        </header>
        {fields.length ? (
          <Preview schema={value} answers={answers} onAnswers={setAnswers} previewRef={previewRef} />
        ) : <p className="m-0 text-sm text-muted-foreground">A prévia aparece aqui conforme você adiciona campos.</p>}
      </section>
    </div>
  );
}

function Preview({ schema, answers, onAnswers, previewRef }: {
  schema: Record<string, unknown>;
  answers: Record<string, unknown>;
  onAnswers: (next: Record<string, unknown>) => void;
  previewRef: React.RefObject<Form | null>;
}) {
  const form = useConditionalForm(schema, answers, onAnswers);
  return (
    <div className="preview-form">
      <Form
        ref={previewRef}
        tagName="div"
        {...schemaFormProps(form.widgetSchema, { uiSchema: { 'ui:submitButtonOptions': { norender: true } } })}
        formData={form.widgetAnswers}
        onChange={({ formData }) => form.handleChange(formData)}
      />
      <div className="mt-4 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => (previewRef.current?.validateForm() ? toast.success('Preenchimento válido.') : toast.error('Revise os campos destacados.'))}>Testar preenchimento</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onAnswers({})}>Limpar</Button>
      </div>
    </div>
  );
}

function VisibilityRule({ fieldKey, field, fields, schema, onChange }: {
  fieldKey: string;
  field: Field;
  fields: Array<[string, Field]>;
  schema: Schema;
  onChange: (condition: VisibilityCondition | null) => void;
}) {
  const current = conditionOf(field);
  const candidates = fields.filter(([key, source]) => key !== fieldKey && canControlVisibility(source) && !conditionWouldCycle(schema, fieldKey, key));
  const sourceKey = current?.field ?? '';
  const source = fields.find(([key]) => key === sourceKey)?.[1];
  const choices = source ? kindOf(source) === 'boolean'
    ? [{ label: 'Sim', value: true }, { label: 'Não', value: false }]
    : optionsOf(source).map((option) => ({ label: option, value: option }))
    : [];

  function selectSource(nextKey: string) {
    if (!nextKey) return onChange(null);
    const nextSource = fields.find(([key]) => key === nextKey)?.[1];
    if (!nextSource) return onChange(null);
    const nextChoices = kindOf(nextSource) === 'boolean'
      ? [{ value: true }, { value: false }]
      : optionsOf(nextSource).map((option) => ({ value: option }));
    const equals = current?.field === nextKey && nextChoices.some((option) => Object.is(option.value, current.equals))
      ? current.equals
      : nextChoices[0]?.value ?? '';
    onChange({ field: nextKey, equals });
  }

  return (
    <div className="schema-editor-visibility sm:col-span-2" role="group" aria-label={`Visibilidade de ${field.title || fieldKey}`}>
      <span className="schema-editor-visibility-label">Quando exibir</span>
      <NativeSelect aria-label={`Pergunta que exibe ${field.title || fieldKey}`} value={sourceKey} onChange={(event) => selectSource(event.target.value)}>
        <NativeSelectOption value="">Sempre mostrar</NativeSelectOption>
        {candidates.map(([key, sourceField]) => <NativeSelectOption key={key} value={key}>{sourceField.title || key}</NativeSelectOption>)}
        {source && !candidates.some(([key]) => key === sourceKey) && <NativeSelectOption value={sourceKey}>{source.title || sourceKey}</NativeSelectOption>}
      </NativeSelect>
      {current && choices.length > 0 && (
        <>
          <span className="schema-editor-visibility-operator">for</span>
          <NativeSelect
            aria-label={`Resposta que exibe ${field.title || fieldKey}`}
            value={String(current.equals)}
            onChange={(event) => {
              const option = choices.find((choice) => String(choice.value) === event.target.value);
              if (option) onChange({ field: sourceKey, equals: option.value });
            }}
          >
            {choices.map((choice) => <NativeSelectOption key={String(choice.value)} value={String(choice.value)}>{choice.label}</NativeSelectOption>)}
          </NativeSelect>
        </>
      )}
      {current && source && <span className="schema-editor-visibility-summary">Aparece quando “{source.title}” for “{choices.find((choice) => Object.is(choice.value, current.equals))?.label ?? String(current.equals)}”.</span>}
      {!candidates.length && !current && <span className="schema-editor-visibility-hint">Adicione um campo Sim/não ou Escolha única para criar uma regra.</span>}
    </div>
  );
}
