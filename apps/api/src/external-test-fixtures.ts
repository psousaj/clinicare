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

/**
 * Emite certificado com validade explícita via mini-CA openssl (TEST-ONLY).
 * Permite gerar certificados expirados para provar bloqueio por validade.
 */
export async function issueDatedTestSigner(
  ca: TestCa,
  input: { commonName: string; cpfDigits: string; email: string; startDate: string; endDate: string },
): Promise<TestSigner> {
  const name = randomUUID().slice(0, 8);
  const dbDir = `${ca.dir}/minica-${name}`;
  await $`mkdir -p ${dbDir}/newcerts`.quiet();
  await Bun.write(`${dbDir}/index.txt`, '');
  await Bun.write(`${dbDir}/serial`, '1000');
  await Bun.write(
    `${dbDir}/ca.cnf`,
    `[ ca ]\ndefault_ca = mini\n[ mini ]\ndir = ${dbDir}\ndatabase = $dir/index.txt\nnew_certs_dir = $dir/newcerts\ncertificate = ${ca.dir}/ca.pem\nprivate_key = ${ca.caKeyPath}\nserial = $dir/serial\ndefault_md = sha256\ndefault_days = 825\npolicy = policy_any\n[ policy_any ]\ncommonName = supplied\nserialNumber = supplied\nemailAddress = supplied\n`,
  );
  await $`openssl req -newkey rsa:2048 -keyout ${ca.dir}/signer-${name}-key.pem -out ${ca.dir}/signer-${name}.csr -nodes -subj /CN=${input.commonName}/serialNumber=${input.cpfDigits}/emailAddress=${input.email}`.quiet();
  await Bun.write(`${ca.dir}/san-${name}.ext`, `[v3ext]\nsubjectAltName=email:${input.email}\n`);
  await $`openssl ca -batch -config ${dbDir}/ca.cnf -in ${ca.dir}/signer-${name}.csr -out ${ca.dir}/signer-${name}.pem -startdate ${input.startDate} -enddate ${input.endDate} -extensions v3ext -extfile ${ca.dir}/san-${name}.ext`.quiet();
  return {
    certPem: await Bun.file(`${ca.dir}/signer-${name}.pem`).text(),
    keyPath: `${ca.dir}/signer-${name}-key.pem`,
    cpfDigits: input.cpfDigits,
    email: input.email,
    commonName: input.commonName,
  };
}

const num10 = (n: number) => String(n).padStart(10, ' ');

const parseBaseTrailer = (base: Uint8Array) => {
  const text = Buffer.from(base).toString('latin1');
  const startxref = text.match(/startxref\s*(\d+)/);
  const size = text.match(/\/Size\s+(\d+)/);
  const root = text.match(/\/Root\s+(\d+\s+\d+\s+R)/);
  let maxObj = 0;
  for (const m of text.matchAll(/(\d+)\s+\d+\s+obj/g)) maxObj = Math.max(maxObj, Number(m[1]));
  if (!startxref || !size || !root) throw new Error('PDF base sem trailer legível para incremento.');
  return { prev: Number(startxref[1]), size: Number(size[1]), root: root[1], nextObj: maxObj + 1 };
};

/**
 * Anexa seção incremental BEM-FORMADA (objeto + xref + trailer + startxref)
 * com CMS real assinando os ranges declarados. Funciona sobre quaisquer
 * bytes exportados bem-formados (inclusive PDFs aplicados reais). O
 * resultado é aceito pelo motor incremental e pelo validador — como um
 * retorno genuíno de portal assinador.
 */

/**
 * Anexa seção incremental com CMS real assinando os ranges declarados.
 * Funciona sobre quaisquer bytes exportados (inclusive PDFs aplicados
 * reais). Prova de ponta a ponta que o validador aceita: prefixo,
 * cobertura, digest, CMS, cadeia.
 */
export async function buildSignedReturnPdf(exportBytes: Uint8Array, signer: TestSigner, dir: string, placeholderBytes = 4096): Promise<Uint8Array> {
  const tag = randomUUID().slice(0, 8);
  await Bun.write(`${dir}/signer-${tag}.pem`, signer.certPem);
  const trailer = parseBaseTrailer(exportBytes);
  const signum = trailer.nextObj;
  const headerOf = (a: number, b: number, c: number, d: number) =>
    new TextEncoder().encode(`${signum} 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [ ${num10(a)} ${num10(b)} ${num10(c)} ${num10(d)} ] /Contents <`);
  const sigTail = new TextEncoder().encode(`>\n>>\nendobj\n`);
  const probeHeader = headerOf(0, 0, 0, 0);
  const ltOffset = exportBytes.byteLength + probeHeader.length - 1;
  const hexLen = placeholderBytes * 2;
  const secondStart = ltOffset + 1 + hexLen + 1;
  const sigObjOffset = exportBytes.byteLength;
  const xrefPos = secondStart - 1 + sigTail.length;
  const xref = new TextEncoder().encode(
    `xref\n0 1\n0000000000 65535 f \n${signum} 1\n${String(sigObjOffset).padStart(10, '0')} 00000 n \ntrailer\n<< /Size ${Math.max(trailer.size, signum + 1)} /Root ${trailer.root} /Prev ${trailer.prev} >>\nstartxref\n${xrefPos}\n%%EOF\n`,
  );
  const tailLen = sigTail.length + xref.length;
  const headerFinal = headerOf(0, ltOffset, secondStart, tailLen - 1);
  const placeholderHex = '0'.repeat(hexLen);
  const assembled = Buffer.concat([Buffer.from(exportBytes), Buffer.from(headerFinal), Buffer.from(placeholderHex), Buffer.from(sigTail), Buffer.from(xref)]);
  const signed = Buffer.concat([assembled.subarray(0, ltOffset), assembled.subarray(secondStart)]);
  await Bun.write(`${dir}/tbs-${tag}.bin`, signed);
  await $`openssl cms -sign -binary -in ${dir}/tbs-${tag}.bin -signer ${dir}/signer-${tag}.pem -inkey ${signer.keyPath} -outform DER -out ${dir}/sig-${tag}.der -nosmimecap`.quiet();
  const sigDer = new Uint8Array(await Bun.file(`${dir}/sig-${tag}.der`).arrayBuffer());
  if (sigDer.length > placeholderBytes) throw new Error(`CMS gerado (${sigDer.length}B) excede o placeholder (${placeholderBytes}B).`);
  const sigHex = Buffer.from(sigDer).toString('hex').padEnd(hexLen, '0');
  return new Uint8Array(Buffer.concat([Buffer.from(exportBytes), Buffer.from(headerFinal), Buffer.from(sigHex), Buffer.from(sigTail), Buffer.from(xref)]));
}

/** Retorna o PDF com um byte adulterado após a assinatura (quebra o digest). */
export function tamperAfterExport(returnBytes: Uint8Array, exportLength: number): Uint8Array {
  const out = new Uint8Array(returnBytes);
  const index = exportLength + 50 < out.byteLength - 20 ? exportLength + 50 : out.byteLength - 20;
  out[index] = (out[index]! + 1) % 256;
  return out;
}

/** Seção incremental com conteúdo não-CMS (DER quebrado) no /Contents, mas
 * com trailer legível para permitir incrementos posteriores (teste). */
export function buildUnparsableCmsReturn(exportBytes: Uint8Array): Uint8Array {
  const garbageHex = 'deadbeef'.repeat(256);
  const head = (b: number, c: number, d: number) =>
    new TextEncoder().encode(`9 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [ ${num10(0)} ${num10(b)} ${num10(c)} ${num10(d)} ] /Contents <`);
  const probe = head(0, 0, 0);
  const lt = exportBytes.byteLength + probe.length - 1;
  const gapLen = 1 + garbageHex.length + 1;
  const tail = `>\n>>\nendobj\n`;
  // Comprimento do trailer depende dos dígitos de trailerPos (largura
  // variável): itera até estabilizar (converge em no máximo 2 passos).
  let trailer = Buffer.from('');
  let headFinal = head(lt, lt + gapLen, 0);
  for (let i = 0; i < 3; i++) {
    const trailerPos = exportBytes.byteLength + headFinal.length + garbageHex.length + tail.length;
    trailer = Buffer.from(`trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n${trailerPos}\n%%EOF\n`);
    headFinal = head(lt, lt + gapLen, tail.length - 1 + trailer.length);
  }
  const section = Buffer.concat([Buffer.from(headFinal), Buffer.from(garbageHex), Buffer.from(tail)]);
  return new Uint8Array(Buffer.concat([Buffer.from(exportBytes), section, trailer]) as unknown as Uint8Array);
}
