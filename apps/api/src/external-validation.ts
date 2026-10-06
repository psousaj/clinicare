/**
 * Validação de retorno externo (GOV.BR/PAdES) — Issue #26.
 *
 * A aplicação NÃO implementa PAdES, não emite certificados e não assina
 * criptograficamente: ela recebe o PDF assinado fora, valida com
 * criptografia real (pkijs + WebCrypto) e incorpora o arquivo validado
 * como nova revisão, preservando os bytes externos exatamente como
 * recebidos (ADR 0004). Nenhum status é aceito por declaração do
 * navegador: toda classificação deriva de verificações executadas aqui.
 *
 * Resultados (semanticamente distintos, nunca misturados):
 * - `validated` — promoção autorizada como nova revisão.
 * - `invalid` — rejeitado com motivo; pode ser preservado como histórico.
 * - `indeterminate` — não foi possível decidir (cadeia, revogação ou
 *   signatário não verificáveis); nunca promove.
 * - `unsupported` — formato/fluxo não suportado; nunca promove.
 */
import { createHash } from 'node:crypto';
import { fromBER } from 'asn1js';
import {
  BasicOCSPResponse,
  Certificate,
  CertificateRevocationList,
  CertID,
  ContentInfo,
  getCrypto,
  OCSPRequest,
  OCSPResponse,
  Request as OCSPRequestEntry,
  SignedData,
  TBSRequest,
} from 'pkijs';

export type ExternalValidationStatus = 'validated' | 'invalid' | 'indeterminate' | 'unsupported';

export type ExpectedSigner = {
  /** Dígitos do CPF esperado (somente dígitos). */
  cpfDigits?: string;
  /** E-mails aceitos do signatário (comparação case-insensitive). */
  emails?: string[];
};

export type ExternalValidationReport = {
  status: ExternalValidationStatus;
  /** Código estável do motivo (ex.: 'no_new_signature', 'digest_mismatch'). */
  reason: string;
  exportHash: string;
  returnHash: string;
  exportSize: number;
  returnSize: number;
  prefixPreserved: boolean;
  exportSignatures: number;
  returnSignatures: number;
  newSignature: boolean;
  coverageValid: boolean | null;
  digestMatch: boolean | null;
  cmsValid: boolean | null;
  previousSignaturesOk: boolean | null;
  chain: 'trusted' | 'untrusted' | 'unknown';
  revocation: 'good' | 'revoked' | 'unknown' | 'not_applicable';
  signerCorrespondence: 'matched' | 'mismatch' | 'unverifiable';
  signer: {
    commonName: string | null;
    serialDigits: string | null;
    emails: string[];
    notBefore: string | null;
    notAfter: string | null;
  } | null;
  /** SHA-256 do certificado do signatário (DER). */
  certificateFingerprint: string | null;
  detectedSignatureCount: number;
  subFilter: string | null;
};

type ResolvedPair = {
  byteRange: [number, number, number, number];
  cmsBytes: Uint8Array;
  subFilter: string | null;
};

const sha256Hex = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const bytesEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
};
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
const unhex = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));

const fail = (base: Omit<ExternalValidationReport, 'status' | 'reason'>, reason: ExternalValidationReport['reason'], status: ExternalValidationStatus): ExternalValidationReport => ({ ...base, status, reason });

function blankReport(exportBytes: Uint8Array, returnBytes: Uint8Array): Omit<ExternalValidationReport, 'status' | 'reason'> {
  return {
    exportHash: sha256Hex(exportBytes),
    returnHash: sha256Hex(returnBytes),
    exportSize: exportBytes.byteLength,
    returnSize: returnBytes.byteLength,
    prefixPreserved: false,
    exportSignatures: 0,
    returnSignatures: 0,
    newSignature: false,
    coverageValid: null,
    digestMatch: null,
    cmsValid: null,
    previousSignaturesOk: null,
    chain: 'unknown',
    revocation: 'not_applicable',
    signerCorrespondence: 'unverifiable',
    signer: null,
    certificateFingerprint: null,
    detectedSignatureCount: 0,
    subFilter: null,
  };
}

/**
 * Localiza pares (/ByteRange, /Contents) por varredura byte-a-byte do
 * arquivo. Cada /ByteRange é pareado com o primeiro /Contents hexadecimal
 * que o sucede antes do próximo /ByteRange (a ordem do dicionário de
 * assinatura). Não interpreta xref nem objetos: a prova de cobertura é
 * aritmética sobre os próprios intervalos declarados.
 */

/** Recompõe os pares com os intervalos declarados (forma canônica). */
export function resolveSignaturePairs(pdf: Uint8Array): ResolvedPair[] {
  const text = latin1(pdf);
  const rangeRe = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const contentsRe = /\/Contents\s*<\s*([0-9A-Fa-f\s]+?)\s*>/g;
  const ranges: Array<{ index: number; values: [number, number, number, number] }> = [];
  let match: RegExpExecArray | null;
  while ((match = rangeRe.exec(text)) !== null) {
    ranges.push({ index: match.index, values: [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])] });
  }
  const contents: Array<{ index: number; hex: string }> = [];
  while ((match = contentsRe.exec(text)) !== null) {
    contents.push({ index: match.index, hex: match[1]!.replace(/\s+/g, '') });
  }
  const out: ResolvedPair[] = [];
  for (const range of ranges) {
    const content = contents.find((c) => c.index > range.index && !ranges.some((other) => other.index > range.index && other.index < c.index));
    if (!content || content.hex.length % 2 !== 0) continue;
    const window = text.slice(Math.max(0, range.index - 400), content.index + content.hex.length + 2);
    out.push({
      byteRange: range.values,
      cmsBytes: unhex(content.hex),
      subFilter: window.match(/\/SubFilter\s*\/([A-Za-z0-9.]+)/)?.[1] ?? null,
    });
  }
  return out;
}

const rangeContent = (pdf: Uint8Array, byteRange: [number, number, number, number]) => {
  const [a, b, c, d] = byteRange;
  if (a !== 0 || b <= 0 || c <= b || d <= 0 || c + d > pdf.byteLength) return null;
  const head = pdf.subarray(a, a + b);
  const tail = pdf.subarray(c, c + d);
  const out = new Uint8Array(head.byteLength + tail.byteLength);
  out.set(head, 0);
  out.set(tail, head.byteLength);
  return out;
};

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  return unhex(Buffer.from(body, 'base64').toString('hex'));
}

export function parseTrustedRoots(pems: string[]): { der: Uint8Array; fingerprint: string }[] {
  const out: { der: Uint8Array; fingerprint: string }[] = [];
  for (const pem of pems) {
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/g) ?? [];
    for (const block of blocks) {
      const der = pemToDer(block);
      out.push({ der, fingerprint: sha256Hex(der) });
    }
  }
  return out;
}

type CertView = {
  cert: Certificate;
  der: Uint8Array;
  fingerprint: string;
  subjectKey: string;
  issuerKey: string;
  notBefore: Date;
  notAfter: Date;
};

async function toCertView(der: Uint8Array): Promise<CertView | null> {
  try {
    const asn1 = fromBER(exactBytes(der));
    if (asn1.offset === -1) return null;
    const cert = new Certificate({ schema: asn1.result });
    return {
      cert,
      der,
      fingerprint: sha256Hex(der),
      subjectKey: JSON.stringify(cert.subject.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value])),
      issuerKey: JSON.stringify(cert.issuer.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value])),
      notBefore: cert.notBefore.value,
      notAfter: cert.notAfter.value,
    };
  } catch {
    return null;
  }
}

const exactBytes = (view: Uint8Array) => view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;

async function verifyCertSignature(child: CertView, issuer: CertView): Promise<boolean> {
  try {
    // Construção de cadeia para elos RSA/SHA-256 (perfil dos certificados
    // ICP-Brasil e do GOV.BR). Outros algoritmos não são reconstruídos aqui:
    // a cadeia resulta em `untrusted` (indeterminado), nunca em sucesso.
    const crypto = globalThis.crypto;
    const tbsDer = child.cert.tbsView;
    const signature = new Uint8Array(child.cert.signatureValue.valueBlock.valueHexView);
    const spkiDer = new Uint8Array(issuer.cert.subjectPublicKeyInfo.toSchema().toBER(false));
    const key = await crypto.subtle.importKey('spki', exactBytes(spkiDer), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, exactBytes(signature), exactBytes(tbsDer));
  } catch {
    return false;
  }
}

type RevocationOutcome = 'good' | 'revoked' | 'unknown' | 'not_applicable';

function certEndpoints(cert: Certificate): { ocsp: string[]; crl: string[] } {
  const ocsp: string[] = [];
  const crl: string[] = [];
  try {
    for (const ext of cert.extensions ?? []) {
      if (ext.extnID === '1.3.6.1.5.5.7.1.1') {
        const raw = Buffer.from(ext.extnValue.valueBlock.valueHexView).toString('latin1');
        for (const m of raw.matchAll(/https?:\/\/[^\s"'<>\\]+/g)) {
          if (raw.includes('OCSP') || m[0].toLowerCase().includes('ocsp')) ocsp.push(m[0]);
        }
      }
      if (ext.extnID === '2.5.29.31') {
        const raw = Buffer.from(ext.extnValue.valueBlock.valueHexView).toString('latin1');
        for (const m of raw.matchAll(/(?:https?|ldap):\/\/[^\s"'<>\\]+/g)) crl.push(m[0]);
      }
    }
  } catch {
    return { ocsp, crl };
  }
  return { ocsp: [...new Set(ocsp)], crl: [...new Set(crl)] };
}

async function checkRevocation(cert: CertView, issuer: CertView | null, timeoutMs: number): Promise<RevocationOutcome> {
  const { ocsp, crl } = certEndpoints(cert.cert);
  const outcomes = new Set<RevocationOutcome>();
  for (const url of crl) {
    outcomes.add(await checkCrl(cert, url, timeoutMs));
  }
  if (issuer) {
    for (const url of ocsp) {
      outcomes.add(await checkOcsp(cert, issuer, url, timeoutMs));
    }
  } else if (ocsp.length > 0) {
    // Sem emissor verificado não há como montar a requisição OCSP: a
    // presença do endpoint impede a decisão em vez de presumir sucesso.
    outcomes.add('unknown');
  }
  if (outcomes.size === 0) return 'not_applicable';
  // Revogado vence; qualquer verificação inconclusiva impede o sucesso.
  if (outcomes.has('revoked')) return 'revoked';
  if (outcomes.has('unknown')) return 'unknown';
  return 'good';
}

async function checkCrl(cert: CertView, url: string, timeoutMs: number): Promise<RevocationOutcome> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return 'unknown';
    const der = new Uint8Array(await response.arrayBuffer());
    const asn1 = fromBER(exactBytes(der));
    if (asn1.offset === -1) return 'unknown';
    const list = new CertificateRevocationList({ schema: asn1.result });
    const serialHex = Buffer.from(cert.cert.serialNumber.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
    for (const revoked of list.revokedCertificates ?? []) {
      const entryHex = Buffer.from(revoked.userCertificate.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
      if (entryHex === serialHex) return 'revoked';
    }
    return 'good';
  } catch {
    return 'unknown';
  }
}

/**
 * OCSP real (RFC 6960): monta a requisição para o certificado, envia ao
 * respondedor indicado pela AIA, verifica a assinatura da resposta com
 * cadeia até o emissor (exigindo EKU OCSPSigning salvo o próprio emissor),
 * confere frescor e lê o estado do certificado. Qualquer falha de rede,
 * formato, assinatura ou frescor resulta em `unknown` (indeterminado) —
 * nunca em sucesso presumido.
 */
async function checkOcsp(cert: CertView, issuer: CertView, endpoint: string, timeoutMs: number): Promise<RevocationOutcome> {
  try {
    const crypto = getCrypto();
    const certId = await CertID.create(cert.cert as never, { hashAlgorithm: 'SHA-1', issuer: issuer.cert } as never, crypto as never).catch(() => null);
    if (!certId) return 'unknown';
    const request = new OCSPRequest({ tbsRequest: new TBSRequest({ requestList: [new OCSPRequestEntry({ reqCert: certId })] }) });
    const requestDer = Buffer.from(request.toSchema().toBER(false));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/ocsp-request', accept: 'application/ocsp-response' },
      body: requestDer,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return 'unknown';
    const responseDer = new Uint8Array(await response.arrayBuffer());
    return verifyOcspResponse({
      certDer: cert.der,
      issuerDer: issuer.der,
      responseDer,
      nowMs: Date.now(),
    });
  } catch {
    return 'unknown';
  }
}

/**
 * Verificação pura de resposta OCSP (sem rede): interpreta, autentica o
 * respondedor contra o emissor e lê o estado do certificado. Exportada
 * para testes com bytes reais de respondedor.
 */
export async function verifyOcspResponse(input: { certDer: Uint8Array; issuerDer: Uint8Array; responseDer: Uint8Array; nowMs: number }): Promise<RevocationOutcome> {
  try {
    const certView = await toCertView(input.certDer);
    const issuerView = await toCertView(input.issuerDer);
    if (!certView || !issuerView) return 'unknown';
    const responseAsn1 = fromBER(exactBytes(input.responseDer));
    if (responseAsn1.offset === -1) return 'unknown';
    const ocspResponse = new OCSPResponse({ schema: responseAsn1.result });
    if (ocspResponse.responseStatus.valueBlock.valueDec !== 0) return 'unknown';
    const responseBytes = ocspResponse.responseBytes;
    if (!responseBytes || responseBytes.responseType !== '1.3.6.1.5.5.7.48.1.1') return 'unknown';
    const basicDer = new Uint8Array(responseBytes.response.valueBlock.valueHexView);
    const basicAsn1 = fromBER(exactBytes(basicDer));
    if (basicAsn1.offset === -1) return 'unknown';
    const basic = new BasicOCSPResponse({ schema: basicAsn1.result });
    // Respondedor autorizado: o próprio emissor ou certificado por ele
    // emitido com EKU OCSPSigning.
    const responderCandidates = (basic.certs ?? []).filter((c): c is Certificate => c instanceof Certificate);
    const issuerKey = JSON.stringify(issuerView.cert.subject.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value]));
    const authorizedResponder = responderCandidates.find((candidate) => {
      const issuedByIssuer = JSON.stringify(candidate.issuer.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value])) === issuerKey;
      if (!issuedByIssuer) return false;
      if (candidate.subject.typesAndValues.length === issuerView.cert.subject.typesAndValues.length &&
        JSON.stringify(candidate.subject.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value])) === issuerKey) return true;
      return (candidate.extensions ?? []).some((ext) => {
        if (ext.extnID !== '2.5.29.37') return false;
        const purposes = (ext as { parsedValue?: { keyPurposes?: string[] } }).parsedValue?.keyPurposes ?? [];
        return purposes.includes('1.3.6.1.5.5.7.3.9');
      });
    });
    if (!authorizedResponder && !responderCandidates.some((c) => c.subject.typesAndValues.length && JSON.stringify(c.subject.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value])) === issuerKey)) return 'unknown';
    const trustedResponder = authorizedResponder ?? issuerView.cert;
    const signatureOk = await basic.verify({ trustedCerts: [trustedResponder, issuerView.cert] } as never).catch(() => false);
    if (!signatureOk) return 'unknown';
    const wantedSerial = Buffer.from(certView.cert.serialNumber.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
    for (const single of basic.tbsResponseData.responses ?? []) {
      const singleSerial = Buffer.from(single.certID.serialNumber.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
      if (singleSerial !== wantedSerial) continue;
      // CHOICE context-specific: good[0], revoked[1], unknown[2].
      const tag = single.certStatus?.idBlock?.tagClass === 3 ? single.certStatus.idBlock.tagNumber : -1;
      if (tag === 1) return 'revoked';
      if (tag !== 0) return 'unknown';
      const thisUpdate = single.thisUpdate instanceof Date ? single.thisUpdate.getTime() : NaN;
      if (!Number.isFinite(thisUpdate) || thisUpdate > input.nowMs + 300_000) return 'unknown';
      const nextUpdate = single.nextUpdate instanceof Date ? single.nextUpdate.getTime() : null;
      if (nextUpdate !== null && nextUpdate < input.nowMs) return 'unknown';
      return 'good';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export type ValidateExternalInput = {
  exportBytes: Uint8Array;
  returnBytes: Uint8Array;
  trustedRootPems: string[];
  expected?: ExpectedSigner;
  now?: Date;
  revocationTimeoutMs?: number;
};

const MESSAGE_DIGEST_OID = '1.2.840.113549.1.9.4';

/** Extrai o messageDigest dos atributos assinados de um CMS (ou null). */
async function cmsMessageDigest(cmsBytes: Uint8Array): Promise<string | null> {
  try {
    const asn1 = fromBER(exactBytes(cmsBytes));
    if (asn1.offset === -1) return null;
    const contentInfo = new ContentInfo({ schema: asn1.result });
    if (contentInfo.contentType !== '1.2.840.113549.1.7.2') return null;
    const signedData = new SignedData({ schema: contentInfo.content });
    const signerInfo = signedData.signerInfos?.[0];
    const signedAttrs = signerInfo?.signedAttrs;
    if (!signedAttrs) return null;
    for (const attr of signedAttrs.attributes) {
      if (attr.type === MESSAGE_DIGEST_OID) {
        return Buffer.from(attr.values[0]!.valueBlock.valueHexView).toString('hex');
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function validateExternalReturn(input: ValidateExternalInput): Promise<ExternalValidationReport> {
  const { exportBytes, returnBytes } = input;
  const now = input.now ?? new Date();
  const base = blankReport(exportBytes, returnBytes);

  if (bytesEqual(exportBytes, returnBytes)) {
    return fail(base, 'no_new_signature', 'invalid');
  }
  if (returnBytes.byteLength < 5 || latin1(returnBytes.subarray(0, 5)) !== '%PDF-') {
    return fail(base, 'not_a_pdf', 'unsupported');
  }
  // Continuidade incremental: o retorno precisa começar com todos os bytes
  // exportados (ADR 0004). Sem isso, é outra cadeia — nunca faz merge.
  if (returnBytes.byteLength <= exportBytes.byteLength || !bytesEqual(returnBytes.subarray(0, exportBytes.byteLength), exportBytes)) {
    return fail(base, 'not_derived_from_export', 'invalid');
  }
  base.prefixPreserved = true;

  const exportPairs = resolveSignaturePairs(exportBytes);
  const returnPairs = resolveSignaturePairs(returnBytes);
  base.exportSignatures = exportPairs.length;
  base.returnSignatures = returnPairs.length;
  base.detectedSignatureCount = returnPairs.length;
  if (returnPairs.length === 0) {
    return fail(base, 'no_embedded_signature', 'invalid');
  }
  if (returnPairs.length <= exportPairs.length) {
    return fail(base, 'no_new_signature', 'invalid');
  }
  base.newSignature = true;
  const newest = returnPairs[returnPairs.length - 1]!;
  base.subFilter = newest.subFilter;
  if (newest.subFilter && !/pkcs7/i.test(newest.subFilter)) {
    return fail(base, 'unsupported_subfilter', 'unsupported');
  }

  // Prova de cobertura: os intervalos declarados precisam corresponder
  // exatamente ao buraco do /Contents ('<' em b, '>' em c-1) e o segundo
  // intervalo precisa alcançar o fim do arquivo (só espaços em branco após).
  const [a, b, c, d] = newest.byteRange;
  const cmsLen = newest.cmsBytes.byteLength;
  const gapIsWellFormed = a === 0 && b > 0 && c - b === cmsLen * 2 + 2 && returnBytes[b] === 0x3c && returnBytes[c - 1] === 0x3e;
  let trailingOnlyWhitespace = true;
  for (let i = c + d; i < returnBytes.byteLength; i++) {
    const byte = returnBytes[i]!;
    if (byte !== 0x0a && byte !== 0x0d && byte !== 0x20 && byte !== 0x09) { trailingOnlyWhitespace = false; break; }
  }
  if (!(gapIsWellFormed && c + d <= returnBytes.byteLength && trailingOnlyWhitespace)) {
    return fail({ ...base, coverageValid: false }, 'byte_range_coverage', 'invalid');
  }
  base.coverageValid = true;

  // Revalida assinaturas anteriores (cobertura + digest do CMS de cada
  // uma), sem exigir cadeia: prova que a cadeia preservada segue íntegra.
  let previousOk: boolean | null = exportPairs.length === 0 ? true : null;
  if (exportPairs.length > 0) {
    previousOk = true;
    for (const pair of returnPairs.slice(0, -1)) {
      const content = rangeContent(returnBytes, pair.byteRange);
      const expectedDigest = await cmsMessageDigest(pair.cmsBytes);
      if (!content || !expectedDigest || sha256Hex(content).toLowerCase() !== expectedDigest.toLowerCase()) {
        previousOk = false;
        break;
      }
    }
  }
  base.previousSignaturesOk = previousOk;

  const signedContent = rangeContent(returnBytes, newest.byteRange)!;
  const computedDigest = sha256Hex(signedContent);

  let signedData: SignedData;
  try {
    const asn1 = fromBER(exactBytes(newest.cmsBytes));
    if (asn1.offset === -1) throw new Error('cms_der');
    const contentInfo = new ContentInfo({ schema: asn1.result });
    if (contentInfo.contentType !== '1.2.840.113549.1.7.1' && contentInfo.contentType !== '1.2.840.113549.1.7.2') throw new Error('cms_content_type');
    signedData = new SignedData({ schema: contentInfo.content });
  } catch {
    return fail(base, 'cms_unparsable', 'invalid');
  }

  if (!signedData.certificates?.length || !signedData.signerInfos?.length) {
    return fail(base, 'cms_missing_certs_or_signers', 'invalid');
  }
  const signerInfo = signedData.signerInfos[0]!;
  // pkijs v3 expõe o SignerIdentifier diretamente (IssuerAndSerialNumber
  // com `issuer` + `serialNumber`, ou SubjectKeyIdentifier como bytes).
  const signerSid = signerInfo.sid as unknown as {
    issuer?: { typesAndValues: Array<{ type: string; value: { valueBlock: { value: unknown } } }> };
    serialNumber?: { valueBlock: { valueHexView: ArrayBuffer } };
  };
  let signerCertDer: Uint8Array | null = null;
  if (signerSid?.issuer && signerSid?.serialNumber) {
    const issuerKey = JSON.stringify(signerSid.issuer.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value]));
    const serialHex = Buffer.from(signerSid.serialNumber.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
    for (const entry of signedData.certificates) {
      if (!(entry instanceof Certificate)) continue;
      const candidateKey = JSON.stringify(entry.issuer.typesAndValues.map((t: any) => [t.type, t.value.valueBlock.value]));
      const candidateSerial = Buffer.from(entry.serialNumber.valueBlock.valueHexView).toString('hex').replace(/^0+/, '');
      if (candidateKey === issuerKey && candidateSerial === serialHex) {
        signerCertDer = new Uint8Array(entry.toSchema().toBER(false));
        break;
      }
    }
  }
  if (!signerCertDer) {
    return fail(base, 'signer_cert_not_embedded', 'invalid');
  }
  const signerView = await toCertView(signerCertDer);
  if (!signerView) {
    return fail(base, 'signer_cert_unparsable', 'invalid');
  }
  base.certificateFingerprint = signerView.fingerprint;

  // messageDigest dos atributos assinados precisa ser o digest do conteúdo.
  const attrDigest = await cmsMessageDigest(newest.cmsBytes);
  if (!attrDigest || attrDigest.toLowerCase() !== computedDigest.toLowerCase()) {
    return fail(base, 'digest_mismatch', 'invalid');
  }
  base.digestMatch = true;

  // Assinatura criptográfica sobre os atributos (criptografia real, sem stub).
  let cmsOk = false;
  try {
    cmsOk = await signedData.verify({ signer: 0, data: exactBytes(signedContent), checkChain: false });
  } catch {
    cmsOk = false;
  }
  if (!cmsOk) {
    return fail(base, 'cms_signature_invalid', 'invalid');
  }
  base.cmsValid = true;

  const subject = signerView.cert.subject;
  const subjectValue = (oid: string): string | null => {
    const found = subject.typesAndValues.find((t: any) => t.type === oid);
    const raw = found?.value.valueBlock.value;
    return typeof raw === 'string' ? raw : null;
  };
  const serialRaw = subjectValue('2.5.4.5');
  const serialDigits = serialRaw ? serialRaw.replace(/\D/g, '') : null;
  const emails = new Set<string>();
  const directEmail = subjectValue('1.2.840.113549.1.9.1');
  if (directEmail) emails.add(directEmail);
  try {
    for (const ext of signerView.cert.extensions ?? []) {
      if (ext.extnID === '2.5.29.17') {
        const raw = Buffer.from(ext.extnValue.valueBlock.valueHexView).toString('latin1');
        for (const m of raw.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) emails.add(m[0]);
      }
    }
  } catch {
    // Mantém os e-mails já extraídos.
  }
  base.signer = {
    commonName: subjectValue('2.5.4.3'),
    serialDigits,
    emails: [...emails],
    notBefore: signerView.notBefore.toISOString(),
    notAfter: signerView.notAfter.toISOString(),
  };

  if (!(signerView.notBefore <= now && now <= signerView.notAfter)) {
    return fail(base, 'certificate_not_valid', 'invalid');
  }

  // Cadeia até raízes configuradas (verificação de cada elo).
  const roots = parseTrustedRoots(input.trustedRootPems);
  const rootViews: CertView[] = [];
  for (const root of roots) {
    const view = await toCertView(root.der);
    if (view) rootViews.push(view);
  }
  const embeddedViews: CertView[] = [];
  for (const entry of signedData.certificates) {
    if (!(entry instanceof Certificate)) continue;
    const view = await toCertView(new Uint8Array(entry.toSchema().toBER(false)));
    if (view) embeddedViews.push(view);
  }
  let chainTrusted = rootViews.some((root) => root.fingerprint === signerView.fingerprint);
  let signerIssuer: CertView | null = chainTrusted ? signerView : null;
  if (!chainTrusted) {
    let cursor: CertView | null = signerView;
    const seen = new Set<string>([signerView.fingerprint]);
    for (let depth = 0; depth < 8 && cursor; depth++) {
      const directRoot = rootViews.find((root) => root.subjectKey === cursor!.issuerKey);
      if (directRoot) {
        if (await verifyCertSignature(cursor, directRoot)) {
          chainTrusted = true;
          if (depth === 0) signerIssuer = directRoot;
        }
        break;
      }
      const issuer = embeddedViews.find((candidate) => candidate.subjectKey === cursor!.issuerKey && !seen.has(candidate.fingerprint));
      if (!issuer) break;
      if (!(await verifyCertSignature(cursor, issuer))) break;
      if (!(issuer.notBefore <= now && now <= issuer.notAfter)) break;
      if (depth === 0) signerIssuer = issuer;
      seen.add(issuer.fingerprint);
      cursor = issuer;
    }
  }
  if (!chainTrusted) {
    base.chain = 'untrusted';
    return fail(base, 'untrusted_chain', 'indeterminate');
  }
  base.chain = 'trusted';

  const revocation = await checkRevocation(signerView, signerIssuer, input.revocationTimeoutMs ?? 6000);
  base.revocation = revocation;
  if (revocation === 'revoked') {
    return fail(base, 'cert_revoked', 'invalid');
  }
  if (revocation === 'unknown') {
    return fail(base, 'revocation_unchecked', 'indeterminate');
  }

  // Correspondência do signatário por identificadores verificados — nome
  // textual isolado nunca basta.
  const expected = input.expected ?? {};
  if (expected.cpfDigits) {
    if (!serialDigits || serialDigits !== expected.cpfDigits.replace(/\D/g, '')) {
      base.signerCorrespondence = 'mismatch';
      return fail(base, 'signer_mismatch', 'invalid');
    }
    base.signerCorrespondence = 'matched';
  } else if (expected.emails?.length) {
    const wanted = new Set(expected.emails.map((e) => e.toLowerCase()));
    const matched = [...emails].some((e) => wanted.has(e.toLowerCase()));
    if (!matched) {
      base.signerCorrespondence = 'mismatch';
      return fail(base, 'signer_mismatch', 'invalid');
    }
    base.signerCorrespondence = 'matched';
  } else {
    return fail(base, 'signer_unverifiable', 'indeterminate');
  }

  return { ...base, status: 'validated', reason: 'ok' };
}

/** Raízes confiáveis a partir de `GOVBR_TRUSTED_ROOTS` (PEM inline ou caminho). */
export function loadTrustedRootsFromEnv(env: Record<string, string | undefined>): string[] {
  const raw = env.GOVBR_TRUSTED_ROOTS;
  if (!raw) return [];
  if (raw.includes('-----BEGIN CERTIFICATE-----')) return [raw];
  return [];
}

export async function loadTrustedRootFiles(paths: string[]): Promise<string[]> {
  const { readFile } = await import('node:fs/promises');
  const out: string[] = [];
  for (const path of paths) {
    try {
      out.push(await readFile(path, 'utf8'));
    } catch {
      // Raiz ilegível não entra no trust store — a cadeia resultante será
      // indeterminada em vez de falsamente validada.
    }
  }
  return out;
}
