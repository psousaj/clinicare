import type { RJSFSchema, RJSFValidationError, UiSchema, WidgetProps } from '@rjsf/utils';
import type { FormProps } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Fragment, type ReactNode } from 'react';
import { DatePicker, TimePicker } from '@/components/pickers';
import { formatCpf, formatDigits, formatPhone, isValidCpf, kindOf, type FormSchema } from '@/lib/fieldKinds';

const masks = { digits: formatDigits, phone: formatPhone, cpf: formatCpf } as const;

function MaskedWidget({ id, value, disabled, readonly, required, placeholder, options, onChange, onBlur, onFocus }: WidgetProps) {
  const mask = masks[options.mask as keyof typeof masks] ?? ((text: string) => text);
  return (
    <input
      id={id}
      className="form-control"
      type="text"
      inputMode={options.mask === 'phone' ? 'tel' : 'numeric'}
      autoComplete={options.mask === 'phone' ? 'tel' : 'off'}
      value={value ?? ''}
      placeholder={placeholder}
      required={required}
      disabled={disabled || readonly}
      onChange={(event) => onChange(mask(event.target.value) || options.emptyValue)}
      onBlur={(event) => onBlur(id, event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
    />
  );
}

function DateWidget({ id, value, disabled, readonly, placeholder, onChange, options }: WidgetProps) {
  return <DatePicker id={id} value={value} disabled={disabled || readonly} placeholder={placeholder || undefined} onChange={(next) => onChange(next ?? options.emptyValue)} />;
}

function TimeWidget({ id, value, disabled, readonly, placeholder, onChange, options }: WidgetProps) {
  return <TimePicker id={id} value={value} disabled={disabled || readonly} placeholder={placeholder || undefined} onChange={(next) => onChange(next ?? options.emptyValue)} />;
}

function renderInline(text: string, keyPrefix: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part);
    return bold ? <strong key={`${keyPrefix}-${index}`}>{bold[1]}</strong> : <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>;
  });
}

/** Bloco de texto livre posicionável no formulário (avisos, declarações).
 * Não responde, não valida e nunca entra nas respostas enviadas. */
export function RichText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="notice-paragraph">
          {paragraph.split('\n').map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderInline(line.trim(), `${index}-${lineIndex}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

function NoticeWidget({ schema }: WidgetProps) {
  const content = typeof schema.description === 'string' ? schema.description.trim() : '';
  if (!content) return null;
  return <div className="notice-block" role="note"><RichText text={content} /></div>;
}

function BooleanChoiceWidget({ id, value, disabled, readonly, label, required, onChange, onBlur, onFocus }: WidgetProps) {
  const unavailable = disabled || readonly;
  return (
    <fieldset className="boolean-choice" disabled={unavailable}>
      <legend className="sr-only">{label}{required ? ' (obrigatório)' : ''}</legend>
      <div className="boolean-choice-options" role="radiogroup" aria-label={label}>
        {(['Sim', 'Não'] as const).map((answer) => (
          <label key={answer} className={`boolean-choice-option${value === answer ? ' is-selected' : ''}`}>
            <input
              id={`${id}-${answer === 'Sim' ? 'sim' : 'nao'}`}
              type="radio"
              name={id}
              value={answer}
              checked={value === answer}
              disabled={unavailable}
              onChange={() => onChange(answer)}
              onBlur={(event) => onBlur(id, event.target.value)}
              onFocus={(event) => onFocus(id, event.target.value)}
            />
            <span>{answer}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const messages: Record<string, string> = {
  required: 'Campo obrigatório.',
  pattern: 'Formato inválido.',
  format: 'Valor inválido.',
  enum: 'Escolha uma das opções.',
  minimum: 'Valor abaixo do permitido.',
  maximum: 'Valor acima do permitido.',
  type: 'Valor inválido.',
};

function uiSchemaFor(schema: FormSchema): UiSchema {
  const ui: UiSchema = {};
  for (const [key, field] of Object.entries(schema.properties ?? {})) {
    switch (kindOf(field)) {
      case 'longtext': ui[key] = { 'ui:widget': 'textarea', 'ui:options': { rows: 4 } }; break;
      case 'digits': ui[key] = { 'ui:widget': 'masked', 'ui:options': { mask: 'digits' } }; break;
      case 'phone': ui[key] = { 'ui:widget': 'masked', 'ui:options': { mask: 'phone' }, 'ui:placeholder': '(11) 99999-9999' }; break;
      case 'cpf': ui[key] = { 'ui:widget': 'masked', 'ui:options': { mask: 'cpf' }, 'ui:placeholder': '000.000.000-00' }; break;
      case 'date': ui[key] = { 'ui:widget': 'datePicker' }; break;
      case 'time': ui[key] = { 'ui:widget': 'timePicker' }; break;
      case 'boolean': ui[key] = { 'ui:widget': 'booleanChoice' }; break;
      case 'multi': ui[key] = { 'ui:widget': 'checkboxes' }; break;
      case 'scale': ui[key] = { 'ui:widget': 'range' }; break;
      case 'notice': ui[key] = { 'ui:widget': 'notice', 'ui:options': { label: false } }; break;
    }
  }
  // Ordem visual documentada do RJSF. O array vive no schema porque o `jsonb`
  // reordena as chaves de `properties` ao persistir; chaves fora do array
  // (schemas antigos) caem no `*` na ordem do objeto.
  const order = (schema as Record<string, unknown>)['x-propertyOrder'];
  if (Array.isArray(order)) {
    const known = new Set(Object.keys(schema.properties ?? {}));
    ui['ui:order'] = [...order.filter((key): key is string => typeof key === 'string' && known.has(key)), '*'];
  }
  return ui;
}

function customValidate(schema: FormSchema): NonNullable<FormProps['customValidate']> {
  return (formData, errors) => {
    for (const [key, field] of Object.entries(schema.properties ?? {})) {
      const value = (formData as Record<string, unknown> | undefined)?.[key];
      if (kindOf(field) === 'cpf' && typeof value === 'string' && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value) && !isValidCpf(value)) {
        (errors as Record<string, { addError: (message: string) => void }>)[key]?.addError('CPF inválido.');
      }
    }
    return errors;
  };
}

// Renderização e validação em português compartilhadas por prévia, formulário público e registro de sessão.
export function schemaFormProps(schema: Record<string, unknown>, extra: { uiSchema?: UiSchema } = {}) {
  const typed = schema as FormSchema;
  return {
    schema: schema as RJSFSchema,
    validator,
    uiSchema: { ...uiSchemaFor(typed), ...extra.uiSchema },
    widgets: { masked: MaskedWidget, datePicker: DateWidget, timePicker: TimeWidget, booleanChoice: BooleanChoiceWidget, notice: NoticeWidget },
    customValidate: customValidate(typed),
    showErrorList: false as const,
    noHtml5Validate: true,
    transformErrors: (errors: RJSFValidationError[]) => errors.map((error) => ({ ...error, message: messages[error.name ?? ''] ?? error.message })),
  };
}

export function validateAnswers(schema: Record<string, unknown>, answers: Record<string, unknown>) {
  const props = schemaFormProps(schema);
  return validator.validateFormData(answers, props.schema, props.customValidate, props.transformErrors).errors;
}
