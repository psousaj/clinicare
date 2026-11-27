# Inventário e ensaio de recuperação para a migração SaaS

Este runbook prepara e verifica a recuperação antes de qualquer migração. Ele
não é autorização para acessar produção, parar serviços, aplicar migrations ou
restaurar dados sobre uma instalação existente. O ensaio sempre restaura em
outro database vazio no mesmo servidor PostgreSQL local; não usa `--clean`,
`DROP`, `reset`, `db:reset` ou seed como migração.

## Situação histórica registrada na base da Task #50

- O registro abaixo descreve o estado observado no checkout
  `d88c8876dda77a164b6671cd2ce0bdb5c62d7859` (base de #45), não o estado atual
  após a Task #62. Para evidências posteriores, consulte “Evidência #62”.
- A imagem local `clinicare-app:latest` existe, mas não há container Clinicare
  de aplicação em execução naquele registro; portanto ela não comprovava a
  versão implantada.
- Naquele momento, `.env` apontava para `localhost:5432/clinicare`, porém a
  porta 5432 pertencia a `photopulse-postgres`, não ao PostgreSQL Clinicare.
  Esse endpoint não foi usado naquele ensaio.
- O banco descartável do ensaio foi iniciado isoladamente em `localhost:55432`
  com volume próprio. Schema e ledger foram criados a partir das migrations
  deste checkout. É um banco local de teste, não a instalação Clinicare de
  produção nem evidência da versão implantada.
- Naquele momento, `CLOUDFLARE_ACCOUNT_ID` e `R2_BUCKET` estavam configurados
  localmente, mas as credenciais S3 não estavam disponíveis; o MiniStack local
  não permitia inventariar os objetos de produção. A verificação posterior do
  bucket está registrada na Evidência #62. Nenhuma chave de proteção/HMAC ou
  segredo é registrado neste documento.
- Namespace e ledger do alvo de produção, versão implantada, extensões,
  permissões/roles, dependências de objetos, referências R2 e disponibilidade
  segura das chaves de dados permanecem **a confirmar com o responsável pelo
  ambiente antes do corte**. Não inferir esses dados do `.env`, de uma imagem
  local ou de nomes de volumes.

## Inventário pré-corte — coletar sem PII

1. Identificar o endpoint e database pelo inventário oficial da plataforma.
   Confirmar a identidade do servidor e do database com o responsável; não usar
   um túnel para produção no ensaio local.
2. Registrar o digest da imagem efetivamente implantada, commit/release
   correspondente, versão do PostgreSQL e janela de manutenção. Não registrar
   connection strings ou valores de segredos.
3. Consultar, em sessão somente leitura, os itens abaixo e guardar apenas os
   resultados não sensíveis:

   ```sql
   SELECT current_database(), current_schema(), current_setting('server_version');
   SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;
   SELECT schemaname, tablename FROM pg_tables
     WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'
     ORDER BY schemaname, tablename;
   SELECT extname, n.nspname AS extension_schema
     FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     ORDER BY extname;
   SELECT schemaname, tablename, indexname FROM pg_indexes
     WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'
     ORDER BY schemaname, tablename, indexname;
   SELECT table_schema, table_name, column_name
     FROM information_schema.columns
     WHERE column_name LIKE '%object_key' OR column_name LIKE '%hash'
     ORDER BY table_schema, table_name, ordinal_position;
   \set confirmed_schema clinicare
   SELECT format(
     'SELECT created_at, hash FROM %I.__drizzle_migrations ORDER BY created_at, id',
     :'confirmed_schema'
   ) \gexec
   ```

   Substitua `<schema confirmado>` manualmente após identificar o namespace; não
   escolher automaticamente o primeiro schema que contenha tabelas.
4. Inventariar roles/grants e owners com `information_schema.role_table_grants`,
   `pg_namespace.nspacl`, `pg_class.relacl` e `pg_class.relowner`; sequências e
   seu `last_value/is_called`; constraints/FKs com `pg_get_constraintdef` e
   `convalidated`; extensões com versão/schema; objetos R2 (keys e hashes, sem
   baixar nem imprimir conteúdo) e versões das chaves necessárias por canal
   operacional seguro. Backup de globals pode
   conter hashes de credenciais: criptografar, restringir acesso e nunca anexar
   a logs ou commits. Não imprimir PII, SQL dump, tokens ou material de chave.
   Para storage, extrair da base somente referências `(tabela, coluna, contagem,
   hash persistido)` de colunas `*_object_key`/`*_hash`; reconciliar em ambiente
   restrito com inventário R2 autorizado (key, tamanho e SHA-256 comprovado do
   conteúdo). ETags isolados não provam SHA-256, especialmente em multipart.
   Armazenar o manifesto completo com acesso restrito; no relatório, registrar
   apenas contagens, divergências e fingerprint SHA-256 do manifesto. Nunca
   registrar chaves de objetos, nomes de pacientes ou conteúdo.
5. Comparar contagens e conjuntos de IDs por tabela usando ferramenta aprovada
   de inventário. Guardar contagens e fingerprints SHA-256, nunca valores de
   campos pessoais. O ensaio abaixo calcula hash de todas as colunas serializadas
   de cada linha sem retornar o conteúdo ao processo Bun; IDs e relações
   referenciais estão incluídos nos dados e nas definições/estado das constraints.
   Divergência, schema desconhecido, ledger inesperado ou chave ausente interrompe
   o corte.

## Ensaio local de backup e restore

O comando `@clinicare/db db:recovery-rehearsal` usa `pg_dump` e `pg_restore`
instalados no host. Ele falha fechado se a origem não for loopback e database
`clinicare`, se destino não estiver no mesmo servidor e começar com
`clinicare_restore_`, se o destino não estiver vazio (incluindo extensões), ou
se o arquivo de backup já existir. A restauração nunca sobrescreve nem mescla
dados.

1. Inicie um PostgreSQL descartável com volume próprio e porta livre. Não
   reutilize volume desconhecido nem altere containers alheios. Confirme
   novamente a porta e a identidade do servidor antes de cada execução: a
   evidência histórica da Task #50 usou 55432, enquanto a Task #62 confirmou o
   PostgreSQL local Clinicare em 5432. Não reutilize endpoints de evidências
   anteriores sem nova verificação.
2. Aplique migrations somente ao database descartável e use fixture sintética
   não identificável apenas para provar preservação de linhas e relações.
3. Crie um database vazio `clinicare_restore_<identificador>` no mesmo servidor,
   sem tabelas nem extensões preexistentes.
4. Configure as variáveis abaixo de forma segura. Não coloque URLs no histórico
   do shell nem habilite tracing (`set -x`):

   ```sh
   export RECOVERY_SOURCE_DATABASE_URL='postgresql://...@127.0.0.1:<porta-confirmada>/clinicare'
   export RECOVERY_TARGET_DATABASE_URL='postgresql://...@127.0.0.1:<porta-confirmada>/clinicare_restore_<identificador>'
   export RECOVERY_BACKUP_FILE='/caminho/seguro/clinicare-<identificador>.dump'
   export RECOVERY_SCHEMA=clinicare
   # Se o ledger Drizzle estiver em outro namespace, informe-o explicitamente.
   export RECOVERY_MIGRATIONS_SCHEMA=clinicare
   bun run --cwd packages/db db:recovery-rehearsal
   ```

   Não use a URL de `.env` sem confirmar o endpoint. O guard de loopback reduz
   risco de alvo remoto acidental, mas não detecta um túnel encaminhado para
   produção; nunca execute o ensaio através de túnel.
5. `RECOVERY_MIGRATIONS_SCHEMA` é opcional e, se omitido, usa o valor de
   `RECOVERY_SCHEMA` (configuração atual do repositório: runtime e migrations
   compartilham o namespace retornado por `getDatabaseSchema()`). Informe o
   namespace distinto apenas se o inventário confirmado mostrar ledger separado.
   O comando cria archive custom com ACLs (`pg_dump --format=custom --no-owner`),
   restaura no destino vazio preservando grants com `pg_restore --exit-on-error
   --no-owner` e compara SHA-256 das linhas e do catálogo no schema selecionado:
   constraints/FKs e validação, índices, owners/ACLs, grants, extensões e estado
   das sequências. A saída contém somente nomes de database/schema, contagens e
   fingerprint agregado; não imprime linhas nem dados pessoais. Guarde o archive
   com permissões restritas e retenção aprovada.
6. O ledger de migration está incluído na reconciliação de linhas, mas confirme
   também a versão esperada com o responsável pela aplicação. Compare objetos R2
   por inventário somente leitura separado: cruze referências de object-key e
   hashes persistidos com o inventário de keys/hash do bucket, emitindo apenas
   contagens e fingerprint de manifesto. Um dump PostgreSQL não contém os objetos
   nem as chaves de aplicação.
7. Registre data, versão da ferramenta, duração, exit status, contagens e
   fingerprints agregados. Não registre PII/segredos. Remova fixtures e recursos
   descartáveis somente após guardar evidência não sensível; nunca remova volume
   cujo conteúdo/propriedade não foi confirmado.

### Evidência histórica do ensaio inicial (#50)

- Source descartável: PostgreSQL 17, `clinicare` / schema `clinicare`, migrations
  do checkout; container e volume exclusivos do ensaio, porta 55432.
- Restore: database novo `clinicare_restore_acceptance_1795662700` no mesmo servidor.
- `pg_dump` custom e `pg_restore --exit-on-error` terminaram com sucesso.
- Reconciliação: 56 tabelas, 37 linhas; fingerprints SHA-256 de dados e catálogo
  source/restore coincidiram
  (`d37ec58b5331e73a25a1c0ede0a3e9d78d9d22ce13b74163a1809e3be406d904`),
  incluindo 67 componentes verificados (dados por tabela, catálogo, grants,
  extensões e estado/definição de sequência).
- A fixture foi sintética e não contém PII. Esta evidência prova o procedimento
  técnico em banco descartável; não prova a recuperação de backup real, a
  identificação da produção, nem a presença de objetos R2/chaves em produção.

## Rollback e critérios de parada

- A partir da migration `0036_remove_legacy_user_tenant`, a versão anterior da
  aplicação não é diretamente compatível porque esperava `user.tenant_id` e
  unicidades globais antigas. Antes de reverter, pare todos os escritores e
  confirme que a versão anterior consegue representar cada conta: cada usuário
  deve ter no máximo um vínculo `admin`, cada clínica no máximo um administrador
  e cada usuário no máximo um profissional. Caso contrário, o rollback ao binário
  anterior é impossível sem resolver a incompatibilidade; não descarte vínculos.
  Após backup consistente e validação, execute a transição reversa em transação:

  ```sql
  BEGIN;
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM user_tenant_memberships
      GROUP BY user_id HAVING count(*) > 1
    ) OR EXISTS (
      SELECT 1 FROM user_tenant_memberships
      WHERE role <> 'admin'
    ) OR EXISTS (
      SELECT 1 FROM user_tenant_memberships
      GROUP BY tenant_id HAVING count(*) > 1
    ) OR EXISTS (
      SELECT 1 FROM professionals
      GROUP BY user_id HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'The prior application cannot represent current memberships/professionals.';
    END IF;
  END
  $$;
  ALTER TABLE "user" ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  UPDATE "user" u SET tenant_id = m.tenant_id
    FROM user_tenant_memberships m WHERE m.user_id = u.id;
  ALTER TABLE "user" ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE "user" ADD CONSTRAINT user_tenant_id_unique UNIQUE (tenant_id);
  ALTER TABLE professionals
    ADD CONSTRAINT professionals_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id);
  ALTER TABLE professionals ADD CONSTRAINT professionals_user_id_key UNIQUE (user_id);
  CREATE OR REPLACE FUNCTION sync_legacy_user_tenant_membership()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
    VALUES (NEW.id, NEW.tenant_id, 'admin')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
    RETURN NEW;
  END
  $$;
  CREATE TRIGGER user_tenant_memberships_legacy_sync
    AFTER INSERT OR UPDATE OF tenant_id ON "user"
    FOR EACH ROW EXECUTE FUNCTION sync_legacy_user_tenant_membership();
  COMMIT;
  ```

  Em caso de erro, faça `ROLLBACK`; nunca reabra o binário anterior com schema
  parcialmente revertido. Após restaurar compatibilidade, migre novas escritas
  de modo reconciliado; nunca aplique backup por cima delas.
- `db:migrate-namespace <schema-confirmado>` é uma operação manual e explícita.
  Use somente após inventário/backup e confirmação do responsável; a operação
  renomeia atomicamente o schema legado para `clinicare`, preservando os objetos
  no PostgreSQL. Falha se faltar tabela/ledger ou se o nome canônico estiver
  ocupado. Não executa transferência entre databases/servidores nem concede
  permissões; confira owners, ACLs e extensões no inventário e pare se divergirem.
- Runtime/migrator recusam schema não canônico, candidatos múltiplos, instalação
  incompleta e objetos desconhecidos no alvo canônico. Instalação nova só pode
  iniciar quando não existe schema de aplicação/ledger concorrente.
- Antes do corte, registrar backup consistente, restore verificado, versão da
  aplicação, migrations/ledger, schema, roles/grants e disponibilidade das
  chaves. Parar escritores (API, jobs e réplicas) durante a janela autorizada.
- Não executar migrations enquanto houver divergência de contagens/IDs/FKs,
  checksum, namespace, ledger, extensão, grants, objetos R2 ou chaves.
- Não editar migrations históricas aplicadas e não usar reset/drop-recreate.
- Rollback de aplicação só é permitido enquanto o schema permanecer compatível
  com a versão anterior. Após novas escritas incompatíveis, parar e reconciliar;
  não restaurar backup por cima dessas escritas.
- Só reabrir após validação de login, autorização/tenant, decrypt, documentos
  históricos, objetos R2/hashes e smoke da aplicação.
- Registro real de produção, association SQL manual e operações do corte são
  responsabilidade do operador autorizado no ambiente e janela aprovados; este
  runbook não executa nem autoriza essas ações.

### Evidência #50 — PostgreSQL descartável

- Sem `DB_SCHEMA`, instalação vazia executou as 37 migrations no schema
  `clinicare`; canonical preexistente concluiu retry sem duplicar o ledger.
- Database local isolado com migrations até `0035` e fixtures sintéticas:
  `0035` backfill/trigger criou o vínculo; `0036` preservou `user.id`, e-mail,
  `professional.id`, `tenant_id` do profissional e membership `admin`, removendo
  `user.tenant_id` e a unicidade global antiga de profissional. Não contém PII.
- Cópia local descartável com schema/ledger legado foi renomeada explicitamente
  para `clinicare`; tabelas, sequência, FK, dados e ledger permaneceram
  consultáveis. Repetir o comando foi idempotente. Uma cópia com schema adicional
  ocupado falhou fechada sem alterar os schemas.
- `@clinicare/db test:integration`: 4 testes aprovados; API PostgreSQL + storage
  MiniStack: 62 testes/510 assertions; typechecks DB/API aprovados. Nenhuma
  conexão ou alteração em produção.

### Evidência #62 — restore e ensaio de migrations no dump local

- Base do código: `fef7da05dc6d9c577782196642af3756b471572b`; validação executada
  em 2026-11-26 no PostgreSQL local `clinicare-dev-postgres-1` (17.11), volume
  `clinicare-dev_postgres-data`. O endpoint foi conferido no container local,
  sem túnel: banco `clinicare`, schema atual `clinicare`, porta host 5432.
- O inventário antes da limpeza e do ensaio confirmou `clinicare` (56 tabelas, ledger com
  34 migrations), `clinicare_test` (50 tabelas, ledger com 24 migrations) e o
  schema separado `drizzle` (1 ledger com 10 migrations). Separadamente do
  ensaio de restauração/migrations, e por instrução explícita do responsável,
  `clinicare_test` e `drizzle` foram arquivados em
  `/tmp/opencode/clinicare-task62-preserve-noncanonical-20261126.dump` (202863
  bytes, modo 0600, SHA-256
  `8372823a6b6160c6ca60305cc0ef6642bd35905ba4a89dd93bb8b327afdca187`).
  `pg_restore --list` verificou o archive e seus 110 entries; os fingerprints
  anteriores dessas duas schemas já haviam sido reconciliados com o restore
  local descartável. Depois, os dois schemas foram removidos dentro de
  transação e somente no database local `clinicare`. Essa limpeza não é uma
  etapa do runbook nem será repetida como parte do ensaio; o ensaio de
  recuperação em si restaurou em database descartável separado. Não houve
  conexão nem alteração no PostgreSQL de produção durante essa limpeza.
- O ensaio criou archive custom restrito
  `/tmp/opencode/clinicare-task62-restore-20261126-02.dump` (525474 bytes,
  modo 0600) e restaurou somente para o database descartável
  `clinicare_restore_task62_20261126_02`, previamente vazio. A ferramenta
  `db:recovery-rehearsal` reconciliou o schema `clinicare`: 56 tabelas, 375
  linhas, 66 componentes, SHA-256
  `f217b8d31387042094100ba56b157ce9a5e311b3acad1032c63d73cb72c941d4`.
- Reconcilei também, separadamente, os schemas fora do fingerprint principal do
  ensaio de restore: `clinicare_test` com 50 tabelas/25 linhas e `drizzle` com
  1 tabela/10 linhas. Ambos estavam presentes na cópia descartável; os
  fingerprints completos de conteúdo origem/restore coincidiram
  (`091d37c6771994cba99a75fd8fda3ed70b750569a5296cfe26c2efb8ef196402` e
  `10bc7460fcacf265342bd20459ebaf18f42dee0b5fad2ef11e0dac5fc0dee27a`).
- Após essa limpeza local separada, `db:migrate` aplicou serialmente as
  migrations restantes no próprio database local `clinicare`: ledger com 40
  entradas, 60 tabelas no schema canônico, nenhum `user.tenant_id`, zero FKs
  não validadas e zero índices inválidos. O vínculo com a clínica foi preservado:
  1 tenant, 1 usuário, 1 vínculo administrativo e 1 profissional, sem usuários
  sem vínculo com clínica nem profissionais sem vínculo correspondente.
- Reconciliação contra o clone pré-migration: fingerprints dos IDs/PKs
  coincidiram em 55 tabelas comuns e fingerprints das linhas coincidiram em
  52 tabelas com schema idêntico. As diferenças de ledger e schema são
  esperadas pelas migrations. O smoke local descriptografou 10 valores
  protegidos e validou seus índices HMAC sem emitir plaintext.
- Reexecutei `db:migrate` após as 40 migrations; concluiu sem duplicar o ledger
  (continua com 40 entradas e 60 tabelas). No database local há 105 referências
  em colunas `*_object_key`, correspondendo a 59 keys distintas. Com credenciais
  S3 configuradas localmente, fiz inventário e leitura somente leitura do bucket
  remoto R2 selecionado por essas configurações: 80 objetos listados e SHA-256
  calculado sobre cada conteúdo (80/80); 21
  objetos não têm referência nessas colunas. Nenhuma das 59 keys referenciadas
  faltou no inventário; 59 hashes persistidos e 46 tamanhos persistidos foram
  comparados sem divergências. Não houve falha de leitura, divergência entre
  metadados do banco, nem diferença entre tamanho listado e bytes lidos. O
  fingerprint SHA-256 do manifesto do bucket (key, tamanho e SHA-256 do conteúdo,
  mantido somente no processo restrito) é
  `5f2a45fed3ee32d3f254325c172eeba229d684711a98be7eda62cc99eca7d950`.
  Um download histórico de revisão de documento por URL pré-assinada emitida
  pelo cliente R2 da aplicação também passou, com tamanho e SHA-256 coincidentes
  com o banco. Essas operações foram apenas list/get/download, sem escrita. O
  ambiente desse bucket remoto não foi confirmado como isolado de produção;
  portanto, esta evidência não sustenta a afirmação de que nenhum recurso de
  produção foi acessado e não deve ser usada para provar o isolamento do ensaio.
  Nenhuma key, conteúdo ou dado pessoal foi registrado. A aplicação de
  desenvolvimento normalmente seleciona MiniStack; o smoke R2 isolado removeu
  apenas as variáveis MiniStack do processo temporário, sem alterar `.env`.
  Permanecem não executados smoke de login/autorização contra a versão
  implantável, parada de escritores da instalação real, associação SQL de
  produção, inventário de roles/grants ou rollback de aplicação em produção.
  Essas condições mantêm o corte e a issue #62 abertos; esta evidência é somente
  do ensaio no dump local.
- Ensaiei também a transição reversa de compatibilidade no database descartável
  `clinicare_restore_task62_20261126_02`: após restaurar a cópia pré-migration e
  aplicar as 40 migrations, a transação de rollback do runbook restaurou
  `user.tenant_id`, unicidade/FK profissional e trigger de sincronização. O
  preflight confirmou um vínculo `admin` por usuário e clínica; o vínculo com a
  clínica foi preservado, sem usuários sem tenant/vínculo e com o profissional
  vinculado.
  Um teste transacional do trigger passou e foi revertido. Isso ensaia a
  reversão de compatibilidade do schema com dados copiados, não o rollback do
  binário/deploy da instalação real; nenhum dado da instalação local principal
  foi alterado por esse ensaio de rollback.
- A execução local não tinha `pg_dump`/`pg_restore` no host; foram usados
  binários 17.11 do container PostgreSQL por wrappers temporários em
  `/tmp/opencode`, não persistidos no repositório. O backup prévio informado
  pelo operador não foi alterado.
