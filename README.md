# Clínicare

Protótipo de gestão para clínicas pequenas de estética. **Use somente dados fictícios:** o painel ainda não possui autenticação. A persistência é PostgreSQL; a base pode ser recriada por migrations e seed idempotentes, sem migração dos registros prototípicos antigos.

## Stack

- React + TypeScript + Vite
- TanStack Router (rotas por arquivo em `apps/web/src/routes`) + TanStack Query (dados) + Zod (validação de respostas da API e formulários)
- Tailwind CSS v4 + shadcn/ui (`apps/web/src/components/ui`); o `styles.css` legado convive com o Tailwind (sem preflight)
- Bun
- Hono API (serve UI e API no mesmo container)
- PostgreSQL + Drizzle + JSONB
- Cloudflare R2 para binários de fotos/documentos (opcional)

## Rodar localmente via Docker (caminho recomendado)

Requer Docker Desktop com Compose.

```bash
# preencha DATABASE_URL, DATA_ENCRYPTION_KEY, SEARCH_HMAC_KEY e UPLOAD_SIGNING_KEY em .env;
# configure R2 somente se precisar de upload de fotos/documentos
cp .env.example .env
# gere as três chaves locais antes de subir (openssl rand -base64 32)
docker compose up --build
```

No PowerShell, use `Copy-Item .env.example .env`. App: http://localhost:3000. Healthcheck: http://localhost:3000/api/health. PostgreSQL local é persistido no volume `clinicare-postgres`.

Para apagar completamente a base fictícia e reconstruir:

```bash
docker compose down -v
docker compose up --build
```

No primeiro startup, o app cria a conta administrativa inicial usando `BOOTSTRAP_CLINIC_NAME`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` do ambiente — as quatro são opcionais e só valem juntas. Configure-as com valores próprios e fortes (em produção, use um gerenciador de secrets). O seed roda em todo startup, mas não altera senha, conta existente nem os nomes editados em Configurações → Clínica e conta; para trocar a senha, use `bun run reset-clinic-password --admin-email email --admin-password senha`. Sem as chaves de bootstrap, provisione a primeira clínica com `bun run provision-tenant --clinic-name "Nome" --admin-name "Nome" --admin-email email --admin-password senha`. De dentro do container (banco vazio, sem env), use o CLI avulso — a senha é pedida no stdin sem eco, nunca vai para o ambiente nem para o histórico do shell:

```bash
docker compose exec app manage tenant create --name "Minha Clínica"
# anote o id impresso e crie o admin (use -it para o prompt oculto de senha):
docker compose exec -it app manage admin create --tenant-id <id> --name "Responsável" --email admin@clinica.com
docker compose exec app manage tenant list
docker compose exec app manage admin list
```

O `manage` está no PATH da imagem (wrapper em `/usr/local/bin/manage` → `dist/manage.js`); dentro do container é só `manage ...`, como `cd`/`pwd`.

Para gerar os segredos próprios do app no formato esperado, rode `bun run secrets:generate` e copie as linhas para `.env`. O comando imprime valores novos sem alterar arquivos; não regenere chaves de uma instalação existente, pois elas são necessárias para ler dados protegidos. Credenciais do PostgreSQL e do Cloudflare R2 devem vir desses serviços, não deste gerador.

`bun run db:reset` executa os mesmos comandos no ambiente com Bun instalado.

## Desenvolvimento sem Docker

Requer Bun 1.2+, Node 22.12+/24 (o `mise.toml` fixa o Node 24; rode `mise install`) e Docker. Suba a infra de dev (`dev-compose.yml`):

```bash
bun run infra:up      # infra:down para parar, infra:reset para apagar volumes
cp .env.example .env
bun install
bun run dev
```

No `.env` local, `MINISTACK_ENDPOINT` seleciona o emulador e usa as credenciais `MINISTACK_*`; sem essa variável, a API usa a configuração `R2_*` do Cloudflare. O Compose de produção não recebe variáveis `MINISTACK_*`.

| Serviço | URL | Uso |
| --- | --- | --- |
| PostgreSQL | `postgresql://clinicare:clinicare@localhost:5432/clinicare` | banco (`DATABASE_URL`) |
| ministack | http://localhost:4566 | emulador AWS/S3 local (bucket `clinicare-dev`, credenciais `test`/`test`) |

Portas do host configuráveis com `POSTGRES_PORT` e `MINISTACK_PORT`. O `docker-compose.yml` (produção) também usa a 5432; não suba os dois ao mesmo tempo.

Web (Vite): http://localhost:5173 (o `routeTree.gen.ts` é gerado pelo plugin do router e deve ser versionado; novos componentes shadcn: `bunx shadcn@latest add <nome>` em `apps/web`); API: http://localhost:3000/api/health.

## Estrutura do monorepo

Monorepo com [Bun workspaces](https://bun.sh/docs/install/workspaces) + [Turborepo](https://turbo.build) (`turbo.json`):

- `apps/web` – `@clinicare/web` (React + Vite + TanStack Router/Query)
- `apps/api` – `@clinicare/api` (Hono), depende de `@clinicare/db`
- `packages/db` – `@clinicare/db` (schema relacional Drizzle e migrations PostgreSQL)

Os scripts da raiz (`dev`, `build`, `typecheck`, `test`) rodam via `turbo run`, com cache e ordem por dependência. Para um único pacote: `bunx turbo run build --filter=@clinicare/api`.

## Verificações

```bash
bun run typecheck
bun run test:api
bun run test:web
bun run build
```

Os testes unitários são locais; a suíte de integração da API usa PostgreSQL real com `DATABASE_URL`, migrations aplicadas e tenants isolados. `bun run test:smoke` executa o smoke test dos fluxos críticos (paciente, catálogo, acompanhamento, assinatura, agenda, atendimento, pagamento e histórico) contra PostgreSQL. `bun run build` gera artefatos; `docker compose build app` valida a imagem multi-stage de produção.
