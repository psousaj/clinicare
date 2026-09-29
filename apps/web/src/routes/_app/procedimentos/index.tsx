import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Layers, Pencil, Percent, Plus, Search, Sparkles, Tags } from 'lucide-react';
import { z } from 'zod';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { currency, type Tone } from '@/lib/format';
import { anamnesesQuery, combosQuery, proceduresQuery, useUpdateCombo, useUpdateProcedure } from '@/lib/queries';
import type { Combo } from '@/lib/schemas';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/procedimentos/')({
  validateSearch: z.object({
    aba: z.enum(['procedimentos', 'combos']).catch('procedimentos'),
    q: z.string().optional().catch(undefined),
    status: z.enum(['todos', 'ativos', 'inativos']).catch('ativos'),
  }),
  component: Catalog,
});

const utcDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function comboStatus(combo: Combo): { label: string; tone: Tone } {
  const now = Date.now();
  if (combo.active === false) return { label: 'Inativo', tone: 'neutral' };
  if (combo.validUntil && new Date(combo.validUntil).getTime() + 86400000 <= now) return { label: 'Vencido', tone: 'danger' };
  if (combo.validFrom && new Date(combo.validFrom).getTime() > now) return { label: 'Agendado', tone: 'warning' };
  return combo.promotionalPriceCents != null ? { label: 'Promocional', tone: 'success' } : { label: 'Ativo', tone: 'success' };
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const td = 'px-3 py-3 align-middle';

function Catalog() {
  const { aba, q = '', status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery), anamneses = useQuery(anamnesesQuery);
  const updateProcedure = useUpdateProcedure(), updateCombo = useUpdateCombo();
  const procedureList = procedures.data ?? [], comboList = combos.data ?? [];
  const setSearch = (patch: Partial<{ aba: typeof aba; q: string | undefined; status: typeof status }>) => navigate({ search: (current) => ({ ...current, ...patch }), replace: true });

  const term = q.trim().toLowerCase();
  const visible = <T extends { name: string; active?: boolean }>(items: T[]) => items.filter((item) => item.name.toLowerCase().includes(term) && (status === 'todos' || (status === 'ativos') === (item.active !== false)));
  const shownProcedures = visible(procedureList), shownCombos = visible(comboList);
  const activeProcedures = procedureList.filter((procedure) => procedure.active !== false);
  const validCombos = comboList.filter((combo) => ['Ativo', 'Promocional'].includes(comboStatus(combo).label));
  const averagePrice = activeProcedures.length ? Math.round(activeProcedures.reduce((total, procedure) => total + procedure.priceCents, 0) / activeProcedures.length) : 0;
  const nameOf = (id?: string) => procedureList.find((procedure) => procedure.id === id)?.name ?? 'Procedimento removido';
  const formsFor = (procedureId: string) => (anamneses.data ?? []).filter((form) => form.procedureIds?.includes(procedureId)).length;

  const stats = [
    { heading: 'Procedimentos ativos', icon: Sparkles, tone: 'violet', value: `${activeProcedures.length}`, foot: `${procedureList.length} cadastrados` },
    { heading: 'Combos vigentes', icon: Layers, tone: 'peach', value: `${validCombos.length}`, foot: `${comboList.length} cadastrados` },
    { heading: 'Promoções vigentes', icon: Percent, tone: 'mint', value: `${validCombos.filter((combo) => combo.promotionalPriceCents != null).length}`, foot: 'Combos com preço promocional' },
    { heading: 'Preço médio', icon: Tags, tone: 'blue', value: currency(averagePrice), foot: 'Procedimentos ativos' },
  ];

  return (
    <div className="grid gap-4">
      <section className="stats-grid">
        {stats.map(({ heading, icon: Icon, tone, value, foot }) => (
          <article className="stat-card" key={heading}>
            <div className="stat-heading">{heading} <span className={`stat-icon ${tone}`}><Icon size={17} /></span></div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">{foot}</div>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div><div className="section-kicker">CATÁLOGO</div><h2>Ofertas da clínica</h2></div>
          <Button asChild>
            {aba === 'procedimentos'
              ? <Link to="/procedimentos/novo"><Plus /> Novo procedimento</Link>
              : <Link to="/procedimentos/combos/novo"><Plus /> Novo combo</Link>}
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Catálogo" className="inline-flex rounded-lg bg-muted p-1">
            {([['procedimentos', `Procedimentos (${procedureList.length})`], ['combos', `Combos (${comboList.length})`]] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={aba === value} onClick={() => setSearch({ aba: value })} className={cn('cursor-pointer rounded-md border-0 px-3 py-1.5 text-sm font-medium', aba === value ? 'bg-background text-foreground shadow-xs' : 'bg-transparent text-muted-foreground hover:text-foreground')}>{label}</button>
            ))}
          </div>
          <label className="search-box m-0 min-w-56 flex-1">
            <Search size={16} />
            <input value={q} onChange={(event) => setSearch({ q: event.target.value || undefined })} placeholder={aba === 'procedimentos' ? 'Buscar procedimento' : 'Buscar combo'} aria-label="Buscar no catálogo" />
          </label>
          <div className="w-44">
            <NativeSelect aria-label="Situação" value={status} onChange={(event) => setSearch({ status: event.target.value as typeof status })}>
              <NativeSelectOption value="ativos">Somente ativos</NativeSelectOption>
              <NativeSelectOption value="inativos">Inativos</NativeSelectOption>
              <NativeSelectOption value="todos">Todos</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <QueryError query={aba === 'procedimentos' ? procedures : combos} />
        {aba === 'procedimentos' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border"><th className={th}>Procedimento</th><th className={th}>Tipo</th><th className={th}>Sessões</th><th className={th}>Duração</th><th className={th}>Anamneses</th><th className={cn(th, 'text-right')}>Preço</th><th className={th}>Situação</th><th className={th}><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {shownProcedures.map((procedure) => (
                  <tr key={procedure.id} className={cn('border-b border-border hover:bg-muted/40', procedure.active === false && 'opacity-70')}>
                    <td className={td}>
                      <Link to="/procedimentos/$procedureId" params={{ procedureId: procedure.id }} className="font-semibold text-foreground no-underline hover:text-primary">{procedure.name}</Link>
                      {procedure.description && <div className="max-w-xs truncate text-xs text-muted-foreground">{procedure.description}</div>}
                    </td>
                    <td className={td}><StatusBadge tone={procedure.standalone === false ? 'warning' : 'neutral'}>{procedure.standalone === false ? 'Só combo/plano' : 'Avulso'}</StatusBadge></td>
                    <td className={td}>{procedure.baseSessions}</td>
                    <td className={td}>{procedure.durationMinutes ?? 60} min</td>
                    <td className={td}>{formsFor(procedure.id) || '—'}</td>
                    <td className={cn(td, 'text-right font-semibold')}>{currency(procedure.priceCents)}</td>
                    <td className={td}><StatusBadge tone={procedure.active === false ? 'neutral' : 'success'}>{procedure.active === false ? 'Inativo' : 'Ativo'}</StatusBadge></td>
                    <td className={cn(td, 'text-right whitespace-nowrap')}>
                      <Button variant="ghost" size="sm" asChild><Link to="/procedimentos/$procedureId" params={{ procedureId: procedure.id }} aria-label={`Editar ${procedure.name}`}><Pencil /> Editar</Link></Button>
                      <Button variant="ghost" size="sm" className="bg-transparent hover:bg-muted" disabled={updateProcedure.isPending} onClick={() => updateProcedure.mutate({ id: procedure.id, active: procedure.active === false })}>{procedure.active === false ? 'Ativar' : 'Desativar'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {procedures.isSuccess && shownProcedures.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{procedureList.length === 0 ? 'Nenhum procedimento cadastrado ainda.' : 'Nenhum procedimento encontrado com esses filtros.'}</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border"><th className={th}>Combo</th><th className={th}>Procedimentos</th><th className={th}>Validade</th><th className={cn(th, 'text-right')}>Preço</th><th className={th}>Situação</th><th className={th}><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {shownCombos.map((combo) => {
                  const state = comboStatus(combo);
                  return (
                    <tr key={combo.id} className={cn('border-b border-border hover:bg-muted/40', combo.active === false && 'opacity-70')}>
                      <td className={td}>
                        <Link to="/procedimentos/combos/$comboId" params={{ comboId: combo.id }} className="font-semibold text-foreground no-underline hover:text-primary">{combo.name}</Link>
                        {combo.description && <div className="max-w-xs truncate text-xs text-muted-foreground">{combo.description}</div>}
                      </td>
                      <td className={td}>
                        <div className="flex max-w-sm flex-wrap gap-1">
                          {combo.items.map((item, index) => <span key={index} className="rounded-md bg-muted px-2 py-0.5 text-xs">{nameOf(item.procedureId)}{item.sessionsOverride ? ` · ${item.sessionsOverride}x` : ''}</span>)}
                        </div>
                      </td>
                      <td className={td}>{combo.validUntil ? `${combo.validFrom ? `${utcDate(combo.validFrom)} – ` : 'Até '}${utcDate(combo.validUntil)}` : 'Sem prazo'}</td>
                      <td className={cn(td, 'text-right font-semibold')}>
                        {combo.promotionalPriceCents != null ? <><span className="mr-2 text-xs font-normal text-muted-foreground line-through">{currency(combo.priceCents)}</span>{currency(combo.promotionalPriceCents)}</> : currency(combo.priceCents)}
                      </td>
                      <td className={td}><StatusBadge tone={state.tone}>{state.label}</StatusBadge></td>
                      <td className={cn(td, 'text-right whitespace-nowrap')}>
                        <Button variant="ghost" size="sm" asChild><Link to="/procedimentos/combos/$comboId" params={{ comboId: combo.id }} aria-label={`Editar ${combo.name}`}><Pencil /> Editar</Link></Button>
                        <Button variant="ghost" size="sm" className="bg-transparent hover:bg-muted" disabled={updateCombo.isPending} onClick={() => updateCombo.mutate({ id: combo.id, active: combo.active === false })}>{combo.active === false ? 'Ativar' : 'Desativar'}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {combos.isSuccess && shownCombos.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{comboList.length === 0 ? 'Nenhum combo cadastrado ainda.' : 'Nenhum combo encontrado com esses filtros.'}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
