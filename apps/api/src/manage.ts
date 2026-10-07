import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { closeDatabase } from '@clinicare/db';
import { createClinicAdministrator, createTenant, listAdministrators, listTenants } from './admin-commands';

// CLI administrativo avulso — roda dentro do container (dist) ou no host:
//   docker compose exec app bun apps/api/dist/manage.js tenant create --name "Clínica"
//   docker compose exec -it app bun apps/api/dist/manage.js admin create --tenant-id <id> --name "Ana" --email ana@x.com   # pede a senha no stdin, sem eco
//   bun run manage -- tenant list
// A senha nunca sai do stdin/--password: não há senha default nem leitura de env.

export function parseManageArgs(args: string[]): { group: string; action: string; options: Map<string, string>; flags: Set<string> } {
  const [group, action, ...rest] = args;
  if (!group || !action) throw new Error('Uso: manage <tenant|admin> <create|list> [--opcao valor] [--flag].');
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index]!;
    if (!key.startsWith('--')) throw new Error(`Opção inválida: ${key}. Use --nome valor.`);
    const name = key.slice(2);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      flags.add(name);
    } else {
      options.set(name, value);
      index += 1;
    }
  }
  return { group, action, options, flags };
}

function opt(options: Map<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = options.get(name);
    if (value !== undefined) return value;
  }
  return '';
}

// Senha pelo stdin sem eco (docker exec -it). Com stdin redirecionado
// (pipe), lê as duas primeiras linhas (senha + confirmação).
async function promptHiddenPassword(): Promise<string> {
  const isTTY = process.stdin.isTTY === true;
  if (!isTTY) {
    const [first = '', second = ''] = (await Bun.stdin.text()).split(/\r?\n/);
    const password = first.trim();
    if (!password) throw new Error('Senha é obrigatória.');
    if (password !== second.trim()) throw new Error('As senhas não conferem.');
    return password;
  }
  spawnSync('stty', ['-echo'], { stdio: 'inherit' });
  try {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const first = (await rl.question('Senha (mín. 8 caracteres): ')).trim();
    const second = (await rl.question('Confirme a senha: ')).trim();
    rl.close();
    if (!first) throw new Error('Senha é obrigatória.');
    if (first !== second) throw new Error('As senhas não conferem.');
    return first;
  } finally {
    spawnSync('stty', ['echo'], { stdio: 'inherit' });
    process.stdout.write('\n');
  }
}

const HELP = `manage — administração avulsa (banco vazio sem bootstrap, p. ex.)

  manage tenant create --name "Nome da clínica"
  manage tenant list
  manage admin create --tenant-id <id> --name "Nome" --email a@b.c [--password ...]
    sem --password, a senha é pedida no stdin sem eco (use docker exec -it)
  manage admin list [--tenant-id <id>]`;

export async function runManage(rawArgs: string[]) {
  const { group, action, options } = parseManageArgs(rawArgs);
  if (group === 'tenant' && action === 'create') {
    return await createTenant({ name: opt(options, 'name', 'nome') });
  }
  if (group === 'tenant' && action === 'list') {
    const rows = await listTenants();
    for (const row of rows) console.log(`${row.active ? 'ativo  ' : 'inativo'} ${row.id}  ${row.name}`);
    return { count: rows.length };
  }
  if (group === 'admin' && action === 'create') {
    const password = opt(options, 'password', 'senha') || (await promptHiddenPassword());
    return await createClinicAdministrator({
      tenantId: opt(options, 'tenant-id', 'tenant', 'tenantId'),
      administratorName: opt(options, 'name', 'nome', 'admin-name'),
      email: opt(options, 'email', 'e-mail', 'admin-email'),
      password,
    });
  }
  if (group === 'admin' && action === 'list') {
    const tenantId = opt(options, 'tenant-id', 'tenant', 'tenantId') || undefined;
    const rows = await listAdministrators(tenantId);
    for (const row of rows) console.log(`${row.email}  ${row.name}  [${row.tenantId}]`);
    return { count: rows.length };
  }
  throw new Error(`Comando inválido: ${group} ${action}.\n${HELP}`);
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify(await runManage(Bun.argv.slice(2))));
  } catch (error) {
    const cause = (error as { cause?: unknown })?.cause;
    console.error(error instanceof Error ? error.message : error);
    if (cause && cause !== error) console.error(cause instanceof Error ? cause.message : cause);
    console.error(HELP);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
