import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ClipboardList, FileText, Layers3, Stethoscope } from 'lucide-react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { PlanOfferPicker } from '@/components/PlanOfferPicker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { currency } from '@/lib/format';
import { parseForm, planForm } from '@/lib/forms';
import { linkedContractIds, minSessionsOf, sessionsFor, suggestedPriceCents } from '@/lib/planOffers';
import { combosQuery, contractsQuery, plansQuery, proceduresQuery, useCreatePlan, useUpdatePlan } from '@/lib/queries';

export const Route = createFileRoute('/_app/planos/novo')({ validateSearch: z.object({ planId: z.string().optional() }), component: NewPlan });

function toggle(list: string[], id: string, on: boolean) {
  return on ? [...list.filter((item) => item !== id), id] : list.filter((item) => item !== id);
}

function NewPlan() {
  const { planId } = Route.useSearch();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const proceduresData = useQuery(proceduresQuery).data, combosData = useQuery(combosQuery).data, contractsData = useQuery(contractsQuery).data;
  const procedures = useMemo(() => proceduresData ?? [], [proceduresData]);
  const combos = useMemo(() => combosData ?? [], [combosData]);
  const contracts = useMemo(() => (contractsData ?? []).filter((contract) => contract.active !== false), [contractsData]);
  const existing = useQuery({ ...plansQuery, enabled: Boolean(planId) }).data?.find((plan) => plan.id === planId);
  const [pickedProcedureIds, setProcedureIds] = useState<string[]>([]), [pickedComboIds, setComboIds] = useState<string[]>([]);
  const [procedureSessions, setProcedureSessions] = useState<Record<string, string>>({});
  // Marcações manuais de contrato; sem marcação manual vale a sugestão (contratos dos itens escolhidos).
  const [contractOverrides, setContractOverrides] = useState<Record<string, boolean>>({});
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(false);
  const [price, setPrice] = useState(''), [priceEdited, setPriceEdited] = useState(false);
  const contractsHydrated = useRef(false);

  // Só valem os itens que existem no catálogo carregado: contagem, preço, contratos e envio ficam coerentes.
  const procedureIds = useMemo(() => pickedProcedureIds.filter((id) => procedures.some((procedure) => procedure.id === id)), [pickedProcedureIds, procedures]);
  const comboIds = useMemo(() => pickedComboIds.filter((id) => combos.some((combo) => combo.id === id)), [pickedComboIds, combos]);
  const suggestedCents = suggestedPriceCents({ procedures, combos, procedureIds, comboIds, sessions: procedureSessions });
  const suggestedPrice = suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : '';
  const shownPrice = priceEdited ? price : suggestedPrice;
  const linked = linkedContractIds(contracts, procedureIds, comboIds);
  const contractSelected = (id: string) => contractOverrides[id] ?? linked.has(id);
  // A marcação manual só é guardada quando diverge da sugestão; assim, remover o item volta a desmarcar o contrato dele.
  const setContractSelected = (id: string, checked: boolean) => setContractOverrides((current) => {
    const { [id]: _previous, ...rest } = current;
    return checked === linked.has(id) ? rest : { ...rest, [id]: checked };
  });
  const contractIds = contracts.filter((contract) => contractSelected(contract.id)).map((contract) => contract.id);

  useEffect(() => {
    if (!existing) return;
    const existingProcedures = existing.items.filter((item) => item.offerType === 'procedure');
    setProcedureIds(existingProcedures.map((item) => item.offerId));
    setComboIds(existing.items.filter((item) => item.offerType === 'combo').map((item) => item.offerId));
    setProcedureSessions(Object.fromEntries(existingProcedures.map((item) => [item.offerId, String(item.sessions)])));
    setRequireNewAnamnesis(existing.requireNewAnamnesis === true);
    setPrice((existing.priceCents / 100).toFixed(2));
    setPriceEdited(true);
    contractsHydrated.current = false;
  }, [existing]);
  useEffect(() => {
    if (!existing || contractsHydrated.current || !contractsData) return;
    contractsHydrated.current = true;
    const savedLinked = linkedContractIds(contracts, existing.items.filter((item) => item.offerType === 'procedure').map((item) => item.offerId), existing.items.filter((item) => item.offerType === 'combo').map((item) => item.offerId));
    setContractOverrides(Object.fromEntries(contracts.filter((contract) => existing.contractIds.includes(contract.id) !== savedLinked.has(contract.id)).map((contract) => [contract.id, existing.contractIds.includes(contract.id)])));
  }, [existing, contracts, contractsData]);

  const contractOrigin = (contract: (typeof contracts)[number]) => contract.kind === 'procedure'
    ? procedures.find((procedure) => procedure.id === contract.procedureId)?.name
    : contract.kind === 'combo' ? combos.find((combo) => combo.id === contract.comboId)?.name : undefined;

  return (
    <FormPage
      className="plan-form-page"
      backTo="/planos"
      backLabel="Planos"
      title={planId ? `Editar · ${existing?.name ?? 'Plano'}` : 'Novo plano'}
      submitLabel="Salvar plano"
      onSubmit={(form) => {
        const { price: priceCents, ...data } = parseForm(planForm, form);
        const chosen = procedureIds.map((id) => procedures.find((procedure) => procedure.id === id)!);
        if (chosen.some((procedure) => !Number.isInteger(Number(procedureSessions[procedure.id] ?? minSessionsOf(procedure))) || Number(procedureSessions[procedure.id] ?? minSessionsOf(procedure)) < minSessionsOf(procedure))) throw new Error('A quantidade de sessões não pode ser menor que a base do procedimento.');
        const items = [
          ...chosen.map((procedure) => ({ offerType: 'procedure' as const, offerId: procedure.id, sessions: sessionsFor(procedure, procedureSessions) })),
          ...comboIds.map((offerId) => ({ offerType: 'combo' as const, offerId })),
        ];
        if (!items.length) throw new Error('Escolha ao menos um procedimento ou combo para o plano.');
        if (!contractIds.length) throw new Error('Selecione ao menos um contrato aplicável ao plano.');
        return planId ? update.mutateAsync({ id: planId, ...data, priceCents, items, contractIds, requireNewAnamnesis }) : create.mutateAsync({ ...data, priceCents, items, contractIds, requireNewAnamnesis });
      }}
    >
      <div className="plan-intro"><span className="plan-intro-mark"><Layers3 size={19} /></span><div><p>Monte uma oferta completa</p><span>Defina o valor e reúna os procedimentos, combos e documentos que fazem parte deste plano.</span></div></div>
      <section className="plan-section">
        <SectionHeading icon={<ClipboardList size={17} />} title="Informações do plano" detail="Dê um nome fácil de reconhecer e defina as condições principais." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do plano" name="name" required autoFocus placeholder="Ex.: Plano de cuidados faciais" defaultValue={existing?.name} />
          <div className="grid gap-1.5 content-start">
            <Field label="Preço do plano (R$)" name="price" type="number" min="0" step="0.01" required placeholder="0,00" value={shownPrice} onChange={(event) => { setPrice(event.target.value); setPriceEdited(true); }} />
            {suggestedCents > 0 && (
              <div className="plan-price-hint">
                <span>Sugerido: {currency(suggestedCents)} (soma dos itens)</span>
                {priceEdited && shownPrice !== suggestedPrice && <Button type="button" size="sm" variant="ghost" onClick={() => setPriceEdited(false)}>Usar sugerido</Button>}
              </div>
            )}
          </div>
        </div>
        <Field label="Descrição" name="description" placeholder="Conte em poucas palavras o que está incluído" defaultValue={existing?.description ?? ''} />
        <div className="plan-timing"><div className="plan-timing-title"><CalendarDays size={16} /><span>Prazos <small>opcionais</small></span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duração do tratamento (dias)" name="durationDays" type="number" min="1" placeholder="Sem prazo definido" defaultValue={existing?.durationDays ?? ''} />
            <Field label="Validade após contratação (dias)" name="validityDays" type="number" min="1" placeholder="Sem prazo definido" defaultValue={existing?.validityDays ?? ''} />
          </div>
        </div>
      </section>
      <section className="plan-section">
        <SectionHeading icon={<Stethoscope size={17} />} title="Procedimentos incluídos" detail="Escolha procedimentos avulsos e combos. Nos combos, as sessões seguem a configuração do próprio combo." count={`${procedureIds.length + comboIds.length} selecionado${procedureIds.length + comboIds.length === 1 ? '' : 's'}`} />
        <PlanOfferPicker
          procedures={procedures}
          combos={combos}
          procedureIds={procedureIds}
          comboIds={comboIds}
          sessions={procedureSessions}
          onToggleProcedure={(id, on) => {
            setProcedureIds((list) => toggle(list, id, on));
            if (on) setProcedureSessions((current) => ({ ...current, [id]: String(minSessionsOf(procedures.find((procedure) => procedure.id === id)!)) }));
          }}
          onToggleCombo={(id, on) => setComboIds((list) => toggle(list, id, on))}
          onSessionsChange={(id, value) => setProcedureSessions((current) => ({ ...current, [id]: value }))}
        />
      </section>
      <section className="plan-section">
        <SectionHeading icon={<FileText size={17} />} title="Contratos e anamnese" detail="Os contratos dos procedimentos e combos escolhidos já vêm marcados; marque outros ou desmarque se precisar." count={`${contractIds.length} contrato${contractIds.length === 1 ? '' : 's'}`} />
        <div role="group" aria-label="Contratos do plano" className="plan-choice-group">
          {contracts.length === 0 && <p className="plan-choice-empty">Nenhum contrato cadastrado.</p>}
          <div className="plan-choice-list">
            {contracts.map((contract) => {
              const origin = contractOrigin(contract);
              return (
                <div key={contract.id} className={`plan-choice${contractSelected(contract.id) ? ' is-selected' : ''}`}>
                  <Label className="plan-choice-main cursor-pointer">
                    <Checkbox checked={contractSelected(contract.id)} onCheckedChange={(value) => setContractSelected(contract.id, value === true)} />
                    {contract.title}
                  </Label>
                  {linked.has(contract.id) && <span className="plan-badge is-auto">{contractSelected(contract.id) ? 'Automático' : 'Sugerido'}{origin ? ` · ${origin}` : ''}</span>}
                  {contract.kind === 'standard' && <span className="plan-badge">Padrão</span>}
                </div>
              );
            })}
          </div>
        </div>
        <Label className="plan-anamnesis cursor-pointer"><Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} /><span><strong>Solicitar nova anamnese</strong><small>Mesmo que a última ainda esteja dentro do prazo de validade.</small></span></Label>
      </section>
    </FormPage>
  );
}

function SectionHeading({ icon, title, detail, count }: { icon: ReactNode; title: string; detail: string; count?: string }) {
  return <div className="plan-section-heading"><span className="plan-section-icon">{icon}</span><div><h3>{title}</h3><p>{detail}</p></div>{count && <span className="plan-count">{count}</span>}</div>;
}
