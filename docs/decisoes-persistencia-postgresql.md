# Decisão e plano: PostgreSQL + Drizzle + JSONB

Data: 2026-10-03  
Status: decisão confirmada e implementada no corte PostgreSQL.

## 1. Conclusão

O Clinicare deve ser tratado como produto clínico-financeiro confiável. A persistência escolhida é **PostgreSQL + Drizzle + JSONB**, substituindo a persistência documental anterior.

A alternativa documental poderia continuar sendo usada, mas exigiria replica set, transações multi-documento, retries, write concern, versionamento otimista, integridade referencial integralmente aplicada pela aplicação e testes concorrentes. PostgreSQL reduz esse risco com FKs, constraints, unicidade, locks e transações nativas, sem perder dados documentais: schemas e snapshots continuam em `jsonb`, e conteúdo clínico dinâmico será protegido por coluna.

Critérios que poderiam reabrir a decisão: mudança para um domínio predominantemente documental, remoção das exigências de integridade multi-entidade, ou evidência operacional de que a carga documental supera materialmente a necessidade de consistência relacional.

## 2. Decisões de domínio confirmadas

- Um tenant é a fronteira de isolamento; todas as tabelas pertencentes ao tenant carregam `tenant_id`.
- Nome do paciente fica em plaintext para a busca principal. A busca filtra por tenant e usará `pg_trgm`/GIN, sem coluna duplicada normalizada nesta fase.
- E-mail, telefone, CPF opcional, notas, respostas, rascunhos, dados e notas clínicas serão protegidos por coluna.
- Criptografia de aplicação: AES-256-GCM, nonce aleatório por valor, AAD com `tenant_id`, tabela, registro, coluna e `key_version`; chaves distintas em `DATA_ENCRYPTION_KEY` e `SEARCH_HMAC_KEY`, fornecidas por ambiente e versionadas nos dados.
- Busca exata protegida: e-mail (`trim` + lowercase), telefone (somente dígitos, sem alterar código de país) e CPF opcional (somente dígitos, exatamente 11, sem validar dígitos verificadores nesta fase). HMAC-SHA-256 contextualizado por tenant/tabela/campo/versão/valor.
- E-mail, telefone e CPF são únicos separadamente entre pacientes ativos dentro do tenant. Soft-deleted libera os valores para novo cadastro.
- Schemas e `schema_snapshot` permanecem em `jsonb`; respostas, rascunhos e notas ficam em colunas cifradas inteiras.
- Binários continuam no R2 privado, com object keys opacas, hashes e acesso autorizado pelo backend; não há cifragem adicional de binários na aplicação nesta fase.
- Logs não contêm dados pessoais, clínicos, termos de busca, plaintext, ciphertext, nonce, HMAC completo ou chaves.
- Dados atuais do Mongo são somente protótipo e serão descartados; não haverá ETL.
- Retenção clínica, contratual, financeira e de atendimentos é conservadora: sem exclusão/anonimização automática no MVP.

## 3. Modelo de domínio e estados

### Catálogo

- `procedures`: catálogo mutável; desativação não afeta histórico.
- `procedure_versions`: schemas imutáveis de formulário de sessão.
- `anamneses` e `anamnesis_versions`: modelos e versões imutáveis; rollback cria nova versão.
- `combos` e `combo_items`: ofertas independentes; não compõem planos nesta fase; sem `combo_versions`.
- `plans`, `plan_versions` e `plan_version_items`: planos aceitam somente procedimentos; toda mudança comercial/documental relevante cria nova versão. Ativar/desativar não cria versão.
- `contracts` e `contract_versions`: modelos versionados; contrato padrão e contratos específicos de procedimento podem ser aplicados a planos.

### Acompanhamento

- Um acompanhamento captura uma versão de plano ou snapshot expandido de combo.
- `idle`: plano iniciado, dependências materializadas, aguardando assinaturas do paciente.
- `active`: combo iniciado ou plano com todos os contratos obrigatórios assinados pelo paciente.
- `cancelled`: encerrado por ação explícita.
- `completed`: todas as sessões consumidas.
- A mesma oferta não pode ter dois acompanhamentos não encerrados para o mesmo paciente; após conclusão/cancelamento, nova contratação é permitida.
- Desativar catálogo não cancela acompanhamento ocioso já iniciado.
- Acompanhamento ocioso pode receber pagamentos, mas não agendar ou atender.
- Acompanhamento encerrado não aceita novos agendamentos/atendimentos, mas pode receber pagamentos pendentes até atingir o preço contratado.

### Assinatura

- Somente planos têm contratos no escopo atual.
- Cada contrato aplicado tem processo próprio.
- Todos os contratos obrigatórios precisam ser assinados pelo paciente para o plano ficar ativo.
- Assinatura do representante da clínica pode ficar pendente sem bloquear operação.

### Agenda e execução

- Reserva de sessão não é consumo.
- Atendimento realizado é a fonte de verdade do consumo.
- Agendamento pode conter vários itens; todos começam selecionados na confirmação. “Confirmar tudo” é a ação principal, mas itens podem ser desmarcados.
- Cada item realizado gera atendimento próprio e consome uma sessão.
- Falta/cancelamento não consome.
- Atendimento confirmado pode ser cancelado com motivo, preservando histórico e devolvendo sessão.
- Agendamento sem atendimento pode ser cancelado/ocultado; agendamento com atendimento permanece preservado.

## 4. Blueprint relacional inicial

Todas as tabelas de negócio têm `tenant_id`, timestamps e política de soft delete quando aplicável. IDs podem ser UUID. Dinheiro usa centavos inteiros; datas operacionais usam `timestamptz`.

### Catálogo e versões

- `tenants(id, name, created_at, updated_at)`
- `patients(id, tenant_id FK, full_name, phone_ciphertext, phone_nonce, phone_key_version, phone_search_hash, phone_search_version, email_ciphertext, email_nonce, email_key_version, email_search_hash, email_search_version, cpf_ciphertext, cpf_nonce, cpf_key_version, cpf_search_hash, cpf_search_version, notes_ciphertext, notes_nonce, notes_key_version, deleted_at, created_at, updated_at)`
- `procedures(id, tenant_id FK, name, description, base_sessions, duration_minutes, price_cents, active, require_new_anamnesis, session_schema jsonb, deleted_at, created_at, updated_at)`
- `procedure_versions(id, tenant_id FK, procedure_id FK, version, session_schema jsonb, created_at, UNIQUE(tenant_id, procedure_id, version))`
- `anamneses(id, tenant_id FK, title, active, required_by_default, validity_months, deleted_at, created_at, updated_at)`
- `anamnesis_versions(id, tenant_id FK, anamnesis_id FK, version, schema jsonb, origin, restored_from_version, created_at, UNIQUE(tenant_id, anamnesis_id, version))`
- `procedure_anamneses(tenant_id, procedure_id, anamnesis_id, required, PRIMARY KEY(tenant_id, procedure_id, anamnesis_id))`
- `combos(id, tenant_id FK, name, description, price_cents, promotional_price_cents, valid_from, valid_until, active, require_new_anamnesis, deleted_at, created_at, updated_at)`
- `combo_items(id, tenant_id FK, combo_id FK, procedure_id FK, sessions, price_override_cents, ...)`
- `plans(id, tenant_id FK, name, description, active, current_version_id, deleted_at, created_at, updated_at)`
- `plan_versions(id, tenant_id FK, plan_id FK, version, price_cents, duration_days, validity_days, require_new_anamnesis, created_at, UNIQUE(tenant_id, plan_id, version))`
- `plan_version_items(id, tenant_id FK, plan_version_id FK, procedure_id FK, procedure_name_snapshot, sessions_total, duration_minutes_snapshot, price_cents_snapshot, session_schema jsonb, ...)`
- `contracts(id, tenant_id FK, title, kind, procedure_id nullable FK, active, deleted_at, created_at, updated_at)`
- `contract_versions(id, tenant_id FK, contract_id FK, version, content, source_object_key, origin, restored_from_version, created_at, UNIQUE(tenant_id, contract_id, version))`
- `plan_version_contracts(tenant_id, plan_version_id, contract_id/version reference, required, PRIMARY KEY(...))`

`contract_versions.content` pode permanecer legível enquanto for modelo genérico; conteúdo personalizado de contrato aplicado será cifrado.

### Execução, financeiro e documentos

- `followups(id, tenant_id, patient_id, offer_type, offer_id, plan_version_id nullable, status, offer_name_snapshot, price_cents, valid_until, cancellation_reason, completed_at, cancelled_at, created_at, updated_at)`
- `followup_items(id, tenant_id, followup_id, procedure_id nullable, procedure_name, sessions_total, duration_minutes, price_cents, session_schema jsonb, sessions metadata, ...)`
- `followup_contracts(id, tenant_id, followup_id, contract_id/version references, title_snapshot, version, content_ciphertext, nonce, key_version, source_object_key, patient_signed_at, professional_signed_at, status, ...)`
- `signature_processes(id, tenant_id, followup_contract_id, status, ...)`
- `signature_attempts(...)` and `signature_events(...)` for idempotency, revisions and audit
- `patient_anamneses(id, tenant_id, patient_id, followup_id, anamnesis_id/version refs, schema_snapshot jsonb, required, ...)`
- `anamnesis_requests(id, tenant_id, patient_anamnesis_id, token_hash unique within tenant, expires_at, submitted_at, draft_ciphertext, nonce, key_version, ...)`
- `anamnesis_responses(id, tenant_id, patient_anamnesis_id, answers_ciphertext, nonce, key_version, submitted_at, valid_until)`
- `response_notes(id, tenant_id, response_id, content_ciphertext, nonce, key_version, created_at)`
- `payments(id, tenant_id, followup_id, amount_cents, method, installments, received_at, notes_ciphertext, idempotency_key, deleted_at, correction_of_id, created_at, UNIQUE(tenant_id, followup_id, idempotency_key))`
- `appointments(id, tenant_id, patient_id, starts_at, ends_at, status, notes_ciphertext, deleted_at, created_at, updated_at)`
- `appointment_items(id, tenant_id, appointment_id, followup_item_id nullable, procedure_id, procedure_name, quantity, minutes_each, confirmation_status, ...)`
- `attendances(id, tenant_id, patient_id, followup_id, followup_item_id, appointment_id nullable, procedure_id, procedure_name, performed_at, duration_minutes, data_ciphertext, nonce, key_version, schema_snapshot jsonb, notes_ciphertext, status, cancellation_reason, created_at, updated_at)`
- `attendance_photos(id, tenant_id, attendance_id, object_key, content_hash, phase, notes_ciphertext, deleted_at, created_at)`

### Constraints e índices principais

- FKs compostas com tenant nos vínculos críticos.
- `CHECK` para preços não negativos, quantidades/durações positivas e `ends_at > starts_at`.
- Índices únicos parciais de pacientes ativos: `(tenant_id, email_search_hash)`, `(tenant_id, phone_search_hash)`, `(tenant_id, cpf_search_hash)` com `WHERE deleted_at IS NULL`.
- `pg_trgm` + GIN em `patients.full_name`; toda consulta filtra `tenant_id`.
- `attendances(tenant_id, followup_item_id)`; `appointment_items(tenant_id, followup_item_id)`; `appointments(tenant_id, status, starts_at)`.
- `payments(tenant_id, followup_id, idempotency_key)` único.
- `UNIQUE` por pai e versão em todas as sequências versionadas.
- Checks impedem colunas criptográficas parcialmente preenchidas.
- Índices deliberados para histórico por paciente, agenda, pagamentos, respostas e contratos pendentes.

## 5. Matriz de invariantes

| Invariante | Mecanismo no banco | Aplicação/transação | Teste |
|---|---|---|---|
| Sessões não excedem o contratado | FK, checks e índices de item | lock de `followup_items`; conta atendimentos válidos | duas requisições na última sessão: uma vence |
| Atendimento + consumo são atômicos | FK | transação com lock do item e insert | falha injetada deixa zero efeito parcial |
| Início de acompanhamento é atômico | FKs e constraints | transação cria followup, itens, contratos, assinaturas e anamneses | rollback no meio deixa zero dependência |
| Versão é única e imutável | `UNIQUE(tenant_id,parent_id,version)` | lock do pai, expected version e retry | duas criações concorrentes |
| Uma submissão por solicitação | estado/constraint e update condicional | `UPDATE ... WHERE submitted_at IS NULL` | dois submits simultâneos: um sucesso |
| Refresh invalida token anterior | hash único e update atômico | substitui token/hash e expiração em transação | token antigo falha |
| Resposta final não é sobrescrita | modelo separado e operação append-only | notas/correções separadas | edição final rejeitada |
| FKs históricas não ficam órfãs | FKs, RESTRICT/CASCADE explícitos | soft delete e snapshots | tentativa de FK inexistente falha |
| Catálogo não altera histórico | snapshots e versões | captura na aplicação transacional | editar catálogo não muda followup |
| Item de combo aponta procedimento | FK composta | validação e checks | FK inexistente falha |
| Agenda e atendimento pertencem ao paciente | FKs compostas | validação no comando | paciente divergente falha |
| Pagamento aponta followup e não sobrepaga | FK + lock do followup | soma sob lock e idempotência | concorrência no limite |
| Intervalos/preços/quantidades válidos | `CHECK` | validação de payload | inserts inválidos falham |
| Tokens são hashes e opacos | unique hash; sem token em banco | token aleatório, hash somente | plaintext não aparece |
| Isolamento de tenant | `tenant_id` + FKs compostas | contexto autorizado em cada query | dados cruzados falham |
| Campos protegidos não ficam plaintext | tipos/estrutura e serviço central | cifragem antes de persistir | inspeção do banco e round-trip |

## 6. Fronteiras transacionais

- **Nova versão:** lock do pai → verifica `expectedVersion` → calcula próximo número → insere versão/itens → atualiza corrente → commit; conflito retorna `409`.
- **Novo acompanhamento:** resolve e materializa snapshot → transação cria todos os dependentes → commit; falha retorna erro sem estado parcial.
- **Reserva:** normaliza IDs de itens → locks determinísticos → soma reservas ativas menos atendimentos → insere appointment/items → commit; falta de capacidade retorna `409`.
- **Atendimento:** lock do item → valida status do acompanhamento e saldo → insere attendance → commit; conflito retorna `409`.
- **Confirmação do dia:** lock/valida cada item → cria atendimentos para selecionados → atualiza confirmação; operação idempotente.
- **Anamnese:** lock lógico/conditional update → primeira submissão grava payload cifrado e `submitted_at`; repetição retorna `409`.
- **Pagamento:** lock do followup → busca idempotency key → verifica saldo → insere lançamento → commit; retry retorna resultado anterior.
- **Assinatura:** lock do processo/contrato → valida tentativa e revisão → grava evento/revisão/estado; ao completar contratos do followup, muda `idle` para `active` atomicamente.
- **Cancelamento:** lock do agregado → valida dependências → cancela reservas/operações permitidas → registra motivo → commit.

## 7. Reaproveitamento do Git

### Reaproveitar/adaptar de `9cf3ada`

- tabelas relacionais e migrations iniciais como referência estrutural;
- `jsonb` para schemas, respostas e snapshots estruturais;
- FKs, checks, índices e unique de versões;
- Drizzle e organização de pacote;
- testes de API e web como inventário de contrato HTTP;
- cálculos de relacionamento e regras de catálogo, após revisão contra o domínio atual.

### Obsoleto ou insuficiente

- nomes antigos `packages`, `plans` sem `followup`/assinatura atual;
- FKs poliméricas `offer_type + offer_id` para plano;
- ausência de tenant e proteção por coluna;
- sessions sem estado/cancelamento e sem concorrência comprovada;
- modelo que não contém assinatura por contrato;
- migrations que não cobrem estados idle/active/completed/cancelled;
- schema antigo incompatível com planos somente de procedimentos e combos independentes.

### Reprojetar

- plano versionado e expandido;
- snapshots de followup/combo;
- assinatura, revisões e pendências;
- soft delete e retenção;
- criptografia e blind indexes;
- confirmações de agenda e consumo atômico;
- tenant em todas as tabelas.

## 8. Plano de corte

1. Baseline: testes, typecheck, build, contratos consumidos pelo frontend, inventário de dados; não migrar dados de protótipo.
2. Criar pacote PostgreSQL/Drizzle, schema tipado, migrations do zero, seed e serviço de cifragem.
3. Criar testes vermelhos de concorrência, rollback, constraints, idempotência e round-trip criptográfico.
4. Substituir Compose/dev infra por PostgreSQL; healthcheck e fluxo explícito de migrations.
5. Implementar persistência por agregado/fluxo, começando por catálogo, pacientes, planos/versionamento e acompanhamento.
6. Implementar assinatura por contrato e estados idle/active.
7. Implementar agenda/reservas/confirmação do dia e atendimentos transacionais.
8. Implementar pagamentos idempotentes e relacionamento/histórico.
9. Preservar R2 e adaptar metadados para PostgreSQL.
10. Atualizar API mantendo contratos HTTP onde não houver decisão explícita; ajustar frontend para assinatura pendente e confirmação do dia.
11. Rodar migrations em base vazia, seed, Compose completo e smoke test.
12. Remover a persistência documental anterior, mantendo PostgreSQL real com migrations, `DATABASE_URL`, serviço PostgreSQL e código morto fora do corte. Não manter dual-write como estado final.

## 9. Estimativa revisada e riscos

A estimativa é de uma troca de persistência em etapas, não de uma simples conversão de schemas:

- **Baseline e schema/migrations:** 1–2 dias;
- **infraestrutura PostgreSQL, seed e pacote Drizzle:** 1–2 dias;
- **catálogo, versionamento, snapshots e pacientes protegidos:** 3–5 dias;
- **acompanhamentos, anamneses, contratos e assinatura:** 4–6 dias;
- **agenda, reservas, confirmação do dia e atendimentos concorrentes:** 3–5 dias;
- **pagamentos, histórico, arquivos e adaptação do frontend:** 2–4 dias;
- **testes concorrentes, smoke test, documentação e remoção do Mongo:** 2–4 dias.

Estimativa total: **16–28 dias de trabalho**, sujeita à complexidade real do fluxo de assinatura e ao número de rotas que precisarão preservar compatibilidade. O maior risco técnico é a quantidade de comportamento hoje concentrada em `apps/api/src/app.ts`; o maior risco de produto é a autenticação/autorização ainda estar pendente antes de dados reais. O custo operacional favorece PostgreSQL gerenciado ou uma instância PostgreSQL simples no MVP; alta disponibilidade continua sendo uma decisão separada e não é presumida por esta escolha.

Critérios de reestimativa: divergência relevante entre os contratos HTTP usados pelo frontend e a API atual, necessidade de preservar dados não fictícios, assinatura com requisitos probatórios além do especificado, ou suporte multi-tenant efetivo no primeiro corte.

## 10. Go/no-go para implementação

Só iniciar implementação quando todos forem verdadeiros:

- [x] PostgreSQL + Drizzle + JSONB confirmado.
- [x] Planos somente com procedimentos confirmado.
- [x] Planos versionados e snapshots expandidos confirmados.
- [x] Acompanhamento idle/active/completed/cancelled confirmado.
- [x] Assinatura do paciente obrigatória; assinatura profissional não bloqueante.
- [x] Combos independentes com snapshot, sem combo dentro de plano.
- [x] Consumo baseado em attendances e locks confirmado.
- [x] Reservas concorrentes confirmadas.
- [x] Pagamento sem sobrepagamento e idempotente confirmado.
- [x] `full_name` plaintext e busca por tenant confirmados.
- [x] AES-GCM por coluna, AAD, chaves em ambiente e HMAC de busca confirmados.
- [x] CPF opcional, 11 dígitos sem validação de dígitos verificadores confirmado.
- [x] Soft delete e retenção histórica confirmados.
- [x] Dados atuais descartáveis confirmado.
- [ ] Autorização explícita de implementação.
