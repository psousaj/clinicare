import { useState, type ReactNode } from 'react';
import Form from '@rjsf/core';
import { schemaFormProps } from '@/lib/schemaUi';

type Props = { schema: Record<string, unknown>; value?: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; readOnly?: boolean; actions?: ReactNode; onSubmit?: (value: Record<string, unknown>) => void };

export function SchemaForm({ schema, value = {}, onChange, readOnly = false, actions, onSubmit }: Props) {
  const [answers, setAnswers] = useState(value);
  const update = ({ formData }: { formData?: Record<string, unknown> }) => {
    const next = formData ?? {};
    setAnswers(next);
    onChange(next);
  };
  return (
    <div className="schema-response-form">
      <Form {...schemaFormProps(schema)} formData={answers} onChange={update} disabled={readOnly} onSubmit={({ formData }) => onSubmit?.(formData ?? {})}>
        {actions ?? <></>}
      </Form>
    </div>
  );
}
