# Evolução SaaS: cadastro, planos de assinatura e configuração

- Status: em refinamento; não autoriza execução em produção.
- Data: 2026-11-25.
- Entrega desta etapa: especificação, decisões e tarefas, não implementação.

## Requisitos confirmados

1. Eliminar `BOOTSTRAP_*` e o provisionamento automático no startup.
2. Usar `WEB_PORT` e `API_PORT`, removendo a redundância de `APP_PORT` e `VITE_PORT`.
3. Simplificar a configuração de R2, sem fontes concorrentes para o mesmo valor.
4. Oferecer cadastro de clientes, planos de assinatura do SaaS e clínicas isoladas por tenant.
5. Migrar a instalação existente sem perder dados, credenciais ou acesso aos documentos.
6. Decisão do usuário: uma conta administrativa por clínica e uma clínica por conta nesta entrega. Novos donos fazem cadastro independente; equipes, memberships, RBAC e seleção entre clínicas ficam fora do escopo.
7. Decisão do usuário: abandonar a ideia de schema por tenant. Usar estrutura compartilhada com isolamento por `tenant_id`. A intenção original de `DB_SCHEMA` não elimina seu uso atual como namespace e ledger das migrations.

## Evidências do estado atual

| Área | Fonte | Consequência |
| --- | --- | --- |
| Namespace PostgreSQL | `packages/db/src/database-config.ts`, `migrate.ts`, `packages/db/DB_SCHEMA.md` | `DB_SCHEMA` determina `search_path` e o namespace do ledger Drizzle; não representa um tenant. |
| Clínica e autenticação | `packages/db/src/auth-schema.ts` | `user.tenant_id` é obrigatório e único: atualmente existe no máximo uma conta por clínica. E-mail também é globalmente único. |
| Cadastro | `apps/api/src/auth.ts` | Better Auth está com `disableSignUp: true`; remover a flag isoladamente não implementa onboarding seguro. |
| Startup | `apps/api/src/index.ts`, `packages/db/src/seed.ts`, `apps/api/src/admin-commands.ts` | Cria tenant determinístico e pode provisionar administrador com envs. |
| Armazenamento | `apps/api/src/storage-config.ts`, `storage.ts` | Endpoint/bucket podem vir de fontes alternativas; operações e URLs assinadas usam protocolo S3. |
| Deploy | `docker-compose.yml` | Produção serve frontend estático e API no mesmo processo; não há segundo listener web. |
| Isolamento | `packages/db/src/relational-schema.ts`, `apps/api/src/auth-routes.ts` | Há `tenant_id`, FKs compostas e tenant obtido da conta autenticada. |

Consulta a issues abertas via `gh issue list`: nenhuma retornada nesta investigação. Nenhuma issue criada ou alterada. A produção não foi acessada; o schema realmente implantado e seu ledger ainda precisam ser inventariados.

## Decisões técnicas propostas

### Portas

- Desenvolvimento: `API_PORT=3000`, `WEB_PORT=5173`.
- Produção atual: listener interno em `API_PORT`; `WEB_PORT` define a porta publicada do serviço que entrega web e API. Não criar servidor separado apenas para justificar uma env.
- Proxy local deriva de `API_PORT`; manter override de destino somente se houver necessidade real de API remota/containerizada.
- Validar inteiros entre 1 e 65535; falhar claramente em colisões locais.
- Atualizar entrypoint, Compose, healthcheck, Vite, exemplos, documentação e declaração de envs do Turbo. Consultar a documentação instalada do Turbo antes de alterar sua configuração.
- Na versão final não aceitar aliases silenciosos. A tradução das envs do deploy ocorre antes do corte.
- Origins e URL pública de autenticação continuam explícitas: uma porta não determina domínio, TLS ou proxy reverso.

### R2

Recomendação: manter `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET`; derivar o endpoint e remover `R2_ENDPOINT_URL`. Account ID e bucket são endereçamento, não segredos redundantes. Um token genérico da API Cloudflare não é substituto direto das credenciais S3 usadas para URLs pré-assinadas.

Credenciais restritas ao bucket necessário, objetos privados e assinatura somente no backend. Nunca expor segredos no bundle Vite. Preservar todas as object keys existentes e os hashes dos documentos. Emulador local não é integração de produção: sua manutenção ou remoção deve ser decidida explicitamente, sem transformar fallback em produção.

### Namespace PostgreSQL

Recomendação: retirar a escolha de schema da configuração cotidiana, adotando namespace canônico `clinicare`, mas somente após uma transição verificada. Não trocar diretamente por `public`, não autodetectar por “primeiro schema com tabelas” e não criar uma instalação vazia se houver uma instalação existente em outro namespace.

Antes de remover `DB_SCHEMA`, inventariar o namespace real, extensões, tabelas, sequências, constraints e `__drizzle_migrations`. Se já for `clinicare`, preservar tudo no lugar. Se for diferente, preparar mudança explícita e ensaiada, com corte coordenado e ledger preservado; não executar mudanças de namespace por heurística no startup. Ambiguidade ou colisão bloqueia o deploy. Durante a transição, a versão antiga pode continuar recebendo `DB_SCHEMA`; a versão final deixa de depender dessa env.

Testes usam banco descartável dedicado e proteção contra alvo produtivo; não remover isolamento de testes como efeito colateral. A estratégia final deve cobrir também extensões e índices `pg_trgm`.

## Fronteiras e invariantes

- Tenant continua sendo a clínica e a fronteira dos dados operacionais.
- Identidade do usuário, vínculo com clínica e assinatura SaaS são conceitos diferentes. Cada conta pertence a uma única clínica, que tem no máximo uma conta administrativa. Preservar `user.tenant_id` obrigatório e sua unicidade; não introduzir tabela de memberships nesta entrega. Tenants legados sem conta não devem ser apagados nem reivindicados automaticamente.
- Plano de assinatura do SaaS não é o `Plano` clínico de procedimentos já existente. Não reutilizar tabelas, pagamentos ou acompanhamentos clínicos para billing SaaS.
- Nunca alterar `tenant_id` dos registros legados para “encaixar” o novo cadastro: cifra e HMAC também dependem dessa identidade.
- Preservar IDs de usuários, hashes de senha, profissionais, vínculos históricos, versões, snapshots, evidências de assinatura e referências R2.
- Tenant e permissões vêm da identidade autenticada e dos vínculos autorizados; nunca confiar em `tenant_id` fornecido pelo cliente.
- Cadastro concorrente/repetido não pode criar clínicas ou assinaturas duplicadas nem usuários sem vínculo utilizável.
- Retirar um plano do catálogo não altera contratos existentes. Atraso pode motivar pausa manual da assinatura; o sistema não infere atraso nem muda a situação por conta própria.
- Não atribuir expiração, cobrança ou bloqueio automático aos tenants existentes sem regra de transição aprovada.
- Startup não cria, renomeia, reivindica ou apaga clínicas/contas. Seeds fictícios ficam restritos a desenvolvimento/testes.
- CLI de recuperação operacional continua possível, sem credencial administrativa padrão e sem acesso clínico implícito para operador da plataforma.

## Gestão comercial manual

Confirmado: cada plano SaaS informa preço e funcionalidades incluídas. A gestão é manual, sem checkout, gateway, renovação ou suspensão automática. Modelamos ativa/pausada/inativa como situações da assinatura da clínica. Retirar um plano da oferta para novos cadastros é uma ação distinta.

O dono vê preço, periodicidade e funcionalidades antes de escolher o plano; escolher não libera acesso. Só o operador da plataforma pode atribuir/trocar o plano e alterar a situação, com registro de ator, instante e valores anterior/novo. Ações comerciais não dão acesso aos prontuários. Valores e listas comerciais devem ser configuráveis; não inventar preços de lançamento.

**Regra confirmada:** conta nova começa no plano gratuito (Free), sem precisar criar uma assinatura paga fictícia. Cada nível superior é um superconjunto estrito do anterior. O preço não decide autorização: o sistema consulta as funcionalidades do nível efetivo.

| Situação da assinatura paga | Nível efetivo | Significado |
| --- | --- | --- |
| Nunca contratou | Free | Sem histórico de cancelamento. |
| Ativa | Plano pago contratado | Funcionalidades do nível contratado, inclusive as gratuitas. |
| Pausada | Free | Vínculo pago mantido, por exemplo por atraso. Retomar restabelece o plano contratado. |
| Inativa | Free | Vínculo pago cancelado. Nova contratação não apaga o histórico do cancelamento. |

Ativar, pausar, retomar ou cancelar é decisão manual. A mudança do nível efetivo é automática na autorização, sem segunda ação do operador. Pausa ou cancelamento não tornam a conta somente leitura: operações gratuitas continuam funcionando, inclusive escritas gratuitas. Nenhuma transição apaga dados. O bloqueio administrativo `tenants.active=false` continua prevalecendo, inclusive sobre links públicos.

**Aceite de S4–S7:** testar uma funcionalidade gratuita e outra exclusiva de plano pago na UI e diretamente na API. A mesma escrita gratuita deve funcionar antes da primeira contratação, durante a pausa e após o cancelamento; a função paga deve funcionar apenas com assinatura ativa de nível suficiente. A UI distingue pausa de cancelamento mesmo quando o acesso efetivo é idêntico. Retomar uma assinatura pausada recupera o nível pago sem recriar dados. Rejeitar configuração de nível superior que omita funcionalidade do inferior. Troca de situação vale na próxima operação autorizada mesmo com sessão aberta; aplicar a mesma matriz a links públicos, jobs e emissão de URLs R2 segundo a funcionalidade correspondente. URLs pré-assinadas já emitidas continuam sujeitas à sua expiração.

## Decisões de produto em aberto

**Decisão de migração:** a única clínica em uso entra no Free, sem assinatura paga fictícia, sem mudança de ID e sem apagar dados. Validar na cópia restaurada o acesso ao histórico e listar operações em andamento antes do corte.

### Matriz inicial sugerida (distribuição ainda não aprovada)

Base: navegação em `apps/web/src/routes/_app.tsx`, rotas filhas em `_app/`, ações rápidas e rotas públicas de formulário e assinatura. Cada coluna acrescenta capacidades à anterior; “—” significa sem acréscimo.

| Superfície | Free | Standard | Pró |
| --- | --- | --- | --- |
| Visão geral | Próximas sessões, pacientes recentes | Pendências de documentos | — |
| Pacientes e atendimentos | Cadastro, busca, ficha, histórico, atendimento avulso | Fotos antes/durante/depois, campos personalizados e acompanhamentos | Indicadores de relacionamento: frequência, faltas, tempo e valores |
| Agenda | Agendar avulso, remarcar, cancelar e confirmar atendimento ou falta | Agendar sessões de combos e planos clínicos | Operar inscrições de eventos |
| Procedimentos e combos | Cadastro de procedimentos e preço avulso | Combos, sessões e formulários de sessão personalizados | — |
| Planos clínicos | — | Montar ofertas, versionar e aplicar ao paciente | — |
| Eventos | — | — | Cardápio, inscrições, baixa e financeiro do dia |
| Formulários de anamnese | Criar formulário, vincular ao avulso, responder na clínica e consultar respostas | Envio por link e reutilização nas ofertas do plano | — |
| Contratos | Consultar histórico existente | Autoria/importação DOCX, publicação, materialização, versões e aplicação | — |
| Documentos | Consultar e baixar documentos históricos autorizados | Pendências e assinatura eletrônica no app, paciente e representante | Fluxo externo GOV.BR: exportar, importar e validar |
| Financeiro clínico | Registrar pagamento avulso na ficha | Painel consolidado, pagamentos de acompanhamentos e saldos | Indicadores de relacionamento e execução financeira dos eventos |
| Configurações | Conta, senha, clínica e registro profissional | Assinatura padrão para documentos | — |

Não usar limites quantitativos ou preços inventados para diferenciar níveis. Acompanhar os fluxos também pelo dashboard, ficha, ações rápidas, menu mobile, links públicos e API. Na migração/downgrade, a proposta é liberar consulta histórica, não novas operações premium. Antes do corte identificar assinaturas, coletas e acompanhamentos já iniciados e definir como concluí-los, sem ocultar pendências nem invalidar evidências.

Perguntas serão tratadas uma por vez. Recomendações não representam aprovação do usuário.

## Migração e gates obrigatórios

1. Inventariar versão implantada, migrations aplicadas, namespace, tenants/contas (incluindo tenants sem administrador), volumes por tenant, referências R2 e versões de chaves, sem registrar PII ou segredos.
2. Fazer backup consistente do PostgreSQL, garantir preservação dos objetos R2 e disponibilidade segura das chaves atuais. Ensaiar restauração isolada antes de migrar.
3. Ensaiar em cópia representativa protegida: versão antiga → expansão → backfill → versão nova. Testar também instalação vazia e retomada após falha.
4. Aplicar estratégia expand/backfill/validate/contract. Novas estruturas são inicialmente aditivas; alterações destrutivas e remoções ficam para corte posterior. Serializar execução das migrations.
5. Backfill idempotente e auditável cria somente vínculos/assinaturas necessários. Preserva `tenant.active`; não ativa contas desativadas. Tenant sem conta exige reconciliação explícita, nunca apropriação pelo cadastro público.
6. Antes de ativar cadastro: validar integridade, isolamento entre dois tenants, login legado, leitura/descriptografia, downloads de documentos antigos e hashes dos artefatos assinados.
7. Definir janela de corte, compatibilidade entre versões e plano de rollback antes do deploy. Não permitir versão antiga escrevendo num modelo que ela não entende; pausar escrita se não houver compatibilidade comprovada.
8. Comparar contagens, conjuntos de IDs, vínculos e invariantes antes/depois. Parar diante de divergência. “Migration executou sem erro” não é critério suficiente.
9. Rollback de aplicação deve usar schema ainda compatível. Não restaurar backup por cima de novas escritas sem plano explícito de reconciliação e janela de indisponibilidade.
10. Só depois do aceite remover aliases/envs do deployment e estruturas antigas cuja remoção seja segura. Não apagar dados clínicos ou objetos R2.

## Backlog preliminar

| ID | Entrega independente | Dependências | Aceite e testes |
| --- | --- | --- | --- |
| S1 | Inventário de configuração e runbook de migração | — | Namespace/ledger reais identificados; restore isolado demonstrado; matriz antiga/nova de envs. |
| S2 | Normalizar portas e R2 | S1 | Testes de parsing, env ausente/inválida, proxy e healthcheck; smoke S3/R2 real em bucket isolado, sem simulação em produção; hashes antigos preservados. |
| S3 | Transição do namespace e remoção segura de `DB_SCHEMA` | S1 | Testar schema canônico, legado, colisão, ledger existente e recusa de instalação ambígua; testes nunca atingem produção. |
| S4 | Modelo de identidade/vínculos e planos SaaS | Decisões de produto | Migrations aditivas, constraints de unicidade e FKs; testes de backfill repetido e preservação de contas/profissionais. |
| S5 | Cadastro e onboarding transacional | S4 | Validação, proteção contra abuso, concorrência, retry e falha parcial; nenhum tenant reivindicado por ID/e-mail arbitrário. Política de verificação de e-mail e entrega real precisa estar definida antes de abrir cadastro. |
| S6 | Autorização e acesso comercial | S4, regras comerciais | Isolamento API/busca/storage/links públicos; testar tenant inativo, usuário removido e estados comerciais aprovados, sem bloquear clientes legados indevidamente. |
| S7 | Interface de cadastro/plano e remoção do bootstrap | S5, S6 | Jornada completa utilizável, erros recuperáveis, reboots sem seed produtivo e login antigo preservado. |
| S8 | Ensaio completo e liberação gradual | S2, S3, S7 | Evidências dos gates acima; rollback compatível ensaiado; sem dados ou documentos perdidos. |

Cobrança automática está fora desta entrega. Não representar ativação manual como pagamento confirmado.

## Documentos a reconciliar ao concluir o refinamento

- `CONTEXT.md`: tenant, administrador, perfis de acesso e novos termos de assinatura SaaS.
- `docs/specs/clinicas-pequenas-mvp.md`: restrições antigas de uma conta e provisionamento.
- ADR 0002: decisão histórica incompatível com autenticação já existente e evolução solicitada.
- ADR 0003: início vazio foi decisão da migração anterior, não permissão para apagar a produção atual.
- ADR 0007 registra a cardinalidade confirmada e a estrutura compartilhada entre tenants.

Equipes e RBAC continuam fora do escopo por decisão explícita do usuário.
