# Inventário e ensaio de recuperação para a migração SaaS

Este runbook prepara e verifica a recuperação antes de qualquer migração. Ele
não é autorização para acessar produção, parar serviços, aplicar migrations ou
restaurar dados sobre uma instalação existente. O ensaio sempre restaura em
outro database vazio no mesmo servidor PostgreSQL local; não usa `--clean`,
`DROP`, `reset`, `db:reset` ou seed como migração.

## Situação verificada neste checkout

- Código no checkout: commit `d88c8876dda77a164b6671cd2ce0bdb5c62d7859`
  (base de #45: commit `d88c8876dda77a164b6671cd2ce0bdb5c62d7859`).
- A imagem local `clinicare-app:latest` existe, mas não há container Clinicare
  de aplicação em execução; portanto ela não comprova a versão implantada.
- `.env` aponta para `localhost:5432/clinicare`, porém a porta 5432 pertence a
  `photopulse-postgres`, não ao PostgreSQL Clinicare. Não conectar nem executar
  migrations nesse endereço como parte deste ensaio.
- O banco descartável do ensaio foi iniciado isoladamente em `localhost:55432`
  com volume próprio. Schema e ledger foram criados a partir das migrations
  deste checkout. É um banco local de teste, não a instalação Clinicare de
  produção nem evidência da versão implantada.
- `CLOUDFLARE_ACCOUNT_ID` e `R2_BUCKET` estão configurados localmente, mas as
  credenciais S3 não estão disponíveis; o MiniStack local não permite inventariar
  os objetos de produção. Nenhuma chave de proteção/HMAC ou segredo é registrado
  neste documento.
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
   reutilize volume desconhecido nem altere containers alheios. Para este
   checkout, 5432 já está ocupado; o ensaio foi isolado em 55432.
2. Aplique migrations somente ao database descartável e use fixture sintética
   não identificável apenas para provar preservação de linhas e relações.
3. Crie um database vazio `clinicare_restore_<identificador>` no mesmo servidor,
   sem tabelas nem extensões preexistentes.
4. Configure as variáveis abaixo de forma segura. Não coloque URLs no histórico
   do shell nem habilite tracing (`set -x`):

   ```sh
   export RECOVERY_SOURCE_DATABASE_URL='postgresql://...@127.0.0.1:55432/clinicare'
   export RECOVERY_TARGET_DATABASE_URL='postgresql://...@127.0.0.1:55432/clinicare_restore_<identificador>'
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

### Evidência executada neste checkout

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
