import type { RJSFSchema, RJSFValidationError, UiSchema, WidgetProps } from '@rjsf/utils';
import type { FormProps } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
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
      case 'multi': ui[key] = { 'ui:widget': 'checkboxes' }; break;
      case 'scale': ui[key] = { 'ui:widget': 'range' }; break;
    }
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
    widgets: { masked: MaskedWidget, datePicker: DateWidget, timePicker: TimeWidget },
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
