# Clínicare

Protótipo de gestão para clínicas pequenas de estética. **Use somente dados fictícios:** o painel ainda não possui autenticação. A troca para MongoDB descarta a antiga base local PostgreSQL; não há migração de registros fictícios.

## Stack

- React + TypeScript + Vite
- Bun
- Hono API (serve UI e API no mesmo container)
- MongoDB + Mongoose
- Cloudflare R2 para binários de fotos/documentos (opcional)

## Rodar localmente via Docker (caminho recomendado)

Requer Docker Desktop com Compose.

```bash
# configure R2 somente se precisar de upload de fotos/documentos
cp .env.example .env
docker compose up --build
```

No PowerShell, use `Copy-Item .env.example .env`. App: http://localhost:3000. Healthcheck: http://localhost:3000/api/health. MongoDB local é persistido no volume `clinicare-mongo`.

Para apagar completamente a base fictícia e reconstruir:

```bash
docker compose down -v
docker compose up --build
```

`bun run db:reset` executa os mesmos comandos no ambiente com Bun instalado.

## Desenvolvimento sem Docker

Requer Bun 1.2+, Node 22.12+/24 (o `mise.toml` fixa o Node 24; rode `mise install`) e Docker. Suba a infra de dev (`dev-compose.yml`):

```bash
bun run infra:up      # infra:down para parar, infra:reset para apagar volumes
cp apps/api/.env.example apps/api/.env   # descomente o bloco "Dev" para usar o ministack
bun install
bun run dev
```

| Serviço | URL | Uso |
| --- | --- | --- |
| MongoDB | `mongodb://localhost:27017` | banco (`MONGODB_URI`) |
| mongo-express | http://localhost:8082 | studio visual do Mongo |
| ministack | http://localhost:4566 | emulador AWS/S3 local (bucket `clinicare-dev`, credenciais `test`/`test`) |

Portas do host configuráveis com `MONGO_PORT`, `MONGO_EXPRESS_PORT` e `MINISTACK_PORT`. O `docker-compose.yml` (produção) também usa a 27017; não suba os dois ao mesmo tempo.

Web (Vite): http://localhost:5173; API: http://localhost:3000/api/health.

## Estrutura do monorepo

Monorepo com [Bun workspaces](https://bun.sh/docs/install/workspaces) + [Turborepo](https://turbo.build) (`turbo.json`):

- `apps/web` – `@clinicare/web` (React + Vite)
- `apps/api` – `@clinicare/api` (Hono), depende de `@clinicare/db`
- `packages/db` – `@clinicare/db` (schemas Mongoose)

Os scripts da raiz (`dev`, `build`, `typecheck`, `test`) rodam via `turbo run`, com cache e ordem por dependência. Para um único pacote: `bunx turbo run build --filter=@clinicare/api`.

## Verificações

```bash
bun run typecheck
bun run test:api
bun run test:web
bun run build
```

Os testes da API usam MongoDB Memory Server e não precisam de Docker. `bun run build` gera artefatos; `docker compose build app` valida a imagem multi-stage de produção.
