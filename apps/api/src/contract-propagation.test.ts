import { describe, expect, it } from 'bun:test';
import { propagatePublishedVersion } from './contract-authoring';

// Harness com executor falso: cada `select` devolve a próxima resposta da fila,
// na ordem em que propagatePublishedVersion consulta
// (stale → followups vivos → processos → assinados → participantes do processo).
// Verifica o ramificação sem precisar de banco:
// - sem R0 (generating) e sem assinatura: atualiza a versão na linha;
// - com R0 (ready) e sem assinatura: cancela a linha e cria substituta;
// - com qualquer assinatura: congela; acompanhamento cancelado: ignora.
type Call = { op: string; table: string; data?: unknown };

function fakeTx(selects: any[][]) {
  const calls: Call[] = [];
  let step = 0;
  const tx: any = {
    calls,
    select: (..._args: any[]) => ({
      from: (_table: any) => ({
        where: async (..._where: any[]) => selects[step++] ?? [],
      }),
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: async (..._where: any[]) => {
          calls.push({ op: 'update', table: String((table as any)?.[Symbol.toStringTag] ?? table), data });
          return [];
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (data: any) => {
        calls.push({ op: 'insert', table: String((table as any)?.[Symbol.toStringTag] ?? table), data });
        return [];
      },
    }),
    execute: async () => undefined,
  };
  return { tx, calls };
}

const version = (n: number) => ({ version: n, sourceDocxObjectKey: 'docx-key', sourceObjectKey: null, content: null });

describe('publish propagation', () => {
  it('bumps pre-R0 contracts in place', async () => {
    const { tx, calls } = fakeTx([
      [{ id: 'c1', followupId: 'f1', contractVersion: 1, status: 'generating', renderedPdfObjectKey: null, materializedDocxObjectKey: null }],
      [{ id: 'f1' }],
      [],
    ]);
    await propagatePublishedVersion(tx, 't', 'contract', version(2), 'Título');
    const updates = calls.filter((c: Call) => c.op === 'update');
    const inserts = calls.filter((c: Call) => c.op === 'insert');
    expect(updates.length).toBe(1);
    expect((updates[0]!.data as any).contractVersion).toBe(2);
    expect((updates[0]!.data as any).status).toBe('generating');
    expect(inserts.length).toBe(0);
  });

  it('replaces R0 contracts without signatures and freezes signed ones', async () => {
    const { tx, calls } = fakeTx([
      [
        { id: 'ready1', followupId: 'f1', contractVersion: 1, status: 'ready', renderedPdfObjectKey: 'pdf', materializedDocxObjectKey: 'docx', required: true },
      ],
      [{ id: 'f1' }],
      [{ id: 'p1', contractId: 'ready1' }],
      [],
      [{ id: 'p1' }],
      [{ id: 'part1' }],
    ]);
    await propagatePublishedVersion(tx, 't', 'contract', version(2), 'Título');
    const contractUpdates = calls.filter((c: Call) => c.op === 'update');
    const contractInserts = calls.filter((c: Call) => c.op === 'insert');
    // processo cancelado + linha antiga cancelada + linha substituta em geração + evento de auditoria
    expect(contractUpdates.length).toBe(2);
    expect(contractInserts.length).toBe(2);
    const replacement = contractInserts.find((c: Call) => (c.data as any)?.contractVersion === 2);
    expect((replacement!.data as any).status).toBe('generating');
    expect((replacement!.data as any).followupId).toBe('f1');
  });

  it('freezes contracts with any signed participant', async () => {
    const { tx, calls } = fakeTx([
      [{ id: 'r1', followupId: 'f1', contractVersion: 1, status: 'ready', renderedPdfObjectKey: 'pdf', materializedDocxObjectKey: 'docx', required: true }],
      [{ id: 'f1' }],
      [{ id: 'p1', contractId: 'r1' }],
      [{ processId: 'p1' }],
    ]);
    await propagatePublishedVersion(tx, 't', 'contract', version(2), 'Título');
    expect(calls.length).toBe(0);
  });

  it('ignores cancelled followups', async () => {
    const { tx, calls } = fakeTx([
      [{ id: 'd1', followupId: 'f9', contractVersion: 1, status: 'generating', renderedPdfObjectKey: null, materializedDocxObjectKey: null }],
      [],
    ]);
    await propagatePublishedVersion(tx, 't', 'contract', version(2), 'Título');
    expect(calls.length).toBe(0);
  });
});
