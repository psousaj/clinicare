# Investigação de anamneses e contratos em acompanhamentos

Data: 2026-10-08

## Resumo executivo

1. **Não há duplicação de uma mesma anamnese na criação do acompanhamento.** A implementação reúne as anamneses vinculadas diretamente à oferta (combo, versão do plano ou evento) e as vinculadas aos procedimentos. Antes de buscar os formulários e inserir os registros aplicados, aplica `Set` aos IDs (`apps/api/src/followups.ts:135-145`). Portanto, se o mesmo `anamnesisId` estiver nos dois caminhos, apenas uma linha é inserida em `applied_anamneses` (`apps/api/src/followups.ts:184-185`). O teste de integração documenta a intenção de união sem duplicação (`apps/api/src/anamnesis-links.integration.test.ts:83-106`).
2. **A preservação dos registros no cancelamento é esperada**, não uma exclusão faltante: a especificação exige cancelar sem apagar pagamentos, atendimentos, contratos ou anamneses (`docs/specs/migracao-postgresql-drizzle-jsonb.md:67-69`), e a especificação de assinatura exige preservar PDFs, revisões e eventos (`docs/specs/assinatura-eletronica-mvp.md:204-207`).
3. **Há, contudo, dois problemas operacionais no estado pendente após cancelamento:**
   - contratos aplicados que ainda estão `generating` e ainda não têm `signature_process` não são atualizados para `cancelled`, porque o cancelamento só percorre contratos unidos a processos de assinatura (`apps/api/src/followups.ts:237-248`); o gerador apenas abandona a materialização quando vê o acompanhamento cancelado (`apps/api/src/contract-generation.ts:128-133`), deixando potencialmente a linha em `generating`;
   - anamneses não respondidas permanecem exibidas como pendentes e seus tokens continuam utilizáveis, pois o cancelamento não altera `applied_anamneses` (`apps/api/src/followups.ts:234-249`) e a leitura/submissão clínica não verifica o status do acompanhamento, somente a validade do token e `submittedAt` (`apps/api/src/clinical.ts:46-48`, `74-92`). Preservar o histórico é esperado; permitir nova operação clínica depois do cancelamento é comportamento inconsistente com “interromper sua operação” (`docs/specs/migracao-postgresql-drizzle-jsonb.md:67-69`, `121-125`).

## 1. Criação: associação por oferta e por procedimento

### Fluxo ponta a ponta

`createFollowup` primeiro resolve a oferta (`apps/api/src/followups.ts:148-154`). Para planos, os itens de combo são expandidos em itens por procedimento (`apps/api/src/followups.ts:119-124`); para eventos, os itens escolhidos também acabam em `offer.items` (`apps/api/src/followups.ts:80-97`).

`offerForms` então coleta quatro fontes possíveis:

- `combo_anamneses`, quando há combo (`apps/api/src/followups.ts:137-138`);
- `plan_version_anamneses`, quando há versão de plano (`apps/api/src/followups.ts:139`);
- `event_anamneses`, quando há evento (`apps/api/src/followups.ts:140`);
- `anamnesis_procedures`, para os procedimentos presentes nos itens (`apps/api/src/followups.ts:141`).

O ponto decisivo é:

```ts
const ids = [...new Set([...owned, ...links.map((x: any) => x.anamnesisId)])];
```

(`apps/api/src/followups.ts:142`). O código usa o ID lógico da anamnese como chave de deduplicação, depois filtra anamneses ativas e seleciona a versão mais recente (`apps/api/src/followups.ts:143-145`). A transação insere uma única aplicação por elemento de `forms` (`apps/api/src/followups.ts:184-185`).

### Evidência de teste

O teste configura anamnese no procedimento e outras na oferta e verifica que combo, plano e evento recebem a união esperada; no evento, consulta diretamente o banco e espera exatamente duas aplicações (`apps/api/src/anamnesis-links.integration.test.ts:83-106`). A própria descrição do caso de combo explicita “sem duplicar a presente nos dois lados” (`apps/api/src/anamnesis-links.integration.test.ts:91-95`).

**Conclusão:** para o caso perguntado — a mesma anamnese associada a procedimento e a evento/plano — o código não cria duas aplicações. A lista intermediária pode conter o ID repetido, mas o `Set` elimina a repetição antes do insert.

## 2. Cancelamento: anamneses

O cancelamento muda o acompanhamento para `cancelled`, grava motivo e timestamp (`apps/api/src/followups.ts:221-236`). Não há `UPDATE` nem `DELETE` de `applied_anamneses`; o retorno de `getFollowup` continua carregando todas as aplicações daquele acompanhamento (`apps/api/src/followups.ts:195-199`), e a resposta marca cada uma como `answered` apenas conforme `submittedAt` (`apps/api/src/followups.ts:211-213`). Assim, uma anamnese não respondida continua aparecendo pendente no histórico.

Isso é compatível com a decisão explícita de preservar anamneses no cancelamento, não apagá-las (`docs/specs/migracao-postgresql-drizzle-jsonb.md:67-69`). Porém, o fluxo clínico não fecha a aplicação: `byToken` aceita o token enquanto não expirado e sem submissão (`apps/api/src/clinical.ts:46-48`), e tanto salvar rascunho quanto submeter chamam essa busca sem consultar `followups.status` (`apps/api/src/clinical.ts:74-92`). Logo, a pendência não é somente histórica: uma anamnese já associada a acompanhamento cancelado pode continuar sendo lida e respondida.

**Classificação:** preservar a linha pendente é esperado; manter a capacidade de responder após cancelamento é um provável bug de regra de negócio/controle de estado. O repositório não contém teste que valide o bloqueio de anamneses após cancelamento.

## 3. Cancelamento: contratos

### Contratos com processo de assinatura

Na criação, contratos sem DOCX começam `pending` e recebem processos de assinatura (`apps/api/src/followups.ts:169-180`). No cancelamento, cada contrato que possui processo é localizado pelo `innerJoin`; tokens são revogados, o processo pendente é cancelado, o contrato é marcado `cancelled` e eventos de cancelamento são registrados (`apps/api/src/followups.ts:237-247`). O teste de histórico confirma que o processo fica cancelado e que os eventos são preservados (`apps/api/src/signature-history.integration.test.ts:243-274`).

Isso também explica por que contratos cancelados desaparecem da visão normal do acompanhamento, que exclui `followup_contracts.status = 'cancelled'` (`apps/api/src/followups.ts:195-207`), enquanto o histórico de assinatura continua acessível — comportamento alinhado à preservação exigida pela especificação (`docs/specs/assinatura-eletronica-mvp.md:204-207`).

### Contratos ainda em geração

Contratos DOCX começam `generating` e, deliberadamente, não recebem processo de assinatura na criação (`apps/api/src/followups.ts:169-175`). Se o acompanhamento for cancelado durante essa janela, o `UPDATE` do cancelamento não alcança essa linha, porque ela não participa do `innerJoin` com `signature_processes` (`apps/api/src/followups.ts:237-241`).

O gerador trata o cancelamento como motivo para não finalizar a materialização (`apps/api/src/contract-generation.ts:128-133`), mas esse caminho apenas retorna; não marca o contrato como `cancelled`. Portanto, a linha pode permanecer `generating`, e o `getFollowup` pode expô-la porque filtra apenas status `cancelled` (`apps/api/src/followups.ts:195-198`).

**Classificação:** preservar o contrato e seus artefatos/histórico é esperado; deixar contrato de acompanhamento cancelado em `generating` é um bug de transição de estado. A especificação inclusive exige que cancelar durante geração impeça a promoção para processos acionáveis (`docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md:28-34`), mas não há no fluxo atual uma transição explícita desse contrato para `cancelled`.

## Conclusão

- **Duplicação de anamnese:** não ocorre na criação normal; o `Set` deduplica por `anamnesisId` antes do insert, com teste de integração cobrindo a união das fontes.
- **Anamneses após cancelamento:** devem ser preservadas para histórico. O fato de continuarem armazenadas/visíveis pendentes é esperado, mas a possibilidade de leitura, rascunho e submissão após cancelamento é uma lacuna provável.
- **Contratos após cancelamento:** os que já têm processo são cancelados e preservados historicamente. Os que estão `generating` sem processo podem ficar pendentes em `generating`; esse é um bug de estado, embora o gerador corretamente não os promova a assinatura.
