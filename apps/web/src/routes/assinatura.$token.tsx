import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignaturePadField, type SignaturePadHandle } from '@/components/signing/SignaturePadField';
import { SigningSteps } from '@/components/signing/SignChecklist';
import { ApiError, api } from '@/lib/api';
import { anySchema } from '@/lib/schemas';
import { collectFingerprint } from '@/lib/fingerprint';
import { createIdempotencyKey } from '@/lib/idempotency';
import { z } from 'zod';

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
}

export const Route = createFileRoute('/assinatura/$token')({ component: SignaturePage });

const signatureSchema = z.looseObject({
  participantId: z.string(), role: z.string(), status: z.string(), expiresAt: z.string(),
  phoneVerificationRequired: z.boolean().optional(),
  hasExternalSignatures: z.boolean().optional(),
  document: z.looseObject({ id: z.string(), revisionId: z.string(), version: z.number(), hash: z.string(), size: z.number(), url: z.string() }).optional(),
  contract: z.looseObject({ id: z.string(), title: z.string(), version: z.number(), content: z.string().nullish() }).optional(),
});
type Signature = z.infer<typeof signatureSchema>;
type PageGeometry = { width: number; height: number };

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

type Step = 'read' | 'sign' | 'confirm';
type RelativePlacement = { pageIndex: number; x: number; y: number; width: number; height: number };

const DRAFT_STORAGE_KEY = (token: string) => `clinicare:sign-draft:${token}`;

function readStoredDraft(token: string): string | null {
  try {
    return sessionStorage.getItem(DRAFT_STORAGE_KEY(token));
  } catch {
    return null;
  }
}

function storeDraft(token: string, image: string | null) {
  try {
    if (image) sessionStorage.setItem(DRAFT_STORAGE_KEY(token), image);
    else sessionStorage.removeItem(DRAFT_STORAGE_KEY(token));
  } catch {
    // modo privado: segue sem persistência
  }
}

// Fluxo em 3 passos (ler → assinar → confirmar): o paciente sempre sabe
// onde está e o que falta. A prévia do PDF continua obrigatória no
// backend, mas virou etapa automática da confirmação em vez de botão
// separado; o posicionamento é automático no rodapé da última página,
// com ajuste manual opcional.
function SigningWorkspace({ token, signature }: { token: string; signature: Signature }) {
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewerScrollRef = useRef<HTMLDivElement>(null);
  const viewerEndRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLLabelElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);
  const autoPreviewTried = useRef(false);
  const [step, setStep] = useState<Step>('read');
  const [pageGeometries, setPageGeometries] = useState<PageGeometry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [readPages, setReadPages] = useState<number[]>([]);
  const [image, setImage] = useState<string | null>(() => readStoredDraft(token));
  const [placement, setPlacement] = useState<RelativePlacement>({ pageIndex: 0, x: 0.08, y: 0.8, width: 0.36, height: 0.12 });
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<RelativePlacement | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showGovBr, setShowGovBr] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [fingerprint, setFingerprint] = useState<unknown>({ unavailable: true });
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const previewEvidenceRef = useRef<{ idempotencyKey: string; fingerprint: unknown; previewHash: string; placement: RelativePlacement } | null>(null);
  const previewGenerationRef = useRef(0);

  const progress = pageCount === 0 ? 0 : Math.min(1, readPages.length / pageCount);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    let disposed = false;
    void collectFingerprint().then((result) => { if (!disposed) setFingerprint(result); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (step !== 'read') return;
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdf = await getDocument({ url: signature.document!.url }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        const geometries: PageGeometry[] = [];
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const pdfPage = await pdf.getPage(index);
          const viewport = pdfPage.getViewport({ scale: 1.2 });
          geometries.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setPageGeometries(geometries);
        // Posição automática: rodapé da última página, nunca sobre o cabeçalho.
        setPlacement({ pageIndex: pdf.numPages - 1, x: 0.08, y: 0.8, width: 0.36, height: 0.12 });
      } catch { if (!cancelled) setPdfError('Não foi possível carregar o documento.'); }
    }
    void loadPdf();
    return () => { cancelled = true; pdfRef.current = null; };
  }, [signature.document?.url]);

  useEffect(() => {
    let cancelled = false;
    async function renderAll() {
      const pdf = pdfRef.current;
      if (!pdf || pageGeometries.length === 0) return;
      for (let index = 0; index < pageGeometries.length; index += 1) {
        const canvas = pageCanvasRefs.current[index];
        if (!canvas) continue;
        try {
          const pdfPage = await pdf.getPage(index + 1);
          const viewport = pdfPage.getViewport({ scale: 1.2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await pdfPage.render({ canvas, viewport }).promise;
        } catch { if (!cancelled) setPdfError('Não foi possível mostrar alguma página.'); }
        if (cancelled) return;
      }
    }
    void renderAll();
    return () => { cancelled = true; };
  }, [pageGeometries, step]);

  useEffect(() => {
    if (pageCount === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      setReadPages(Array.from({ length: pageCount }, (_, index) => index));
      return;
    }
    const seen = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.pageIndex);
        if (entry.isIntersecting && !seen.has(index)) {
          seen.add(index);
          setReadPages((prev) => (prev.includes(index) ? prev : [...prev, index]));
        }
        if (entry.isIntersecting) setCurrentPage(index);
      }
    }, { root: typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches ? viewerScrollRef.current : null, rootMargin: '-10% 0px -10% 0px', threshold: 0.2 });
    pageWrapperRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [pageCount, step]);

  function captureFromPad(): string | null {
    const pad = signaturePadRef.current;
    if (pad && !pad.isEmpty()) {
      const draw = pad.toDataURL();
      setImage(draw);
      storeDraft(token, draw);
      invalidatePreview();
      return draw;
    }
    return image;
  }

  function clear() {
    signaturePadRef.current?.clear();
    setImage(null);
    storeDraft(token, null);
    invalidatePreview();
  }

  function invalidatePreview() {
    previewGenerationRef.current += 1;
    previewEvidenceRef.current = null;
    setPreviewBusy(false);
    setPreviewUrl(null);
    setPreviewHash(null);
    setPreviewPlacement(null);
  }

  function goToSign() {
    setHint(null);
    if (readPages.length < pageCount) {
      viewerEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      viewerScrollRef.current?.scrollTo({ top: viewerScrollRef.current.scrollHeight, behavior: 'smooth' });
      setHint('Role até o final do documento para continuar.');
      return;
    }
    setStep('sign');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToConfirm() {
    const draw = captureFromPad();
    if (!draw) {
      setMessage('Desenhe sua assinatura para continuar.');
      signaturePadRef.current?.focus();
      return;
    }
    setMessage(null);
    setStep('confirm');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBackToStep(target: Step) {
    setHint(null);
    setMessage(null);
    autoPreviewTried.current = false;
    invalidatePreview();
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function runPreview(): Promise<{ idempotencyKey: string; fingerprint: unknown; previewHash: string; placement: RelativePlacement } | null> {
    if (!image) return null;
    const generation = previewGenerationRef.current;
    const imageForPreview = image;
    const placementForPreview = { ...placement };
    setPreviewBusy(true);
    setMessage(null);
    try {
      const fingerprintNow = await collectFingerprint();
      setFingerprint(fingerprintNow);
       const previewKey = createIdempotencyKey();
       setIdempotencyKey(previewKey);
       const response = await fetch(`/public/signatures/${token}/preview`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documentId: signature.document!.id, baseRevisionId: signature.document!.revisionId, signaturePng: imageForPreview, placement: placementForPreview, idempotencyKey: previewKey, fingerprint: fingerprintNow, acceptanceText: 'Confirmo a assinatura visual deste contrato.' }) });
       if (!response.ok) { if (generation === previewGenerationRef.current) setMessage('Não foi possível gerar a prévia. Verifique sua conexão e tente de novo.'); return null; }
       const previewBytes = await response.blob();
       const hash = response.headers.get('etag')?.replaceAll('"', '') ?? null;
       if (!hash) { if (generation === previewGenerationRef.current) setMessage('A prévia foi gerada sem identificação. Tente novamente.'); return null; }
       if (generation !== previewGenerationRef.current) return null;
       setPreviewUrl(URL.createObjectURL(previewBytes));
       setPreviewHash(hash);
       setPreviewPlacement(placementForPreview);
       const evidence = { idempotencyKey: previewKey, fingerprint: fingerprintNow, previewHash: hash, placement: placementForPreview };
      previewEvidenceRef.current = evidence;
      return evidence;
     } catch {
       if (generation === previewGenerationRef.current) {
         setMessage('Não foi possível gerar a prévia. Verifique sua conexão e tente de novo.');
         previewEvidenceRef.current = null;
       }
       return null;
     } finally {
       if (generation === previewGenerationRef.current) setPreviewBusy(false);
     }
  }

  useEffect(() => {
    if (step !== 'confirm' || !image || previewUrl || autoPreviewTried.current) return;
    autoPreviewTried.current = true;
    void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, image]);

  async function confirm() {
    if (!image) { setMessage('Desenhe sua assinatura antes de continuar.'); return; }
    if (!consentGiven) {
      setMessage('Marque a caixa “Li e concordo” para continuar.');
      consentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => consentInputRef.current?.focus({ preventScroll: true }), 180);
      return;
    }
    let evidence = previewEvidenceRef.current;
    if (!evidence || JSON.stringify(evidence.placement) !== JSON.stringify(placement)) {
      setMessage('Gerando a prévia final antes de assinar…');
      evidence = await runPreview();
      if (!evidence) return;
    }
    setMessage(null);
    setConfirmBusy(true);
    try {
      await api(`/public/signatures/${token}/confirm`, { method: 'POST', body: { evidence: { documentId: signature.document!.id, baseRevisionId: signature.document!.revisionId, signaturePng: image, placement: evidence.placement, idempotencyKey: evidence.idempotencyKey, fingerprint: evidence.fingerprint, previewHash: evidence.previewHash, confirmed: true, acceptanceText: 'Confirmo a assinatura visual deste contrato.' } }, schema: anySchema });
      setSignedAt(new Date().toISOString());
      setSubmitted(true);
      storeDraft(token, null);
      try {
        const payload = await api(`/public/signatures/${token}/history`, { schema: anySchema }) as { document?: { revisions?: Array<{ downloadUrl?: string | null }> } | null };
        const revisions = payload?.document?.revisions ?? [];
        setDownloadUrl(revisions.at(-1)?.downloadUrl ?? null);
      } catch { /* download é opcional */ }
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null;
      setMessage(apiError?.status === 409 ? 'O documento foi atualizado antes da confirmação. Recarregue a página para revisar a versão atual.' : apiError?.message ?? 'Não foi possível concluir. Tente de novo sem sair da página.');
    } finally {
      setConfirmBusy(false);
    }
  }

  function handlePlacementChange(position: { x: number; y: number; width?: number; height?: number }) {
    setPlacement((current) => ({ ...current, ...position }));
    // A moved/resized box needs a fresh candidate preview before confirmation.
    invalidatePreview();
  }

  if (signature.status === 'signed') {
    return <PublicShell><section className="public-form-card mx-auto max-w-xl text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#e8f2ed] text-2xl text-[#26785f]" aria-hidden="true">✓</div><h1>Você já assinou este documento</h1><p>Não é preciso fazer nada — a clínica já recebeu o seu registro.</p></section></PublicShell>;
  }

  if (submitted) {
    return (
      <PublicShell>
        <section className="public-form-card mx-auto max-w-xl text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#e8f2ed] text-2xl text-[#26785f]" aria-hidden="true">✓</div>
          <h1>Documento assinado!</h1>
          <p>{signature.contract?.title ?? 'Contrato'} · {signedAt ? new Date(signedAt).toLocaleString('pt-BR') : ''}</p>
          <p>A clínica já foi avisada.</p>
          {downloadUrl && <p><a className="underline" href={downloadUrl}>Baixar PDF assinado</a></p>}
        </section>
      </PublicShell>
    );
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: 'read', label: 'Revisar' },
    { id: 'sign', label: 'Assinar' },
    { id: 'confirm', label: 'Concluir' },
  ];
  const stepIndex = steps.findIndex((item) => item.id === step);

  return (
    <PublicShell>
      <main className="mx-auto grid max-w-4xl gap-5">
        <header className="grid gap-4 border-b border-[#e3e9e4] pb-4">
          <div className="grid gap-2">
            <div className="section-kicker">ASSINATURA ELETRÔNICA</div>
            <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight text-[#1f2a26] sm:text-[32px]">{signature.contract?.title ?? 'Contrato aplicado'}</h1>
            <p className="m-0 text-base text-[#4a5a53]">Leia o documento abaixo e assine ao final. Leva menos de 2 minutos.</p>
            {signature.hasExternalSignatures && <p className="m-0 rounded-xl bg-[#eef5f1] px-3 py-2 text-sm font-medium text-[#194d40]" role="note">Este documento já contém assinatura externa validada. A sua entra no rodapé, sem cobrir as assinaturas anteriores.</p>}
          </div>
          <SigningSteps stepIndex={stepIndex} steps={steps} onBackStep={(index) => goBackToStep(steps[index]!.id)} />
        </header>
        <p className="sr-only" role="status">Passo {stepIndex + 1} de 3: {steps[stepIndex]?.label}</p>

        {step === 'read' && (
          <section aria-label="Leitura do documento">
            <div className="overflow-hidden rounded-2xl border border-[#e3e9e4] bg-white shadow-[0_1px_2px_rgba(20,40,30,0.04),0_16px_40px_-24px_rgba(20,40,30,0.25)] md:flex md:h-[calc(100dvh-18rem)] md:min-h-0 md:flex-col">
              <div className="flex items-center gap-3 border-b border-[#eef1ed] px-4 py-3 sm:px-5">
                <span className="flex-none whitespace-nowrap text-sm font-semibold tabular-nums text-[#1f2a26]" role="status">Página {Math.min(currentPage + 1, Math.max(pageCount, 1))} de {pageCount || '…'}</span>
                <span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-[#eef1ed]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso de leitura">
                  <span className="block h-full rounded-full bg-[#26785f] transition-[width] duration-300 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} />
                </span>
                {signature.document?.url && (
                  <a
                    className="-mr-2 inline-flex h-10 flex-none items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#26785f] no-underline transition-colors duration-150 hover:bg-[#eef5f1] hover:text-[#194d40]"
                    href={signature.document.url}
                    download
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v10m0 0 4-4m-4 4-4-4M4 16h12" /></svg>
                    Baixar PDF
                  </a>
                )}
              </div>
              <div ref={viewerScrollRef} className="bg-[#f2f4f1] px-3 py-4 sm:px-8 sm:py-6 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
                <div className="mx-auto grid max-w-[720px] gap-4">
                  {pdfError && <p className="m-0 rounded-xl bg-white p-3 text-sm text-[#b3261e]" role="alert">{pdfError}</p>}
                  {pageCount === 0 && !pdfError && <div className="aspect-[1/1.414] animate-pulse rounded-md bg-white/70" aria-hidden="true" />}
                  {Array.from({ length: pageCount }, (_, index) => (
                    <div key={index} ref={(el) => { pageWrapperRefs.current[index] = el; }} data-page-index={index} className="overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(20,40,30,0.05),0_2px_8px_-2px_rgba(20,40,30,0.12)]">
                      <canvas ref={(el) => { pageCanvasRefs.current[index] = el; }} className="block h-auto w-full" aria-label={`Página ${index + 1} de ${pageCount} do contrato`} />
                    </div>
                  ))}
                </div>
              </div>
              <div ref={viewerEndRef} className="flex flex-col gap-3 border-t border-[#eef1ed] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className={`m-0 text-sm ${hint ? 'font-semibold text-[#8a5a00]' : 'text-[#5b6b64]'}`} role="status">
                  {hint ?? (pageCount > 0 && readPages.length >= pageCount ? 'Tudo lido. Pode seguir para a assinatura.' : `${readPages.length} de ${pageCount || '…'} páginas lidas`)}
                </p>
                <Button type="button" className="hidden min-h-12 px-8 text-base md:inline-flex" onClick={goToSign}>Continuar para assinatura</Button>
              </div>
            </div>
          </section>
        )}

        {step === 'sign' && (
          <section className="grid gap-4" aria-label="Desenho da assinatura">
            <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 border-[#e3e9e4]">
              <p className="m-0 text-sm text-[#40524a]">Desenhe sua assinatura com o dedo ou o mouse. Se errar, toque em Limpar e tente de novo.</p>
              <p className="m-0 rounded-xl bg-[#fef6e4] p-3 text-sm text-[#7c4a03] md:hidden">Gire o celular na horizontal para assinar com mais espaço (opcional).</p>
              <SignaturePadField
                ref={signaturePadRef}
                initialImage={image}
                onStroke={(draw) => { setImage(draw); storeDraft(token, draw); invalidatePreview(); setMessage(null); }}
                onClear={clear}
                label="Área para desenhar sua assinatura"
                tall
                className="border-2 border-[#26785f] bg-white"
              />
              {message && step === 'sign' && <p className="m-0 text-sm font-medium text-[#b3261e]" role="alert">{message}</p>}
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-[#d8e2dc] bg-[#f7faf8] px-3.5 text-sm font-semibold text-[#26785f] transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-[#b9d3c0] hover:bg-[#eef5f1] hover:text-[#194d40] active:scale-[0.98]"
                  onClick={() => goBackToStep('read')}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10H5m4-4-4 4 4 4" /></svg>
                  Voltar à leitura
                </button>
                <div className="ml-auto flex items-center gap-3">
                  <Button type="button" variant="ghost" className="min-h-12 px-4" onClick={clear}>Limpar</Button>
                  <Button type="button" className="hidden min-h-12 px-8 md:inline-flex" onClick={goToConfirm}>Continuar</Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 'confirm' && (
          <section className="grid gap-4" aria-label="Confirmação da assinatura">
            <div className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6 border-[#e3e9e4] md:flex md:h-[calc(100dvh-18rem)] md:min-h-0 md:flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e3e9e4]">
                <div className="flex items-center justify-between gap-3 border-b border-[#e9ede8] bg-[#f7f8f5] px-3.5 py-3">
                  <p className="m-0 text-sm font-semibold text-[#25312d]">Prévia do documento final</p>
                </div>
                {previewBusy && !previewUrl && <p className="m-0 p-4 text-sm text-[#40524a]" role="status">Gerando a prévia do documento assinado…</p>}
                <PreviewPdf url={signature.document!.url} placement={placement} onPlacementChange={handlePlacementChange} />
              </div>
              <p className="m-0 flex items-center gap-2 text-sm text-[#5b6b64]">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 flex-none text-[#26785f]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7 3.5 9.5 6 12M14 7l2.5 2.5L14 12M11.5 5l-3 10" /></svg>
                Arraste a assinatura diretamente na página para ajustar a posição.
              </p>
              <label ref={consentRef} className="scroll-mt-28 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#e3e9e4] bg-[#fbfcfb] px-3.5 text-sm text-[#25312d] transition-colors hover:bg-[#f7faf8]">
                <input ref={consentInputRef} type="checkbox" className="size-5 flex-none accent-[#26785f]" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
                <span>Li e concordo com o termo acima.</span>
              </label>
              {message && <p className="m-0 text-sm font-medium text-[#b3261e]" role="alert">{message}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-[#d8e2dc] bg-white px-3.5 text-sm font-semibold text-[#5b6b64] transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-[#b9d3c0] hover:bg-[#f7faf8] hover:text-[#25312d] active:scale-[0.98]" onClick={() => goBackToStep('sign')}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10H5m4-4-4 4 4 4" /></svg>
                  Refazer assinatura
                </button>
                <Button type="button" className="hidden min-h-12 text-base md:inline-flex md:px-10" disabled={confirmBusy} onClick={() => void confirm()}>{confirmBusy ? 'Gerando documento assinado…' : 'Assinar documento'}</Button>
              </div>
            </div>
          </section>
        )}

        <div className="sticky bottom-3 z-10 md:hidden">
          <div className="grid gap-2 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur border-[#e3e9e4]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {step === 'read' && <Button type="button" className="min-h-12 w-full text-base" onClick={goToSign}>Continuar para assinatura</Button>}
            {step === 'sign' && <Button type="button" className="min-h-12 w-full text-base" onClick={goToConfirm}>Continuar</Button>}
            {step === 'confirm' && <Button type="button" className="min-h-12 w-full text-base" disabled={confirmBusy} onClick={() => void confirm()}>{confirmBusy ? 'Gerando documento assinado…' : 'Assinar documento'}</Button>}
          </div>
        </div>

        <footer className="grid gap-4 border-t border-[#e3e9e4] pt-5 md:gap-1 md:pt-2">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="inline-flex min-h-11 items-center gap-1.5 self-start border-0 bg-transparent p-0 text-left text-[#5b6b64] md:min-h-9" aria-expanded={showGovBr} onClick={() => setShowGovBr((value) => !value)}>
              Prefere o GOV.BR? <span className="font-semibold text-[#26785f] underline decoration-[#26785f]/30 underline-offset-4 transition-colors hover:decoration-[#26785f]">{showGovBr ? 'Ocultar GOV.BR' : 'Usar assinatura GOV.BR'}</span>
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-1.5 self-start border-0 bg-transparent p-0 font-semibold text-[#5b6b64] transition-colors hover:text-[#1f2a26] md:min-h-9" aria-expanded={showHistory} onClick={() => setShowHistory((value) => !value)}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" /></svg>
              {showHistory ? 'Ocultar histórico da assinatura' : 'Ver histórico da assinatura'}
            </button>
          </div>
          {showGovBr && <GovBrSection token={token} signature={signature} />}
          {showHistory && <SignatureHistorySection token={token} />}
          <p className="m-0 flex items-center gap-1.5 text-xs text-[#6b7a73]">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
            Documento seguro · registro com data e hora
          </p>
        </footer>
      </main>
    </PublicShell>
  );
}

type GovBrState =
  | { step: 'idle' }
  | { step: 'exported'; attemptId: string; exportHash: string }
  | { step: 'imported'; attemptId: string; receiptId: string; validationStatus: string; reason: string | null; signerName: string | null }
  | { step: 'done' };

function PreviewPdf({ url, placement, onPlacementChange }: { url: string; placement: RelativePlacement; onPlacementChange: (position: { x: number; y: number; width?: number; height?: number }) => void }) {
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument({ url });
    void loadingTask.promise.then((pdf) => {
      if (cancelled) {
        const destroy = (pdf as PDFDocumentProxy & { destroy?: () => Promise<void> }).destroy;
        if (destroy) void destroy.call(pdf);
        return;
      }
      pdfRef.current = pdf;
      setPageCount(pdf.numPages);
    }).catch(() => {
      if (!cancelled) setError('Não foi possível mostrar a prévia do documento.');
    });
    return () => {
      cancelled = true;
      pdfRef.current = null;
      if (typeof loadingTask.destroy === 'function') void loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    async function renderPages() {
      const pdf = pdfRef.current;
      if (!pdf || pageCount === 0) return;
      for (let index = 0; index < pageCount; index += 1) {
        const canvas = canvasRefs.current[index];
        if (!canvas) continue;
        try {
          const page = await pdf.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1.2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
        } catch {
          if (!cancelled) setError('Não foi possível mostrar alguma página da prévia.');
          return;
        }
        if (cancelled) return;
      }
    }
    void renderPages();
    return () => { cancelled = true; };
  }, [pageCount]);

  useEffect(() => {
    const page = pageRefs.current[placement.pageIndex];
    const viewer = viewerRef.current;
    if (!page || !viewer) return;
    const timer = window.setTimeout(() => {
      if (typeof viewer.scrollTo === 'function') viewer.scrollTo({ top: Math.max(0, page.offsetTop - viewer.clientHeight / 3) });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pageCount, placement.pageIndex]);

  if (error) return <p className="m-0 bg-[#fff7f7] p-4 text-sm text-[#b3261e]" role="alert">{error}</p>;
  if (pageCount === 0) return <div className="h-72 animate-pulse bg-[#f2f4f1]" aria-label="Carregando prévia" />;

  return (
    <div ref={viewerRef} className="max-h-[min(58vh,620px)] overflow-y-auto overscroll-contain bg-[#f2f4f1] px-3 py-4 sm:px-8 sm:py-6 md:min-h-0 md:flex-1 md:max-h-none">
      <div className="mx-auto grid max-w-[720px] gap-4">
        {Array.from({ length: pageCount }, (_, index) => (
          <div key={index} ref={(page) => { pageRefs.current[index] = page; }} data-preview-page className="relative overflow-visible rounded-md bg-white shadow-[0_0_0_1px_rgba(20,40,30,0.05),0_2px_8px_-2px_rgba(20,40,30,0.12)]">
            <canvas ref={(canvas) => { canvasRefs.current[index] = canvas; }} className="block h-auto w-full" aria-label={`Página ${index + 1} de ${pageCount} da prévia`} />
            {index === placement.pageIndex && <DraggableSignature placement={placement} onPlacementChange={onPlacementChange} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggableSignature({ placement, onPlacementChange }: { placement: RelativePlacement; onPlacementChange: (position: { x: number; y: number; width?: number; height?: number }) => void }) {
  type Interaction = { mode: 'drag' | 'resize'; corner?: string; pointerX: number; pointerY: number; x: number; y: number; width: number; height: number; pageWidth: number; pageHeight: number };

  function start(event: React.PointerEvent<HTMLElement>, mode: Interaction['mode'], corner?: string) {
    event.preventDefault();
    event.stopPropagation();
    const page = event.currentTarget.closest('[data-preview-page]');
    if (!page) return;
    const rect = page.getBoundingClientRect();
    // Keep the target outside the async pointerup handler. React may clear
    // the synthetic event's currentTarget after pointerdown, and the
    // signature overlay can also be re-rendered while it is being dragged.
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
    const startState: Interaction = { mode, corner, pointerX: event.clientX, pointerY: event.clientY, x: placement.x, y: placement.y, width: placement.width, height: placement.height, pageWidth: rect.width, pageHeight: rect.height };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startState.pointerX) / startState.pageWidth;
      const dy = (moveEvent.clientY - startState.pointerY) / startState.pageHeight;
      if (startState.mode === 'drag') {
        onPlacementChange({ x: Math.min(1 - startState.width, Math.max(0, startState.x + dx)), y: Math.min(1 - startState.height, Math.max(0, startState.y + dy)) });
        return;
      }
      const left = startState.corner?.includes('l');
      const top = startState.corner?.includes('t');
      const right = startState.corner?.includes('r');
      const bottom = startState.corner?.includes('b');
      const width = Math.max(0.12, Math.min(1, startState.width + (right ? dx : left ? -dx : 0)));
      const height = Math.max(0.06, Math.min(1, startState.height + (bottom ? dy : top ? -dy : 0)));
      const x = left ? Math.min(1 - width, Math.max(0, startState.x + dx)) : Math.min(1 - width, Math.max(0, startState.x));
      const y = top ? Math.min(1 - height, Math.max(0, startState.y + dy)) : Math.min(1 - height, Math.max(0, startState.y));
      onPlacementChange({ x, y, width, height });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      try {
        if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture?.(event.pointerId);
      } catch {
        // The overlay may have been unmounted before pointerup.
      }
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Posição da assinatura"
      aria-valuetext="Arraste para ajustar a assinatura"
      className="absolute z-10 grid cursor-grab touch-none place-items-center rounded-md border-2 border-dashed border-[#26785f] bg-[#e8f2ed]/85 px-2 text-center font-semibold text-[#194d40] shadow-sm [container-type:inline-size] active:cursor-grabbing"
      style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.width * 100}%`, height: `${placement.height * 100}%` }}
      onPointerDown={(event) => start(event, 'drag')}
    >
      <span className="pointer-events-none whitespace-nowrap text-[clamp(6px,6cqw,12px)]">Sua assinatura</span>
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <span key={corner} className={`absolute size-3 rounded-sm border-2 border-[#26785f] bg-white ${corner.includes('t') ? 'top-[-6px]' : 'bottom-[-6px]'} ${corner.includes('l') ? 'left-[-6px]' : 'right-[-6px]'} ${corner === 'tl' || corner === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} onPointerDown={(event) => start(event, 'resize', corner)} aria-hidden="true" />
      ))}
    </div>
  );
}

function GovBrSection({ token, signature }: { token: string; signature: Signature }) {
  const [state, setState] = useState<GovBrState>({ step: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function postJson(path: string, body: unknown) {
    const response = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload as { error?: string }).error ?? 'Operação indisponível no momento.');
    return payload as Record<string, unknown>;
  }

  async function exportRevision() {
    setBusy(true); setError(null);
    try {
      const fingerprint = await collectFingerprint();
      const payload = await postJson(`/public/signatures/${token}/external/export`, {
        documentId: signature.document!.id, baseRevisionId: signature.document!.revisionId,
        idempotencyKey: createIdempotencyKey(), fingerprint,
      });
      setState({ step: 'exported', attemptId: payload.attemptId as string, exportHash: payload.exportHash as string });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível reservar a exportação.');
    } finally {
      setBusy(false);
    }
  }

  async function importReturn(file: File, attemptId: string) {
    setBusy(true); setError(null);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      const fingerprint = await collectFingerprint();
      const payload = await postJson(`/public/signatures/${token}/external/import`, { attemptId, pdfBase64: btoa(binary), fingerprint });
      setState({
        step: 'imported', attemptId, receiptId: payload.receiptId as string,
        validationStatus: payload.validationStatus as string, reason: (payload.reason as string | null) ?? null,
        signerName: ((payload.signer as { commonName?: string } | null)?.commonName) ?? null,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível importar o retorno.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptReturn(attemptId: string) {
    setBusy(true); setError(null);
    try {
      const fingerprint = await collectFingerprint();
      await postJson(`/public/signatures/${token}/external/confirm`, {
        attemptId, idempotencyKey: createIdempotencyKey(), fingerprint,
        acceptanceText: 'Confirmo a assinatura realizada no GOV.BR', confirmed: true,
      });
      setState({ step: 'done' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar a assinatura externa.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelAttempt(attemptId: string) {
    setBusy(true); setError(null);
    try {
      await postJson(`/public/signatures/${token}/external/cancel`, { attemptId });
      setState({ step: 'idle' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível cancelar a tentativa.');
    } finally {
      setBusy(false);
    }
  }

  if (state.step === 'done') {
    return <section className="public-form-card" aria-label="Assinatura pelo GOV.BR"><h2>Assinatura pelo GOV.BR</h2><p>Retorno validado e incorporado ao contrato. A clínica recebeu o registro da operação. Novas assinaturas devem ser posicionadas sem cobrir esta.</p></section>;
  }
  return <section className="public-form-card" aria-label="Assinatura pelo GOV.BR">
    <h2>Assinar pelo GOV.BR</h2>
    <p>Alternativa à assinatura desenhada: baixe a revisão atual, assine no portal oficial do GOV.BR sem informar senhas aqui e importe o PDF retornado na mesma tentativa. Somente retornos validados concluem a etapa.</p>
    {state.step === 'idle' && <Button className="mt-4" type="button" disabled={busy} onClick={() => void exportRevision()}>{busy ? 'Reservando…' : 'Exportar revisão para o GOV.BR'}</Button>}
    {state.step === 'exported' && <div className="mt-4 grid gap-3">
      <p className="text-sm">Revisão reservada. <a className="underline" href={`/public/signatures/${token}/external/${state.attemptId}/file`}>Baixar o PDF exato da revisão</a>, assine no portal GOV.BR e importe o arquivo retornado abaixo.</p>
      <label className="grid gap-2 text-sm font-medium" htmlFor="govbr-return">PDF retornado pelo GOV.BR<input ref={fileRef} id="govbr-return" type="file" accept="application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importReturn(file, state.attemptId); }} /></label>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void cancelAttempt(state.attemptId)}>Cancelar tentativa</Button>
    </div>}
    {state.step === 'imported' && <div className="mt-4 grid gap-3">
      <p className="text-sm">Resultado da validação: <strong>{state.validationStatus}</strong>{state.signerName ? ` — signatário identificado: ${state.signerName}` : ''}{state.reason && state.reason !== 'ok' ? ` (${state.reason})` : ''}</p>
      {state.validationStatus === 'validada'
        ? <><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Confirmo que assinei este documento no GOV.BR e autorizo a incorporação do retorno validado.</span></label><Button type="button" disabled={busy || !consent} onClick={() => void acceptReturn(state.attemptId)}>{busy ? 'Confirmando…' : 'Confirmar retorno validado'}</Button></>
        : <p className="text-sm text-destructive">O retorno não foi validado e não conclui a assinatura. Ele fica preservado no histórico; exporte novamente após assinar o arquivo correto.</p>}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void cancelAttempt(state.attemptId)}>Cancelar tentativa</Button>
    </div>}
    {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
  </section>;
}

type PublicHistoryEvent = { id: string; label: string; occurredAt: string; method: string | null; revision: string | null; actor: { role: string; name: string } };
type PublicHistoryRevision = { id: string; version: number; originLabel: string; createdAt: string; downloadUrl: string | null; promotedBy: { methodLabel: string } | null };

function SignatureHistorySection({ token }: { token: string }) {
  const [history, setHistory] = useState<{ participants: Array<{ roleLabel: string; statusLabel: string; signedAt: string | null }>; document: { revisions: PublicHistoryRevision[] } | null; events: PublicHistoryEvent[]; notice?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  async function load() {
    setFailed(false);
    try {
      const payload = await api(`/public/signatures/${token}/history`, { schema: anySchema });
      setHistory(payload as never);
      setOpen(true);
    } catch {
      setFailed(true);
    }
  }
  return (
    <section className="public-form-card" aria-label="Histórico da assinatura">
      <h2>Histórico da assinatura</h2>
      <p>Acompanhe participantes, revisões preservadas e eventos deste contrato, com data e hora de cada etapa.</p>
      {!open && <Button className="mt-4" type="button" variant="outline" onClick={() => void load()}>Ver histórico</Button>}
      {failed && <p className="mt-3 text-sm text-destructive" role="alert">Não foi possível carregar o histórico.</p>}
      {open && history && (
        <div className="mt-4 grid gap-3 text-sm">
          <ul className="grid list-none gap-1 p-0" aria-label="Participantes">
            {history.participants.map((participant, index) => (
              <li key={index}>{participant.roleLabel} · {participant.statusLabel}{participant.signedAt ? ` · ${new Date(participant.signedAt).toLocaleString('pt-BR')}` : ''}</li>
            ))}
          </ul>
          {history.document && (
            <ul className="grid list-none gap-1 p-0" aria-label="Revisões preservadas">
              {history.document.revisions.map((revision) => (
                <li key={revision.id}>
                  Revisão {revision.version} · {revision.originLabel}
                  {revision.promotedBy && ` · ${revision.promotedBy.methodLabel}`} · {new Date(revision.createdAt).toLocaleString('pt-BR')}
                  {revision.downloadUrl && <> · <a className="underline" href={revision.downloadUrl}>Baixar PDF desta revisão</a></>}
                </li>
              ))}
            </ul>
          )}
          <ol className="grid list-none gap-1 p-0" aria-label="Linha do tempo">
            {history.events.map((event) => (
              <li key={event.id}>
                {new Date(event.occurredAt).toLocaleString('pt-BR')} — <strong>{event.actor.name}</strong> · {event.label}
                {event.method ? ` · ${event.method}` : ''}{event.revision ? ` · ${event.revision}` : ''}
              </li>
            ))}
          </ol>
          {history.notice && <p className="text-xs text-muted-foreground">{history.notice}</p>}
        </div>
      )}
    </section>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#25312d] md:px-8 md:py-6">{children}</div>; }
