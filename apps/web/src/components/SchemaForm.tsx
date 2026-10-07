import { useState, type ReactNode, type Ref } from 'react';
import Form from '@rjsf/core';
import { schemaFormProps } from '@/lib/schemaUi';
import { useConditionalForm } from '@/lib/conditionalSchema';

type Props = { schema: Record<string, unknown>; value?: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; readOnly?: boolean; actions?: ReactNode; onSubmit?: (value: Record<string, unknown>) => void; formRef?: Ref<Form> };

export function SchemaForm({ schema, value = {}, onChange, readOnly = false, actions, onSubmit, formRef }: Props) {
  const [answers, setAnswers] = useState(value);
  const form = useConditionalForm(schema, answers, (next) => {
    setAnswers(next);
    onChange(next);
  });
  return (
    <div className="schema-response-form">
      <Form ref={formRef} {...schemaFormProps(form.widgetSchema)} formData={form.widgetAnswers} onChange={({ formData }) => form.handleChange(formData)} disabled={readOnly} onSubmit={({ formData }) => onSubmit?.(form.submitData(formData))}>
        {actions ?? <></>}
      </Form>
    </div>
  );
}
