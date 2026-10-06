import { beforeAll, describe, expect, it } from 'bun:test';
import { resolveSignaturePairs, validateExternalReturn } from './external-validation';
import {
  buildSignedReturnPdf,
  buildUnparsableCmsReturn,
  createTestCa,
  ensureOpensslAvailable,
  issueTestSigner,
  tamperAfterExport,
  type TestCa,
  type TestSigner,
} from './external-test-fixtures';

const minimalPdf = (body = '1 0 obj\n<< >>\nendobj\n') =>
  new TextEncoder().encode(`%PDF-1.4\n${body}trailer\n<< /Size 1 >>\n`);

describe('External return validation (structural)', () => {
  it('rejects non-PDF content as unsupported', async () => {
    const report = await validateExternalReturn({
      exportBytes: minimalPdf(),
      returnBytes: new TextEncoder().encode('not a pdf at all, just longer text here'),
      trustedRootPems: [],
    });
    expect(report.status).toBe('unsupported');
    expect(report.reason).toBe('not_a_pdf');
  });

  it('rejects byte-identical re-upload without a new signature', async () => {
    const exportBytes = minimalPdf();
    const report = await validateExternalReturn({
      exportBytes,
      returnBytes: new Uint8Array(exportBytes),
      trustedRootPems: [],
    });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('no_new_signature');
  });

  it('rejects returns that do not derive from the exported revision', async () => {
    const report = await validateExternalReturn({
      exportBytes: minimalPdf('1 0 obj\n<< /A (one) >>\nendobj\n'),
      returnBytes: new TextEncoder().encode(`%PDF-1.4\n1 0 obj\n<< /A (two, tampered base with extra bytes to be longer) >>\nendobj\ntrailer\n<< /Size 1 >>\n`),
      trustedRootPems: [],
    });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('not_derived_from_export');
  });

  it('rejects unsigned returns without embedded signatures', async () => {
    const exportBytes = minimalPdf();
    const extended = new Uint8Array([...exportBytes, ...new TextEncoder().encode('% comentário incremental sem assinatura\n')]);
    const report = await validateExternalReturn({ exportBytes, returnBytes: extended, trustedRootPems: [] });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('no_embedded_signature');
  });

  it('locates signature pairs declared in the file', () => {
    const pdf = new TextEncoder().encode(
      `%PDF-1.4\n1 0 obj\n<< >>\nendobj\n2 0 obj\n<< /ByteRange [ 0 10 20 5 ] /Contents <AABBCC> >>\nendobj\n`,
    );
    const pairs = resolveSignaturePairs(pdf);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.byteRange).toEqual([0, 10, 20, 5]);
    expect(pairs[0]!.subFilter).toBeNull();
  });
});

const hasOpenssl = (() => {
  try {
    return !!Bun.which('openssl');
  } catch {
    return false;
  }
})();

describe.skipIf(!hasOpenssl)('External return validation (real CMS fixtures)', () => {
  let ca: TestCa;
  let signer: TestSigner;
  let exportBytes: Uint8Array;

  beforeAll(async () => {
    await ensureOpensslAvailable();
    ca = await createTestCa('validator-unit');
    signer = await issueTestSigner(ca, { commonName: 'Paciente Validação', cpfDigits: '52998224725', email: 'paciente@example.test' });
    exportBytes = minimalPdf();
  });

  it('validates a genuinely signed return against the test root', async () => {
    const returnBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const report = await validateExternalReturn({
      exportBytes, returnBytes,
      trustedRootPems: [ca.caPem],
      expected: { cpfDigits: '52998224725' },
    });
    expect(report.status).toBe('validated');
    expect(report.prefixPreserved).toBe(true);
    expect(report.newSignature).toBe(true);
    expect(report.coverageValid).toBe(true);
    expect(report.digestMatch).toBe(true);
    expect(report.cmsValid).toBe(true);
    expect(report.chain).toBe('trusted');
    expect(report.signerCorrespondence).toBe('matched');
    expect(report.signer?.serialDigits).toBe('52998224725');
    expect(report.certificateFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects tampered content with digest mismatch', async () => {
    const returnBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const tampered = tamperAfterExport(returnBytes, exportBytes.byteLength);
    const report = await validateExternalReturn({
      exportBytes, returnBytes: tampered,
      trustedRootPems: [ca.caPem],
      expected: { cpfDigits: '52998224725' },
    });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('digest_mismatch');
  });

  it('holds as indeterminate against an unrelated trust store', async () => {
    const other = await createTestCa('validator-unit-other');
    const returnBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const report = await validateExternalReturn({
      exportBytes, returnBytes,
      trustedRootPems: [other.caPem],
      expected: { cpfDigits: '52998224725' },
    });
    expect(report.status).toBe('indeterminate');
    expect(report.reason).toBe('untrusted_chain');
    expect(report.cmsValid).toBe(true);
  });

  it('rejects a signer that does not correspond to the participant', async () => {
    const returnBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const report = await validateExternalReturn({
      exportBytes, returnBytes,
      trustedRootPems: [ca.caPem],
      expected: { cpfDigits: '00000000000' },
    });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('signer_mismatch');
  });

  it('leaves signer correspondence unverifiable without expected identifiers', async () => {
    const returnBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const report = await validateExternalReturn({ exportBytes, returnBytes, trustedRootPems: [ca.caPem] });
    expect(report.status).toBe('indeterminate');
    expect(report.reason).toBe('signer_unverifiable');
    expect(report.cmsValid).toBe(true);
    expect(report.chain).toBe('trusted');
  });

  it('rejects unparsable CMS content without promoting', async () => {
    const returnBytes = buildUnparsableCmsReturn(exportBytes);
    const report = await validateExternalReturn({
      exportBytes, returnBytes,
      trustedRootPems: [ca.caPem],
      expected: { cpfDigits: '52998224725' },
    });
    expect(report.status).toBe('invalid');
    expect(report.reason).toBe('cms_unparsable');
  });
});

describe('OCSP revocation against real responder bytes', () => {
  const fixtureDir = new URL('./fixtures/external/', import.meta.url).pathname;
  const pemToDer = (pem: string) => Uint8Array.from(Buffer.from(pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, ''), 'base64'));

  it('accepts a good OCSP response signed by the authorized responder', async () => {
    const { verifyOcspResponse } = await import('./external-validation');
    const caDer = pemToDer(await Bun.file(`${fixtureDir}ca.pem`).text());
    const signerDer = pemToDer(await Bun.file(`${fixtureDir}signer.pem`).text());
    const responseDer = new Uint8Array(await Bun.file(`${fixtureDir}resp-good.der`).arrayBuffer());
    const outcome = await verifyOcspResponse({ certDer: signerDer, issuerDer: caDer, responseDer, nowMs: Date.now() });
    expect(outcome).toBe('good');
  });

  it('rejects a revoked certificate without promoting', async () => {
    const { verifyOcspResponse } = await import('./external-validation');
    const caDer = pemToDer(await Bun.file(`${fixtureDir}ca.pem`).text());
    const signerDer = pemToDer(await Bun.file(`${fixtureDir}signer.pem`).text());
    const responseDer = new Uint8Array(await Bun.file(`${fixtureDir}resp-revoked.der`).arrayBuffer());
    const outcome = await verifyOcspResponse({ certDer: signerDer, issuerDer: caDer, responseDer, nowMs: Date.now() });
    expect(outcome).toBe('revoked');
  });

  it('holds as unknown on tampered or foreign responses', async () => {
    const { verifyOcspResponse } = await import('./external-validation');
    const caDer = pemToDer(await Bun.file(`${fixtureDir}ca.pem`).text());
    const signerDer = pemToDer(await Bun.file(`${fixtureDir}signer.pem`).text());
    const good = new Uint8Array(await Bun.file(`${fixtureDir}resp-good.der`).arrayBuffer());
    const tampered = new Uint8Array(good);
    tampered[tampered.byteLength - 10] = (tampered[tampered.byteLength - 10]! + 1) % 256;
    expect(await verifyOcspResponse({ certDer: signerDer, issuerDer: caDer, responseDer: tampered, nowMs: Date.now() })).toBe('unknown');
    const otherCa = pemToDer((await (await import('./external-test-fixtures')).createTestCa('ocsp-foreign')).caPem);
    expect(await verifyOcspResponse({ certDer: signerDer, issuerDer: otherCa, responseDer: good, nowMs: Date.now() })).toBe('unknown');
  });
});
