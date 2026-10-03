# Especificação: migração para PostgreSQL + Drizzle + JSONB

**Status:** execução concluída no corte PostgreSQL
**Data:** 2026-10-03  
**Decisão relacionada:** ADR 0003 — Persistência PostgreSQL + Drizzle + JSONB

## Problem Statement

O Clinicare evoluiu de um protótipo documental para um produto clínico-financeiro que precisa preservar histórico, controlar consumo de sessões, impedir sobreposição de agendamentos, manter pagamentos consistentes e materializar contratos, anamneses e snapshots sem efeitos retroativos.

A persistência atual em MongoDB/Mongoose não garante, por si só, a integridade necessária entre agregados. Há operações multi-entidade separadas, risco de corrida no consumo de sessões, referências sem FK, versões sujeitas a disputa entre requisições e execução em MongoDB standalone sem uma topologia adequada para transações multi-documento.

Ao mesmo tempo, o sistema depende de comportamentos documentais legítimos: JSON Schema configurável, respostas dinâmicas, snapshots históricos e documentos aplicados que precisam continuar interpretáveis depois que o catálogo mudar.

## Solution

Substituir MongoDB/Mongoose por PostgreSQL acessado via Drizzle, mantendo `jsonb` para schemas e snapshots estruturais e usando transações, FKs, `CHECK`s, unicidade, índices e locks como garantias de integridade.

A solução deve:

- manter o contrato HTTP efetivamente consumido pelo frontend, salvo mudanças explicitamente necessárias;
- preservar o R2 para fotos e documentos binários;
- criar um modelo relacional com `tenant_id` em todas as tabelas pertencentes ao tenant;
- versionar planos e congelar snapshots comerciais dos acompanhamentos;
- proteger dados pessoais e clínicos por coluna com AES-256-GCM;
- manter `full_name` em plaintext para a busca principal, limitada por tenant e indexada com `pg_trgm`;
- oferecer busca exata protegida de e-mail, telefone e CPF opcional por HMAC-SHA-256 separado;
- tornar início de acompanhamento, reserva, atendimento, assinatura e pagamento operações atômicas;
- começar com uma base PostgreSQL vazia, migrations versionadas e seed reproduzível; os dados atuais do MongoDB são apenas protótipo e não serão migrados;
- remover MongoDB/Mongoose somente depois que a suíte PostgreSQL, as migrations e o smoke test estiverem verdes.

A seam principal de testes será a API HTTP existente contra PostgreSQL real. Testes diretos de banco serão reservados para migrations, constraints e comportamentos que não sejam observáveis adequadamente pela API.

## User Stories

1. Como administrador do tenant, quero cadastrar e pesquisar pacientes por nome, para encontrar rapidamente o histórico correto.
2. Como administrador do tenant, quero pesquisar pacientes por e-mail, telefone ou CPF, para localizar um cadastro sem expor esses valores em texto aberto no banco.
3. Como administrador do tenant, quero que e-mail, telefone e CPF sejam únicos entre pacientes ativos do meu tenant, para evitar cadastros ambíguos.
4. Como administrador do tenant, quero desativar um paciente somente quando não houver operação pendente, para não abandonar acompanhamentos, contratos ou agendamentos em andamento.
5. Como administrador do tenant, quero cadastrar procedimentos com duração, preço, quantidade mínima e schema de sessão, para configurar o catálogo da clínica.
6. Como administrador do tenant, quero editar ou desativar um procedimento sem alterar acompanhamentos existentes, para preservar o histórico comercial e clínico.
7. Como administrador do tenant, quero criar e versionar formulários de anamnese, para corrigir ou restaurar um modelo sem modificar versões aplicadas anteriormente.
8. Como administrador do tenant, quero criar combos independentes com procedimentos e quantidades, para vender procedimentos agrupados sem permitir combos dentro de planos neste escopo.
9. Como administrador do tenant, quero criar planos compostos somente por procedimentos, para definir ofertas assináveis de forma simples e relacional.
10. Como administrador do tenant, quero editar um plano criando uma nova versão imutável, para que acompanhamentos ociosos e ativos continuem ligados à versão que capturaram.
11. Como administrador do tenant, quero vincular pelo menos um contrato a cada plano, para que nenhum plano seja liberado sem os documentos necessários.
12. Como administrador do tenant, quero iniciar um acompanhamento de combo, para que ele nasça ativo com snapshots comerciais próprios.
13. Como administrador do tenant, quero iniciar um acompanhamento de plano, para que ele seja criado atomicamente em estado `idle`, com itens, contratos, processos de assinatura, anamneses e snapshots materializados.
14. Como administrador do tenant, quero que um acompanhamento `idle` não reflita edições posteriores do catálogo, para que o paciente assine exatamente a oferta iniciada.
15. Como paciente, quero ler e assinar cada contrato aplicado ao meu plano, para liberar todos os procedimentos contratados.
16. Como administrador do tenant, quero ver a assinatura profissional como pendência separada, para acompanhar a documentação sem bloquear a execução liberada pela assinatura do paciente.
17. Como administrador do tenant, quero que um plano só fique ativo quando todos os contratos obrigatórios tiverem sido assinados pelo paciente, para impedir execução parcial do conjunto documental.
18. Como administrador do tenant, quero impedir uma segunda contratação da mesma oferta enquanto existir acompanhamento `idle` ou ativo do mesmo paciente, para evitar duas operações concorrentes sem sentido.
19. Como administrador do tenant, quero contratar novamente a mesma oferta depois que o acompanhamento anterior for concluído ou cancelado, para permitir recorrência legítima.
20. Como administrador do tenant, quero registrar pagamentos em acompanhamentos `idle`, ativos ou encerrados com saldo pendente, para separar liquidação financeira de execução clínica.
21. Como administrador do tenant, quero que uma repetição de requisição de pagamento não duplique o lançamento, para poder fazer retry com segurança.
22. Como administrador do tenant, quero que o sistema rejeite pagamentos que ultrapassem o preço contratado, para manter o saldo financeiro consistente.
23. Como administrador do tenant, quero criar agendamentos somente para acompanhamentos operacionais, para impedir agenda em planos ainda não assinados.
24. Como administrador do tenant, quero reservar sessões sem permitir que duas requisições consumam a mesma capacidade, para manter o calendário coerente sob concorrência.
25. Como administrador do tenant, quero cancelar ou marcar falta em um agendamento sem consumir sessão, para diferenciar reserva de atendimento realizado.
26. Como administrador do tenant, quero ver os agendamentos do dia, para saber quais compromissos estão previstos.
27. Como administrador do tenant, quero ver agendamentos cujo horário já passou e ainda aguardam confirmação, para registrar o resultado real do atendimento.
28. Como administrador do tenant, quero que todos os itens de um agendamento comecem selecionados no fluxo de confirmação, para confirmar rapidamente a realização completa.
29. Como administrador do tenant, quero desmarcar itens individualmente antes de usar “Confirmar tudo”, para registrar que apenas parte do agendamento foi realizada.
30. Como administrador do tenant, quero confirmar cada procedimento realizado em uma transação, para criar o atendimento e consumir a sessão sem estado parcial.
31. Como administrador do tenant, quero que duas requisições concorrentes tentando consumir a última sessão resultem em apenas um sucesso, para nunca ultrapassar o contratado.
32. Como administrador do tenant, quero cancelar um atendimento confirmado com motivo, para corrigir um erro operacional e devolver a sessão ao saldo.
33. Como administrador do tenant, quero que um agendamento com atendimento confirmado permaneça no histórico, para preservar o contexto do cuidado realizado.
34. Como administrador do tenant, quero cancelar um acompanhamento com motivo, para interromper sua operação sem apagar pagamentos, atendimentos, contratos ou anamneses.
35. Como administrador do tenant, quero que um acompanhamento seja concluído automaticamente quando todas as sessões forem consumidas, para liberar nova contratação da mesma oferta.
36. Como administrador do tenant, quero continuar registrando pagamentos pendentes após a conclusão clínica, para liquidar o preço sem reabrir agenda ou atendimento.
37. Como administrador do tenant, quero interpretar uma resposta histórica usando o schema snapshot aplicado, para que editar o formulário atual não quebre respostas antigas.
38. Como administrador do tenant, quero preservar respostas finais e registrar correções como notas, para impedir que o histórico clínico seja sobrescrito.
39. Como administrador do tenant, quero acessar fotos e documentos por autorização do backend, para manter os binários privados no R2.
40. Como operador autorizado, quero que logs e auditorias mostrem apenas contexto técnico e IDs, para investigar operações sem vazar dados pessoais ou clínicos.
41. Como sistema, quero rejeitar vínculos entre tenants diferentes, para impedir vazamento ou mistura de dados por erro de aplicação.
42. Como sistema, quero falhar ao descriptografar um valor movido para outro tenant, registro ou coluna, para detectar troca de ciphertext.
43. Como operador autorizado, quero que a aplicação descriptografe dados somente depois de validar identidade, tenant e permissão, para que a criptografia seja acompanhada de controle de acesso real.

## Implementation Decisions

### Persistência e tenancy

- PostgreSQL será a fonte única de verdade após o corte; não haverá dual-write como estado final.
- Drizzle será usado para schema tipado, queries e migrations versionadas.
- Todas as tabelas pertencentes ao tenant terão `tenant_id`.
- Relacionamentos críticos usarão FKs compostas que incluam `tenant_id`, evitando vínculos cruzados.
- Dinheiro será armazenado em centavos inteiros; datas operacionais usarão `timestamptz`; IDs poderão ser UUID.
- Exclusões de negócio serão soft delete ou estados explícitos. Histórico clínico, comercial, financeiro, contratual e de atendimento não será apagado automaticamente no MVP.

### Dados protegidos

- A aplicação usará AES-256-GCM por coluna, com nonce aleatório por valor e metadados de versão.
- O AAD será vinculado a `tenant_id`, tabela, registro, coluna e versão da chave.
- `DATA_ENCRYPTION_KEY` será usada somente para cifragem de dados e `SEARCH_HMAC_KEY` somente para índices HMAC; ambas virão de variáveis de ambiente seguras e não serão persistidas.
- A estrutura física será explícita por campo: ciphertext, nonce e versão da chave; campos pesquisáveis terão também hash e versão do índice.
- Dados de contato, CPF opcional, notas, respostas, rascunhos, dados clínicos, notas de atendimento e conteúdo personalizado aplicado serão protegidos.
- `full_name` permanecerá plaintext por ser a busca principal; a busca exigirá `tenant_id` e usará `pg_trgm` com GIN.
- E-mail será normalizado com `trim` e lowercase; telefone usará somente dígitos, sem inventar/remover código de país; CPF será opcional, usará somente dígitos, exigirá exatamente 11 dígitos e não terá validação de dígitos verificadores nesta fase.
- E-mail, telefone e CPF terão HMAC-SHA-256 contextualizado e unicidade separada entre pacientes ativos do mesmo tenant. Soft-deleted libera os valores para novo paciente.
- Schemas e snapshots estruturais permanecerão em `jsonb`; respostas, rascunhos e notas serão colunas protegidas inteiras.
- Binários continuarão no R2 privado com chaves opacas, hashes e autorização pelo backend; não haverá cifragem adicional pela aplicação nesta fase.
- Logs não poderão conter valores pessoais, clínicos, termos de busca, plaintext, ciphertext, nonces, hashes completos ou chaves.

### Catálogo, planos e snapshots

- Procedimentos e anamneses terão versões imutáveis; restauração criará nova versão.
- Combos existirão como ofertas independentes, sem composição em planos e sem `combo_versions` nesta etapa; o acompanhamento guardará snapshot expandido.
- Planos aceitarão somente procedimentos diretamente.
- Alterações comerciais ou documentais de plano criarão nova `plan_version`; ativar/desativar não criará versão.
- Uma `plan_version` terá itens expandidos com nome, preço, sessões, duração e schema de cada procedimento, além de contratos aplicáveis.
- O acompanhamento capturará a versão e manterá snapshots próprios, sem depender do catálogo mutável.
- Plano sem contrato aplicável será inválido.

### Máquina de estados

- Combo: inicia `active`.
- Plano: inicia `idle`; torna-se `active` quando todos os contratos obrigatórios forem assinados pelo paciente.
- `active`: permite agendamento e atendimento.
- `idle`: permite pagamentos, mas bloqueia agendamento e atendimento.
- `completed`: todas as sessões foram consumidas; permite apenas pagamentos pendentes.
- `cancelled`: encerrado explicitamente; preserva histórico e bloqueia nova execução.
- A mesma oferta não poderá ter dois acompanhamentos não encerrados para o mesmo paciente; após `completed` ou `cancelled`, uma nova contratação usará a versão corrente.
- Desativar catálogo não invalida acompanhamento ocioso já iniciado.
- Paciente só poderá ser soft-deleted sem acompanhamento não encerrado, contrato pendente ou agendamento pendente.

### Integridade e concorrência

- Início de acompanhamento materializará acompanhamento, itens, snapshots, contratos, processos de assinatura e anamneses em uma transação.
- Criação de versão bloqueará o plano/proprietário, verificará a versão esperada, usará unicidade por pai e versão e retornará conflito determinístico em disputa.
- Atendimento será fonte de verdade do consumo; o item contratado será bloqueado antes de contar consumo e inserir atendimento.
- Reserva bloqueará os itens em ordem determinística, contará reservas ativas e atendimentos válidos e inserirá agendamento/itens na mesma transação.
- Agendamento não consumirá sessão automaticamente.
- Pagamento usará idempotency key única por tenant/acompanhamento, lock do acompanhamento e verificação de limite antes da inserção.
- Pagamentos não terão conteúdo editado; poderão ser soft-deleted conforme operação permitida, com motivo/auditoria, e o schema suportará ajustes/estornos futuros.
- Submissão de anamnese será protegida por atualização condicional; resposta final será imutável e correções serão notas.
- Refresh substituirá atomicamente o hash de token anterior; tokens persistidos serão somente hashes, com expiração.
- Assinaturas serão independentes por contrato aplicado; repetição não duplicará efeitos.

### API, frontend e operações de produto

- Rotas e formatos atuais serão preservados onde não houver decisão explícita de mudança.
- A tela principal poderá incluir os widgets de assinaturas pendentes e confirmação dos agendamentos do dia, conforme issues #1 e #2.
- O fluxo de confirmação terá itens selecionados por padrão e ação “Confirmar tudo”, com desmarcação individual.
- Autenticação/autorização administrativa não será implementada nesta especificação, mas será pré-requisito para dados reais e a camada de criptografia deverá receber contexto autorizado, sem fallback anônimo.
- Migrations deverão recriar uma base vazia; seed será reproduzível; dados atuais do MongoDB serão descartados como dados de protótipo.
- MongoDB, Mongoose, MongoDB Memory Server, `MONGODB_URI` e serviços Mongo só serão removidos após a suíte PostgreSQL estar verde.

## Testing Decisions

- A seam principal será a API HTTP existente com PostgreSQL real, migrations aplicadas e tenant de teste.
- Testes devem verificar comportamento externo, respostas HTTP, efeitos persistidos, constraints, concorrência e rollback; não devem acoplar-se a detalhes internos de repositórios ou chamadas do Drizzle.
- Testes diretos de banco serão usados para provar criação de schema vazio, FKs compostas, `CHECK`s, índices únicos parciais, unicidade de versões e políticas de delete.
- Testes de catálogo devem provar round-trip de JSON Schema, imutabilidade de versões, restauração como nova versão e preservação de snapshots.
- Testes de criptografia devem provar round-trip, nonce diferente para o mesmo plaintext, falha com chave errada ou ciphertext alterado, AAD incompatível, ausência de plaintext e busca HMAC normalizada.
- Testes de segurança devem provar isolamento por tenant, unicidade somente entre pacientes ativos, liberação de valores após soft delete e autorização antes da descriptografia.
- Testes transacionais devem injetar falha no meio do início de acompanhamento e verificar zero estado parcial.
- Testes concorrentes devem executar contra PostgreSQL real: duas tentativas na última sessão, duas reservas concorrentes, duas criações da próxima versão, duas submissões do mesmo token, refresh concorrente e retries de pagamento/atendimento.
- Testes de agenda devem provar reserva sem consumo, liberação em cancelamento/falta, confirmação parcial e “Confirmar tudo”.
- Testes financeiros devem provar limite de preço, idempotência, soft delete de lançamento e pagamentos pendentes após conclusão.
- Testes de contrato devem provar todos os contratos do paciente necessários para ativar o plano, assinatura profissional não bloqueante e processos independentes por contrato.
- Testes de API existentes e testes web existentes serão preservados/adaptados como inventário de contrato; novos testes devem preferir os mesmos pontos de entrada.
- A validação final deve incluir migrations em base vazia, Compose, `/api/health`, smoke test dos fluxos críticos, typecheck, testes API/web, build e inspeção de dependências removidas.

## Out of Scope

- Implementar autenticação administrativa, RBAC ou autorização completa nesta especificação.
- Suporte efetivo a múltiplos tenants na interface; `tenant_id` e isolamento serão modelados desde já.
- Combos dentro de planos e versionamento formal de combos.
- Migração de dados atuais do MongoDB, pois são dados de protótipo descartáveis.
- Cifragem adicional de binários no R2.
- KMS, HSM, envelope encryption ou rotação operacional automatizada de chaves.
- Busca textual dentro de respostas clínicas, notas, contratos aplicados ou outros conteúdos cifrados.
- Validação de dígitos verificadores de CPF.
- Retenção automática, anonimização automática ou purge automático de histórico.
- Regras jurídicas definitivas da assinatura eletrônica além do fluxo de domínio definido.
- Alterações de produto não relacionadas à persistência, agenda do dia, assinaturas pendentes e integridade dos fluxos.

## Further Notes

- As issues #1 e #2 devem ser consideradas parte do corte de produto: área de assinaturas pendentes e confirmação dos atendimentos agendados do dia.
- A decisão arquitetural está registrada no ADR 0003; o ADR 0001 foi marcado como substituído. O ADR 0002 continua válido para o protótipo: autenticação fica para tarefa posterior e dados reais não devem ser usados antes dela.
- O plano de execução é incremental: baseline, schema/migrations, infraestrutura, persistência por agregado, concorrência/idempotência, adaptação da API/frontend, remoção do Mongo e documentação final.
- Não manter dual-write como estado final.
- O trabalho só estará pronto quando migrations recriarem a base do zero, invariantes tiverem provas automatizadas, os comportamentos documentais forem preservados e nenhum uso ativo de Mongoose/MongoDB/MONGODB_URI permanecer.
- A estimativa registrada para a troca é de aproximadamente 16–28 dias de trabalho, sujeita ao número real de rotas e à complexidade da assinatura.
