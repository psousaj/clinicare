import { connectPostgresDatabase, migrateDatabase } from '@clinicare/db';
import { app } from './app';
import { createWebAssetMiddleware, serveSpaIndex } from './static-files';
import { resolveApiPort } from './runtime-config';

await migrateDatabase();
await connectPostgresDatabase();
app.use('/*', createWebAssetMiddleware());
// Fallback da SPA para rotas do TanStack Router (ex.: /pacientes, /formulario/:token).
app.get('*', serveSpaIndex);
const resolvedPort = resolveApiPort(process.env.API_PORT);
console.log(`API rodando na porta ${resolvedPort}`);
// O export default deixa o Bun trocar o handler a cada mudança no `bun --hot`, sem reiniciar o servidor.
export default {
  port: resolvedPort,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
