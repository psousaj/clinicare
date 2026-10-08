# Correção do cancelamento de acompanhamento, anamneses e contratos

## Problem Statement

Ao iniciar um acompanhamento, as anamneses da oferta e dos procedimentos são reunidas. A mesma anamnese pode aparecer nas duas origens e precisa resultar em uma única anamnese aplicada.

Ao cancelar um acompanhamento, o histórico clínico e contratual deve ser preservado, mas o acompanhamento precisa deixar de ser operacional. Atualmente, uma anamnese aplicada ainda não respondida pode continuar disponível para leitura, rascunho e envio, e um contrato aplicado que ainda está em `generating`, sem processo de assinatura, pode permanecer nesse estado. Isso faz um acompanhamento cancelado continuar apresentando pendências acionáveis.

## Solution

Corrigir o ciclo de vida do acompanhamento para separar retenção histórica de operação:

- manter uma única anamnese aplicada por `anamnesisId`, mesmo quando ela vier da oferta e de um procedimento;
- preservar anamneses, respostas, contratos, PDFs, revisões, eventos e snapshots para histórico;
- impedir leitura, gravação de rascunho, submissão e novas solicitações de anamneses de um acompanhamento cancelado;
- marcar contratos aplicados ainda em geração como cancelados quando o acompanhamento for cancelado;
- cancelar processos, revogar tokens e impedir assinatura, retry ou promoção operacional depois do cancelamento;
- manter a possibilidade de uma nova contratação da mesma oferta após o cancelamento, sem reabrir o acompanhamento anterior.

## User Stories

1. Como profissional, quero que uma anamnese vinculada ao procedimento e à oferta seja aplicada uma única vez, para não solicitar respostas duplicadas ao paciente.
2. Como profissional, quero que a união das anamneses da oferta e dos procedimentos preserve todas as anamneses distintas, para que nenhum requisito clínico seja perdido.
3. Como paciente, quero receber no máximo uma solicitação para cada anamnese aplicada, para responder um formulário sem ambiguidade.
4. Como profissional, quero cancelar um acompanhamento com um motivo registrado, para interromper sua operação de forma auditável.
5. Como clínica, quero preservar a anamnese aplicada após o cancelamento, para manter o histórico clínico e a rastreabilidade do acompanhamento.
6. Como profissional, quero que uma anamnese pendente de um acompanhamento cancelado não possa mais ser aberta, para que o paciente não continue operando um acompanhamento encerrado.
7. Como profissional, quero que um rascunho de anamnese não possa ser salvo após o cancelamento, para impedir alterações clínicas fora de um acompanhamento ativo.
8. Como profissional, quero que uma resposta de anamnese não possa ser submetida após o cancelamento, para que o histórico não receba novas respostas fora do ciclo de vida válido.
9. Como clínica, quero preservar respostas e notas já registradas antes do cancelamento, para não perder evidências clínicas existentes.
10. Como profissional, quero que novas solicitações de anamnese sejam rejeitadas para acompanhamentos cancelados, para evitar a criação de novos links inválidos.
11. Como clínica, quero que contratos com processo de assinatura sejam cancelados junto com o acompanhamento, para impedir assinatura posterior.
12. Como paciente, quero que tokens de assinatura de um acompanhamento cancelado sejam revogados, para que nenhum documento cancelado continue assinável.
13. Como clínica, quero preservar PDFs, revisões, eventos e snapshots dos contratos cancelados, para manter a evidência histórica.
14. Como profissional, quero que contratos ainda em geração sejam marcados como cancelados quando o acompanhamento for cancelado, para que não apareçam como pendentes operacionais.
15. Como sistema, quero que uma geração concorrente observe o cancelamento e não promova o contrato a pronto ou assinatura, para evitar uma corrida de estado.
16. Como profissional, quero que o retry de geração seja rejeitado para um acompanhamento cancelado, para que o cancelamento não seja desfeito silenciosamente.
17. Como profissional, quero que a assinatura seja rejeitada para um acompanhamento cancelado, independentemente do estado anterior do contrato, para preservar a decisão de cancelamento.
18. Como profissional, quero que o acompanhamento cancelado continue visível no histórico com seu motivo e estado, para explicar por que suas operações foram interrompidas.
19. Como profissional, quero que um novo acompanhamento da mesma oferta possa ser criado depois do cancelamento, para corrigir ou refazer uma contratação sem reutilizar o registro anterior.
20. Como clínica, quero que os testes cubram cancelamento durante geração, antes da assinatura e após documentos prontos, para garantir o comportamento em todas as janelas relevantes.
21. Como equipe de desenvolvimento, quero que os testes verifiquem comportamento observável nas fronteiras da API, para evitar uma implementação que só satisfaça detalhes internos.

## Implementation Decisions

- O seam principal será a API de integração do fluxo de acompanhamento: criação, cancelamento, consulta, solicitação/resposta de anamnese, materialização, retry e assinatura.
- A deduplicação continuará sendo definida pela identidade lógica `anamnesisId`; cada anamnese aplicada terá uma única linha por acompanhamento.
- O cancelamento preservará registros históricos e alterará somente estados operacionais que possam continuar acionáveis.
- O cancelamento de um acompanhamento deverá alcançar todos os contratos aplicados relacionados, inclusive os que ainda não possuem processo de assinatura.
- Um contrato em `generating` associado a acompanhamento cancelado deverá terminar em `cancelled`, sem criar ou iniciar processo de assinatura.
- Processos existentes deverão ser cancelados, seus tokens deverão ser revogados e os eventos de cancelamento deverão permanecer no histórico.
- Endpoints clínicos que acessam uma anamnese aplicada deverão validar o estado do acompanhamento antes de permitir leitura operacional, salvar rascunho ou submeter resposta.
- Endpoints de solicitação de anamnese, retry de materialização e assinatura deverão rejeitar operações sobre acompanhamento cancelado com o erro de estado já adotado pela API.
- Uma operação concorrente de geração não poderá reativar contrato ou acompanhamento cancelado; a transição final deverá ser protegida pela fronteira transacional e pelas condições de estado existentes.
- O cancelamento continuará liberando a identidade da oferta para uma nova contratação, sem alterar snapshots ou reabrir o acompanhamento cancelado.
- Não será criada uma exclusão física nem uma limpeza automática de anamneses, respostas, contratos, PDFs, revisões, eventos ou snapshots.

## Testing Decisions

- Os testes devem verificar efeitos externos: respostas HTTP, estados retornados, existência ou ausência de tokens operacionais e estados persistidos necessários para auditoria.
- O teste de criação deve configurar a mesma anamnese na oferta e em um procedimento, criar o acompanhamento e provar que existe exatamente uma anamnese aplicada para aquele ID.
- O teste de criação também deve configurar anamneses distintas nas fontes e provar que a união completa é preservada.
- O teste de cancelamento deve provar que o acompanhamento recebe estado cancelado, motivo e data, e que a consulta histórica ainda retorna as dependências preservadas.
- Testes clínicos devem provar que uma anamnese não respondida antes do cancelamento não pode ser lida, receber rascunho, ser submetida ou gerar nova solicitação depois dele.
- Testes clínicos devem provar que respostas e notas criadas antes do cancelamento continuam disponíveis no histórico.
- O teste de contrato com processo deve provar cancelamento do contrato, processo e tokens, preservando eventos e documentos já materializados.
- O teste de contrato em geração deve provar que o contrato não permanece em `generating`, não recebe processo de assinatura e não é promovido após a conclusão tardia do worker.
- Testes de retry e assinatura devem provar rejeição para acompanhamento cancelado.
- O teste de nova contratação deve provar que cancelar o acompanhamento anterior permite criar outro acompanhamento da mesma oferta sem duplicar ou reabrir o anterior.
- Deve ser incluído um cenário de concorrência ou uma simulação de conclusão tardia da geração para provar que o cancelamento vence a promoção operacional.
- Os testes devem seguir o padrão das suítes existentes de integração de acompanhamentos, anamneses clínicas e histórico de assinatura, usando a API como fronteira principal e o banco apenas para validar invariantes que não são expostos pela API.

## Out of Scope

- Alterar a regra de validade ou reaproveitamento de respostas de anamnese em acompanhamentos ativos.
- Alterar o conteúdo, a versão ou o schema de uma anamnese já aplicada.
- Excluir ou anonimizar dados clínicos, financeiros ou contratuais preservados.
- Alterar regras comerciais, preço, sessões ou snapshots da oferta.
- Criar uma tela nova de histórico ou redesenhar os cards de acompanhamento.
- Implementar cancelamento de contratos modelo do catálogo; o escopo é contrato aplicado ao acompanhamento.
- Alterar o fluxo de cancelamento de pagamentos já registrados.
- Reabrir, desfazer ou converter um acompanhamento cancelado em ativo.

## Further Notes

- A retenção histórica é uma decisão de domínio: cancelar encerra a operação, mas não apaga o histórico.
- “Pendente” deve distinguir informação histórica exibida de operação ainda permitida. Uma anamnese não respondida pode ser mostrada como pendência histórica, mas não pode permanecer respondível; um contrato em geração não deve permanecer nesse estado operacional depois do cancelamento.
- A implementação deve respeitar as decisões de persistência transacional, snapshots imutáveis e preservação incremental de documentos.
- Critério de aceite: todos os cenários de integração descritos ficam verdes, nenhum acompanhamento cancelado aceita nova operação clínica, de assinatura ou de geração, e uma nova contratação independente continua funcionando.
