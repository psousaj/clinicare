import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import SignaturePad from 'signature_pad';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { anySchema } from '@/lib/schemas';
import { z } from 'zod';

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
}

export const Route = createFileRoute('/assinatura/$token')({ component: SignaturePage });

const signatureSchema = z.looseObject({
  participantId: z.string(), role: z.string(), status: z.string(), expiresAt: z.string(),
  phoneVerificationRequired: z.boolean().optional(),
  document: z.looseObject({ id: z.string(), revisionId: z.string(), version: z.number(), hash: z.string(), size: z.number(), url: z.string() }).optional(),
  contract: z.looseObject({ id: z.string(), title: z.string(), version: z.number(), content: z.string().nullish() }).optional(),
});
type Signature = z.infer<typeof signatureSchema>;
type PageGeometry = { width: number; height: number };
type Position = { x: number; y: number; width: number; height: number };

function SignaturePage() {
  const { token } = Route.useParams();
  const [verified, setVerified] = useState(false);
  const [phoneLast4, setPhoneLast4] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signature = useQuery({ queryKey: ['signature', token], retry: false, queryFn: () => api(`/public/signatures/${token}`, { schema: signatureSchema, fallbackError: 'Link inválido, expirado ou já enviado.' }) });
  const verify = useMutation({
    mutationFn: () => api(`/public/signatures/${token}/verify-phone`, { method: 'POST', body: { phoneLast4 }, schema: anySchema }),
    onSuccess: () => { setVerified(true); void signature.refetch(); },
    onError: (reason: Error) => setError(reason.message),
  });

  useEffect(() => {
    if (signature.data && !signature.data.phoneVerificationRequired) setVerified(true);
  }, [signature.data]);

  if (signature.isPending) return <PublicShell><p>Carregando contrato…</p></PublicShell>;
  if (signature.isError) return <PublicShell><p className="text-destructive" role="alert">{signature.error.message}</p></PublicShell>;
  if (!signature.data) return null;
  if (!verified || signature.data.phoneVerificationRequired) return <PhoneGate value={phoneLast4} onChange={setPhoneLast4} onSubmit={() => { setError(null); verify.mutate(); }} pending={verify.isPending} error={error} />;
  if (!signature.data.document) return <PublicShell><p>O documento PDF ainda não está disponível.</p></PublicShell>;
  return <SigningWorkspace token={token} signature={signature.data} />;
}

function PhoneGate({ value, onChange, onSubmit, pending, error }: { value: string; onChange: (value: string) => void; onSubmit: () => void; pending: boolean; error: string | null }) {
  return <PublicShell><section className="public-form-card max-w-md"><div className="section-kicker">CONFIRMAÇÃO DO PACIENTE</div><h1>Confirme seu telefone</h1><p>Informe os quatro últimos dígitos do telefone cadastrado pela clínica para acessar o contrato.</p><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="grid gap-4"><label className="grid gap-2 text-sm font-medium" htmlFor="phone-last4">Últimos quatro dígitos<Input id="phone-last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button type="submit" disabled={pending || value.length !== 4}>{pending ? 'Verificando…' : 'Acessar contrato'}</Button></form></section></PublicShell>;
}

function SigningWorkspace({ token, signature }: { token: string; signature: Signature }) {
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pageGeometries, setPageGeometries] = useState<PageGeometry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, width: 180, height: 86 });
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<unknown>({ unavailable: true });
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let disposed = false;
    void import('@fingerprintjs/fingerprintjs').then(async ({ default: FingerprintJS }) => {
      try { const agent = await FingerprintJS.load(); const result = await agent.get(); if (!disposed) setFingerprint({ visitorId: result.visitorId, version: 'fingerprintjs-oss-5' }); } catch { /* complementary evidence */ }
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        const pdf = await getDocument({ url: signature.document!.url }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const geometries: PageGeometry[] = [];
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const pdfPage = await pdf.getPage(index);
          const viewport = pdfPage.getViewport({ scale: 1.2 });
          const canvas = pageRefs.current[index - 1]?.querySelector('canvas');
          if (!canvas) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await pdfPage.render({ canvas, viewport }).promise;
          geometries.push({ width: viewport.width, height: viewport.height });
        }
        if (!cancelled) setPageGeometries(geometries);
      } catch { if (!cancelled) setPdfError('Não foi possível renderizar o PDF.'); }
    }
    void renderPdf();
    return () => { cancelled = true; };
  }, [signature.document?.url, pageCount]);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(canvas.offsetWidth, 1) * ratio;
    canvas.height = Math.max(canvas.offsetHeight, 1) * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.2, penColor: '#194d40' });
    padRef.current = pad;
    return () => { pad.off(); padRef.current = null; };
  }, []);

  useEffect(() => {
    const geometry = pageGeometries[page];
    if (!geometry) return;
    setPosition((current) => ({ ...current, x: Math.min(current.x, Math.max(0, geometry.width - current.width)), y: Math.min(current.y, Math.max(0, geometry.height - current.height)), width: Math.min(current.width, geometry.width), height: Math.min(current.height, geometry.height) }));
  }, [page, pageGeometries]);

  function placement() {
    const geometry = pageGeometries[page];
    return { page, x: position.x / geometry.width, y: position.y / geometry.height, width: position.width / geometry.width, height: position.height / geometry.height };
  }
  function capture() {
    if (!padRef.current || padRef.current.isEmpty()) { setMessage('Desenhe sua assinatura antes de continuar.'); return; }
    setImage(padRef.current.toDataURL('image/png'));
  }
  function clear() { padRef.current?.clear(); setImage(null); }
  async function confirm() {
    if (!image || !consentGiven) { setMessage('Desenhe e confirme o aceite antes de continuar.'); return; }
    setMessage(null);
    try {
      await api(`/public/signatures/${token}/confirm`, { method: 'POST', body: { evidence: { documentId: signature.document!.id, baseRevisionId: signature.document!.revisionId, signaturePng: image, placement: placement(), idempotencyKey, fingerprint, confirmed: true, acceptanceText: 'Confirmo a assinatura visual deste contrato.' } }, schema: anySchema });
      setSubmitted(true);
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null;
      setMessage(apiError?.message ?? 'Não foi possível confirmar a assinatura. Revise a revisão atual e tente novamente.');
    }
  }

  if (submitted) return <PublicShell><section className="public-form-card"><h1>Assinatura registrada</h1><p>O contrato foi confirmado e a clínica recebeu o registro da operação.</p></section></PublicShell>;
  const geometry = pageGeometries[page];
  return <PublicShell><main className="mx-auto grid max-w-5xl gap-5"><header><div className="section-kicker">ASSINATURA ELETRÔNICA</div><h1>{signature.contract?.title ?? 'Contrato aplicado'}</h1><p>Revise todas as páginas, desenhe sua assinatura e confirme quando estiver satisfeito.</p></header><section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="overflow-auto rounded-2xl border bg-white p-3 shadow-sm"><div className="mb-3 flex flex-wrap gap-2" aria-label="Páginas do contrato">{Array.from({ length: pageCount }, (_, index) => <Button key={index} type="button" size="sm" variant={index === page ? 'default' : 'outline'} onClick={() => setPage(index)}>Página {index + 1}</Button>)}</div>{pdfError && <p className="mb-3 text-sm text-destructive" role="alert">{pdfError}</p>}<div ref={(element) => { pageRefs.current[page] = element; }} className="relative mx-auto w-fit"><canvas className="block max-w-full" aria-label={`Página ${page + 1} do contrato PDF`} />{geometry && <Rnd bounds="parent" size={{ width: position.width, height: position.height }} position={{ x: position.x, y: position.y }} minWidth={80} minHeight={40} maxWidth={geometry.width * 0.8} maxHeight={geometry.height * 0.5} onDragStop={(_, data) => setPosition((old) => ({ ...old, x: data.x, y: data.y }))} onResizeStop={(_, __, ref, ___, data) => setPosition({ x: data.x, y: data.y, width: ref.offsetWidth, height: ref.offsetHeight })} className="border-2 border-dashed border-[#26785f] bg-[#e8f2ed]/70" aria-label="Posição da assinatura"><span className="p-1 text-xs font-semibold text-[#194d40]">Sua assinatura</span></Rnd>}</div></div><aside className="public-form-card h-fit"><h2>Assinatura</h2><canvas ref={signatureCanvasRef} className="mt-3 h-40 w-full touch-none rounded-xl border bg-white" aria-label="Área para desenhar sua assinatura" /><div className="mt-3 flex gap-2"><Button type="button" variant="outline" onClick={clear}>Limpar</Button><Button type="button" onClick={capture}>Usar assinatura</Button></div>{image && <p className="mt-3 text-sm text-muted-foreground">Assinatura pronta. Você pode reposicioná-la e redimensioná-la no PDF.</p>}<label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} /><span>Confirmo que revisei o contrato e autorizo o registro da assinatura visual.</span></label>{message && <p className="mt-3 text-sm text-destructive" role="alert">{message}</p>}<Button className="mt-4 w-full" type="button" disabled={!image || !consentGiven || !geometry} onClick={() => void confirm()}>Confirmar assinatura</Button></aside></section></main></PublicShell>;
}

function PublicShell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#25312d] md:px-8 md:py-12">{children}</div>; }
