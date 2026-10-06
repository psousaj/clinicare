/**
 * Fixtures de assinatura externa para testes (TEST-ONLY).
 *
 * Gera em tempo de execução, via openssl CLI, uma CA raiz de teste e
 * certificados de signatário, e constrói PDFs com seção incremental
 * contendo CMS real (assinado com `openssl cms -sign`). Nenhum material
 * daqui é usado em produção; chaves geradas vivem em diretório temporário.
 */
import { $ } from 'bun';
import { randomUUID } from 'node:crypto';

export type TestCa = { dir: string; caPem: string; caKeyPath: string };
export type TestSigner = { certPem: string; keyPath: string; cpfDigits: string; email: string; commonName: string };

export async function ensureOpensslAvailable() {
  try {
    await $`openssl version`.quiet();
  } catch {
    throw new Error('openssl CLI é necessário para gerar fixtures de assinatura externa.');
  }
}

export async function createTestCa(label: string): Promise<TestCa> {
  const dir = `/tmp/opencode/ext-fixtures/${label}-${randomUUID()}`;
  await $`mkdir -p ${dir}`.quiet();
  await $`openssl req -x509 -newkey rsa:2048 -keyout ${dir}/ca-key.pem -out ${dir}/ca.pem -days 3650 -nodes -subj /CN=Clinicare-Test-External-CA`.quiet();
  return { dir, caPem: await Bun.file(`${dir}/ca.pem`).text(), caKeyPath: `${dir}/ca-key.pem` };
}

export async function issueTestSigner(ca: TestCa, input: { commonName: string; cpfDigits: string; email: string }): Promise<TestSigner> {
  const name = randomUUID().slice(0, 8);
  await Bun.write(`${ca.dir}/san-${name}.ext`, `[v3]\nsubjectAltName=email:${input.email}\n`);
  await $`openssl req -newkey rsa:2048 -keyout ${ca.dir}/signer-${name}-key.pem -out ${ca.dir}/signer-${name}.csr -nodes -subj /CN=${input.commonName}/serialNumber=${input.cpfDigits}/emailAddress=${input.email}`.quiet();
  await $`openssl x509 -req -in ${ca.dir}/signer-${name}.csr -CA ${ca.dir}/ca.pem -CAkey ${ca.caKeyPath} -CAcreateserial -days 825 -out ${ca.dir}/signer-${name}.pem -extfile ${ca.dir}/san-${name}.ext -extensions v3`.quiet();
  return {
    certPem: await Bun.file(`${ca.dir}/signer-${name}.pem`).text(),
    keyPath: `${ca.dir}/signer-${name}-key.pem`,
    cpfDigits: input.cpfDigits,
    email: input.email,
    commonName: input.commonName,
  };
}

const num10 = (n: number) => String(n).padStart(10, ' ');

/**
 * Anexa seção incremental com CMS real assinando os ranges declarados.
 * Funciona sobre quaisquer bytes exportados (inclusive PDFs aplicados
 * reais). Prova de ponta a ponta que o validador aceita: prefixo,
 * cobertura, digest, CMS, cadeia.
 */
export async function buildSignedReturnPdf(exportBytes: Uint8Array, signer: TestSigner, dir: string, placeholderBytes = 4096): Promise<Uint8Array> {
  const tag = randomUUID().slice(0, 8);
  await Bun.write(`${dir}/signer-${tag}.pem`, signer.certPem);
  const headerOf = (a: number, b: number, c: number, d: number) =>
    new TextEncoder().encode(`9 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [ ${num10(a)} ${num10(b)} ${num10(c)} ${num10(d)} ] /Contents <`);
  const footer = new TextEncoder().encode(`>\n>>\nendobj\n`);
  const probeHeader = headerOf(0, 0, 0, 0);
  const ltOffset = exportBytes.byteLength + probeHeader.length - 1;
  const secondStart = ltOffset + 1 + placeholderBytes * 2 + 1;
  const headerFinal = headerOf(0, ltOffset, secondStart, footer.length - 1);
  const placeholderHex = '0'.repeat(placeholderBytes * 2);
  const assembled = Buffer.concat([Buffer.from(exportBytes), Buffer.from(headerFinal), Buffer.from(placeholderHex), Buffer.from(footer)]);
  const signed = Buffer.concat([assembled.subarray(0, ltOffset), assembled.subarray(secondStart)]);
  await Bun.write(`${dir}/tbs-${tag}.bin`, signed);
  await $`openssl cms -sign -binary -in ${dir}/tbs-${tag}.bin -signer ${dir}/signer-${tag}.pem -inkey ${signer.keyPath} -outform DER -out ${dir}/sig-${tag}.der -nosmimecap`.quiet();
  const sigDer = new Uint8Array(await Bun.file(`${dir}/sig-${tag}.der`).arrayBuffer());
  if (sigDer.length > placeholderBytes) throw new Error(`CMS gerado (${sigDer.length}B) excede o placeholder (${placeholderBytes}B).`);
  const sigHex = Buffer.from(sigDer).toString('hex').padEnd(placeholderBytes * 2, '0');
  return new Uint8Array(Buffer.concat([Buffer.from(exportBytes), Buffer.from(headerFinal), Buffer.from(sigHex), Buffer.from(footer)]));
}

/** Retorna o PDF com um byte adulterado após a assinatura (quebra o digest). */
export function tamperAfterExport(returnBytes: Uint8Array, exportLength: number): Uint8Array {
  const out = new Uint8Array(returnBytes);
  const index = exportLength + 50 < out.byteLength - 20 ? exportLength + 50 : out.byteLength - 20;
  out[index] = (out[index]! + 1) % 256;
  return out;
}

/** Seção incremental com conteúdo não-CMS (DER quebrado) no /Contents. */
export function buildUnparsableCmsReturn(exportBytes: Uint8Array): Uint8Array {
  const garbageHex = 'deadbeef'.repeat(256);
  const head = (b: number, c: number, d: number) =>
    new TextEncoder().encode(`9 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [ ${num10(0)} ${num10(b)} ${num10(c)} ${num10(d)} ] /Contents <`);
  const probe = head(0, 0, 0);
  const lt = exportBytes.byteLength + probe.length - 1;
  const gapLen = 1 + garbageHex.length + 1;
  const tail = `>\n>>\nendobj`;
  const headFinal = head(lt, lt + gapLen, tail.length - 1);
  return new Uint8Array(Buffer.concat([Buffer.from(exportBytes), Buffer.from(headFinal), Buffer.from(garbageHex), Buffer.from(tail)]) as unknown as Uint8Array);
}
