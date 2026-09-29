import Form from '@rjsf/core';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { slugify } from '@/lib/fields';
import { buildField, DEFAULT_OPTIONS, fieldKinds, hasOptions, kindOf, optionsOf, type FieldKind, type FormSchema, type SchemaField } from '@/lib/fieldKinds';
import { schemaFormProps } from '@/lib/schemaUi';

type Field = SchemaField;
type Schema = FormSchema;
type FieldPatch = { title?: string; kind?: FieldKind; options?: string[]; required?: boolean };
type SchemaEditorProps = { value: Record<string, unknown>; onChange: (schema: Record<string, unknown>) => void };

const SALT_LENGTH = 4;
const saltOf = (identifier: string) => identifier.slice(identifier.lastIndexOf('_') + 1);
const identifierFor = (name: string, salt: string) => `${slugify(name)}_${salt}`;

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
  const previewRef = useRef<Form>(null);
  const schema = value as Schema;
  const fields = Object.entries(schema.properties ?? {});
  const required = schema.required ?? [];
  const emit = (properties: Record<string, Field>, nextRequired = required) => onChange({ ...schema, type: 'object', properties, required: nextRequired.filter((item) => item in properties) });

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
    const properties = Object.fromEntries(fields.map(([existing, field]) => (existing === key ? [nextKey, buildField(kind, title, options)] : [existing, field])));
    const nextRequired = required.filter((item) => item !== key);
    if (patch.required ?? required.includes(key)) nextRequired.push(nextKey);
    emit(properties, nextRequired);
  };
  const removeField = (key: string) => emit(Object.fromEntries(fields.filter(([current]) => current !== key)));

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
            <p className="m-0 text-xs text-muted-foreground">{fields.length ? `${fields.length} ${fields.length === 1 ? 'campo' : 'campos'}` : 'Nenhum campo ainda'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addField}><Plus /> Adicionar campo</Button>
        </header>
        {fields.map(([key, field]) => (
          <div key={saltOf(key)} className="grid gap-3 rounded-lg border border-[#e3eae4] bg-[#f7f8f5] p-3 sm:grid-cols-[1fr_12rem]">
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
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Identificador: <code className="font-mono text-foreground">{key}</code></span>
              <div className="flex items-center gap-3">
                <Label className="cursor-pointer text-xs">
                  <Checkbox checked={required.includes(key)} onCheckedChange={(checked) => updateField(key, { required: checked === true })} /> Obrigatório
                </Label>
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
          <div className="preview-form">
            <Form
              ref={previewRef}
              tagName="div"
              {...schemaFormProps(value, { uiSchema: { 'ui:submitButtonOptions': { norender: true } } })}
              formData={answers}
              onChange={({ formData }) => setAnswers(formData ?? {})}
            />
            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => (previewRef.current?.validateForm() ? toast.success('Preenchimento válido.') : toast.error('Revise os campos destacados.'))}>Testar preenchimento</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAnswers({})}>Limpar</Button>
            </div>
          </div>
        ) : <p className="m-0 text-sm text-muted-foreground">A prévia aparece aqui conforme você adiciona campos.</p>}
      </section>
    </div>
  );
}
