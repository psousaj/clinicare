# Clínicare

Protótipo de gestão para clínicas pequenas de estética. **Use somente dados fictícios:** o painel ainda não possui autenticação.

## Stack

- React + TypeScript + Vite
- Bun
- Hono API
- PostgreSQL + Drizzle ORM
- Cloudflare R2 (integração será adicionada nas fatias de upload)

## Requisitos

- Bun 1.2+
- Docker Desktop (para PostgreSQL local)

## Rodar localmente

```bash
bun install
docker compose up -d
cp apps/api/.env.example apps/api/.env
bun run db:migrate
bun run dev
```

No PowerShell, use `Copy-Item apps/api/.env.example apps/api/.env` no lugar do `cp`.

- Web: http://localhost:5173
- API: http://localhost:3000/api/health

A primeira tela já permite cadastrar e pesquisar pacientes e cadastrar procedimentos básicos. Os demais fluxos entram nas próximas fatias.

## Verificações

```bash
bun run typecheck
bun run test
bun run build
```

Os testes da API usam Testcontainers e precisam do Docker em execução.
