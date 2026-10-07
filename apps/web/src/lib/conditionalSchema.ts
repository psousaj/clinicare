import { kindOf } from './fieldKinds';

export type VisibilityCondition = { field: string; equals: boolean | string };
type SchemaProperty = Record<string, unknown> & { 'x-visibleWhen'?: VisibilityCondition };
type ConditionalSchema = Record<string, unknown> & {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};

function conditionOf(property: SchemaProperty): VisibilityCondition | undefined {
  const condition = property['x-visibleWhen'];
  return condition && typeof condition.field === 'string' && (typeof condition.equals === 'boolean' || typeof condition.equals === 'string')
    ? condition
    : undefined;
}

/**
 * Ordem visual explícita dos campos. O `jsonb` do Postgres reordena as chaves
 * do schema ao persistir, então a ordem precisa ser um dado (array preserva
 * ordem no `jsonb`). Schemas antigos sem o array usam a ordem do objeto.
 */
export function orderedPropertyEntries(schema: Record<string, unknown>): Array<[string, SchemaProperty]> {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  const entries = Object.entries(properties);
  const order = (schema as Record<string, unknown>)['x-propertyOrder'];
  if (!Array.isArray(order)) return entries;
  const rank = new Map(order.filter((key): key is string => typeof key === 'string').map((key, index) => [key, index]));
  return [...entries].sort(([a], [b]) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
}

export function withPropertyOrder(properties: Record<string, SchemaProperty>): Record<string, unknown> {
  return { 'x-propertyOrder': Object.keys(properties) };
}

export function visibleFieldKeys(schema: Record<string, unknown>, answers: Record<string, unknown>): Set<string> {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  const memo = new Map<string, boolean>();

  function visible(key: string, visiting: Set<string>): boolean {
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return false; // Fail closed on corrupt/cyclic rules.
    const property = properties[key];
    if (!property) return false;
    const condition = conditionOf(property);
    if (!condition || !properties[condition.field]) {
      memo.set(key, true);
      return true;
    }
    const nextVisiting = new Set(visiting).add(key);
    const result = visible(condition.field, nextVisiting) && Object.is(answers[condition.field], condition.equals);
    memo.set(key, result);
    return result;
  }

  return new Set(Object.keys(properties).filter((key) => visible(key, new Set())));
}

export function schemaForAnswers(schema: Record<string, unknown>, answers: Record<string, unknown>) {
  const source = schema as ConditionalSchema;
  const visible = visibleFieldKeys(schema, answers);
  // A ordem de exibição é do `ui:order` (ver uiSchemaFor); aqui só filtra.
  const properties = Object.fromEntries(Object.entries(source.properties ?? {}).filter(([key]) => visible.has(key)));
  return {
    ...source,
    properties,
    ...(source.required ? { required: source.required.filter((key) => visible.has(key) && kindOf(properties[key] ?? {}) !== 'notice') } : {}),
  };
}

/** Hidden answers are removed instead of being silently submitted as stale data. */
export function answersForSchema(schema: Record<string, unknown>, answers: Record<string, unknown>) {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  const visible = visibleFieldKeys(schema, answers);
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => visible.has(key) && kindOf(properties[key] ?? {}) !== 'notice'),
  );
}

/** RJSF defaults missing JSON Schema booleans to false. Use explicit string
 * choices in the widget layer so an unanswered Sim/Não remains unanswered. */
export function schemaForWidgets(schema: Record<string, unknown>) {
  const source = schema as ConditionalSchema;
  return {
    ...source,
    properties: Object.fromEntries(Object.entries(source.properties ?? {}).map(([key, property]) => [
      key,
      kindOf(property) === 'boolean' ? { ...property, type: 'string', enum: ['Sim', 'Não'] } : property,
    ])),
  };
}

export function answersForWidgets(schema: Record<string, unknown>, answers: Record<string, unknown>) {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  return Object.fromEntries(Object.entries(answers).map(([key, value]) => [
    key,
    kindOf(properties[key] ?? {}) === 'boolean' && typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value,
  ]));
}

export function answersFromWidgets(schema: Record<string, unknown>, answers: Record<string, unknown>) {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  return Object.fromEntries(Object.entries(answers).flatMap(([key, value]) => {
    if (kindOf(properties[key] ?? {}) !== 'boolean') return [[key, value]];
    if (value === 'Sim') return [[key, true]];
    if (value === 'Não') return [[key, false]];
    return [];
  }));
}

export function conditionWouldCycle(schema: Record<string, unknown>, fieldKey: string, sourceKey: string): boolean {
  const properties = ((schema as ConditionalSchema).properties ?? {}) as Record<string, SchemaProperty>;
  const visit = (key: string, seen = new Set<string>()): boolean => {
    if (key === fieldKey) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    const condition = properties[key] && conditionOf(properties[key]!);
    return condition ? visit(condition.field, seen) : false;
  };
  return visit(sourceKey);
}

/** Pipeline único entre prévia do editor e formulários reais: filtra por
 * visibilidade, adapta widgets e converte respostas de ida e volta. */
export function useConditionalForm(
  schema: Record<string, unknown>,
  answers: Record<string, unknown>,
  onAnswers: (next: Record<string, unknown>) => void,
) {
  const visibleSchema = schemaForAnswers(schema, answers);
  const widgetSchema = schemaForWidgets(visibleSchema);
  const widgetAnswers = answersForWidgets(visibleSchema, answers);
  const handleChange = (formData: Record<string, unknown> | undefined) => {
    onAnswers(answersForSchema(schema, answersFromWidgets(schema, formData ?? {})));
  };
  const submitData = (formData: Record<string, unknown> | undefined) =>
    answersForSchema(schema, answersFromWidgets(schema, formData ?? {}));
  return { widgetSchema, widgetAnswers, handleChange, submitData };
}
