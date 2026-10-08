FROM oven/bun:1.2 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run build:web
RUN bun run build:api

FROM oven/bun:1.2 AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 MIGRATIONS_FOLDER=/app/apps/api/drizzle
# Conversão DOCX->PDF sob demanda via LibreOffice headless + fontes
# metricamente compatíveis com o Word (Calibri/Cambria não andam no layout).
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db/drizzle ./apps/api/drizzle
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json
# CLI administrativo direto no PATH: `manage tenant list` dentro do container.
COPY --from=build /app/docker/manage /usr/local/bin/manage
RUN chmod +x /usr/local/bin/manage
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD bun -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["bun", "apps/api/dist/index.js"]
