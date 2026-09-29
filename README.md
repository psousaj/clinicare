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

Requer Bun 1.2+ e MongoDB local acessível em `MONGODB_URI`.

```bash
bun install
# Configure MONGODB_URI em apps/api/.env ou no ambiente
bun run dev
```

Web (Vite): http://localhost:5173; API: http://localhost:3000/api/health.

## Verificações

```bash
bun run typecheck
bun run test:api
bun run test:web
bun run build
```

Os testes da API usam MongoDB Memory Server e não precisam de Docker. `bun run build` gera artefatos; `docker compose build app` valida a imagem multi-stage de produção.
