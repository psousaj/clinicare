// Assinatura do representante como página dedicada (não modal):
// documento à esquerda + painel sticky à direita no desktop, coluna única
// com CTA fixo no mobile. Posicionamento automático no rodapé da última
// página — sem caixa arrastável sobre o texto (corrige o overlay vazio).
// Prévia integrada: gera sozinha ao haver traço, nunca como botão-gate.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { getDocument, renderAllPages, usePdfDocument, type PageGeometry } from '@/components/signing/DocumentViewer';
import { SignaturePadField, type SignaturePadHandle } from '@/components/signing/SignaturePadField';
import { PreviewPdf } from '@/components/signing/PreviewPdf';
import { SignChecklist, SigningSteps } from '@/components/signing/SignChecklist';
import { StampPreview } from '@/components/signing/StampPreview';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { collectFingerprint } from '@/lib/fingerprint';
import { createIdempotencyKey } from '@/lib/idempotency';
import {
  confirmProfessionalSignature,
  defaultSignatureQuery,
  fetchProfessionalPdf,
  keys,
  previewProfessionalSignature,
  professionalProfileQuery,
  sessionQuery,
  signatureHistoryQuery,
  signaturePendingQuery,
  useSaveDefaultSignature,
} from '@/lib/queries';
import { composeStampImage } from '@/lib/signatureStamp';

const searchSchema = z.looseObject({ queue: z.string().optional(), participant: z.string().optional() });
type Placement = { pageIndex: number; x: number; y: number; width: number; height: number };
type PreviewEvidence = { idempotencyKey: string; fingerprint: unknown; hash: string | null; stamped: string; placement: Placement };

export const Route = createFileRoute('/_app/documentos/$followupContractId/assinar')({
  validateSearch: (search) => searchSchema.parse(search),
  component: RepresentativeSignPage,
});

const draftKey = (contractId: string) => `clinicare:rep-draft:${contractId}`;

function readDraft(contractId: string): { image: string | null; consent: boolean; useSaved: boolean } | null {
  try {
    const raw = sessionStorage.getItem(draftKey(contractId));
    return raw ? (JSON.parse(raw) as { image: string | null; consent: boolean; useSaved: boolean }) : null;
  } catch {
    return null;
  }
}

function RepresentativeSignPage() {
  const { followupContractId } = Route.useParams();
  const search = Route.useSearch();
  const queue = (search.queue ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const queueIndex = queue.indexOf(followupContractId);
  const nextInQueue = queueIndex >= 0 ? queue[queueIndex + 1] : undefined;
  const remaining = queueIndex >= 0 ? queue.length - queueIndex - 1 : 0;

  const queryClient = useQueryClient();
  const history = useQuery(signatureHistoryQuery(followupContractId));
  const profile = useQuery(professionalProfileQuery);
  const defaultSignature = useQuery(defaultSignatureQuery);
  const session = useQuery(sessionQuery);
  const pending = useQuery(signaturePendingQuery);
  const saveDefaultSignature = useSaveDefaultSignature();

  const professional =
    history.data?.participants.find((participant) => participant.role === 'professional' && participant.status !== 'signed') ??
    history.data?.participants.find((participant) => participant.role === 'professional');
  const participantId = search.participant ?? professional?.id;
  const currentRevision =
    history.data?.document?.revisions.find((revision) => revision.id === history.data?.document?.currentRevisionId) ??
    history.data?.document?.revisions.at(-1);
  const documentId = history.data?.document?.id;
  const fallback = pending.data?.find((item) => item.contractId === followupContractId);
  const title = history.data?.contract.title ?? fallback?.title ?? 'Documento';
  const patientName = fallback?.patient.fullName ?? '';
  const pdfDownloadUrl = currentRevision?.downloadUrl ?? null;

  const { pdfRef, pageCanvasRefs, pageWrapperRefs, viewerScrollRef, viewerEndRef } = usePdfDocument(pdfDownloadUrl);
  const padHandle = useRef<SignaturePadHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const padWrapRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLLabelElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);
  const previewBlockRef = useRef<HTMLDivElement>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageGeometries, setPageGeometries] = useState<PageGeometry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [readPages, setReadPages] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const saved = defaultSignature.data?.signaturePng ?? null;
  const [draft] = useState(() => readDraft(followupContractId));
  const [useSaved, setUseSaved] = useState(() => draft ? draft.useSaved : false);
  const [image, setImage] = useState<string | null>(() => draft?.image ?? null);
  const [consentGiven, setConsentGiven] = useState(() => draft?.consent ?? false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [composed, setComposed] = useState<string | null>(null);
  const [placement, setPlacement] = useState({ pageIndex: 0, x: 0.08, y: 0.8, width: 0.36, height: 0.12 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [step, setStep] = useState<'sign' | 'confirm'>('sign');
  const [submitted, setSubmitted] = useState(false);
  const [fingerprint, setFingerprint] = useState<unknown>({ unavailable: true });
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const autoPreviewTried = useRef(false);
  const previewEvidenceRef = useRef<PreviewEvidence | null>(null);
  const previewGenerationRef = useRef(0);

  const progress = pageCount === 0 ? 0 : Math.min(1, readPages.length / pageCount);
  // O representante é o autor do contrato; não precisa repetir a etapa de leitura.
  const reviewed = true;
  const activeImage = useSaved && saved ? saved : image;
  const signed = !!activeImage;
  // Conferência visual e hash técnico são estados diferentes: mover a caixa
  // invalida o hash para o backend, mas não desfaz o fato de que o usuário
  // está vendo e conferindo a prévia interativa neste passo.
  const previewReady = step === 'confirm' && signed && !!(previewUrl || pdfUrl);
  const stepIndex = submitted ? 2 : step === 'sign' ? 0 : 1;

  // Carimbo que viaja junto do desenho: nome + conselho/número/UF do perfil.
  const stampLines = [
    session.data?.user.name ?? 'Profissional',
    profile.data?.registrationType && profile.data?.registrationNumber
      ? `${profile.data.registrationType} ${profile.data.registrationNumber}${profile.data.registrationState ? `/${profile.data.registrationState}` : ''}`
      : '',
  ].filter((line) => line.length > 0);
  const registrationLine = stampLines[1] ?? '';
  const missingRegistration = profile.isSuccess && !profile.data?.registrationNumber;

  useEffect(() => {
    if (draft || !saved || image) return;
    setUseSaved(true);
    setImage(saved);
  }, [draft, image, saved]);

  useEffect(() => {
    if (!draft && defaultSignature.isSuccess && !saved) setSaveAsDefault(true);
  }, [defaultSignature.isSuccess, draft, saved]);

  const confirmMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => confirmProfessionalSignature(id, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.signaturePending }),
        queryClient.invalidateQueries({ queryKey: keys.followups }),
        queryClient.invalidateQueries({ queryKey: ['signature-history'] }),
      ]);
    },
  });

  // Rascunho sobrevive a F5: desenho + aceite + modo (salva/desenhada).
  useEffect(() => {
    try {
      if (image || consentGiven || !useSaved) {
        sessionStorage.setItem(draftKey(followupContractId), JSON.stringify({ image, consent: consentGiven, useSaved }));
      }
    } catch {
      // modo privado: segue sem persistência
    }
  }, [image, consentGiven, useSaved, followupContractId]);

  // Aviso ao sair com trabalho não confirmado.
  useEffect(() => {
    if (!image || submitted) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [image, submitted]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);
  useEffect(() => {
    let disposed = false;
    void collectFingerprint().then((result) => {
      if (!disposed) setFingerprint(result);
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!participantId) return;
    let cancelled = false;
    fetchProfessionalPdf(participantId)
      .then((url) => {
        if (!cancelled) {
          setPdfUrl(url);
          setPdfError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPdfError('Não foi possível carregar o PDF do contrato.');
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  useEffect(() => {
    if (!pdfUrl) return;
    const source = pdfUrl;
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdf = await getDocument({ url: source }).promise;
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
        // Posição automática no rodapé da última página, nunca no cabeçalho.
        invalidatePreview();
        setPlacement({ pageIndex: pdf.numPages - 1, x: 0.08, y: 0.8, width: 0.36, height: 0.12 });
      } catch {
        if (!cancelled) setPdfError('Não foi possível renderizar o PDF.');
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
      pdfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    void renderAllPages(pdfRef.current, pageGeometries, pageCanvasRefs.current, () => {
      if (!cancelled) setPdfError('Não foi possível mostrar alguma página.');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageGeometries]);

  useEffect(() => {
    if (pageCount === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      setReadPages(Array.from({ length: pageCount }, (_, index) => index));
      return;
    }
    const seen = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (entry.isIntersecting && !seen.has(index)) {
            seen.add(index);
            setReadPages((prev) => (prev.includes(index) ? prev : [...prev, index]));
          }
          if (entry.isIntersecting) setCurrentPage(index);
        }
      },
      {
        root: typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches ? viewerScrollRef.current : null,
        rootMargin: '-10% 0px -10% 0px',
        threshold: 0.2,
      },
    );
    pageWrapperRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [pageCount, pageGeometries, pageCanvasRefs, pageWrapperRefs, viewerScrollRef]);

  // Restaura o traço salvo no pad quando ele monta com rascunho.
  useEffect(() => {
    if (draft?.image && !useSaved) {
      const timer = window.setTimeout(() => padHandle.current?.loadImage(draft.image!), 300);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPreview(draw: string): Promise<PreviewEvidence | null> {
    if (!documentId || !currentRevision || !participantId) {
      flag('read', 'O documento ainda não está disponível para assinatura.');
      return null;
    }
    const generation = previewGenerationRef.current;
    const placementForPreview = { ...placement };
    setPreviewBusy(true);
    setMessage(null);
    try {
       if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready.catch(() => undefined);
       const stamped = await composeStampImage(draw, stampLines);
       const key = createIdempotencyKey();
       const fingerprintNow = await collectFingerprint();
       if (generation !== previewGenerationRef.current) return null;
       setIdempotencyKey(key);
       setFingerprint(fingerprintNow);
      const result = await previewProfessionalSignature(participantId, {
        documentId,
        baseRevisionId: currentRevision.id,
        signaturePng: stamped,
        placement: placementForPreview,
        idempotencyKey: key,
        fingerprint: fingerprintNow,
        acceptanceText: 'Confirmo a assinatura visual deste contrato.',
       });
       if (generation !== previewGenerationRef.current) {
         URL.revokeObjectURL(result.url);
         return null;
       }
       if (!result.hash) {
         URL.revokeObjectURL(result.url);
         throw new Error('A prévia foi gerada sem identificação. Gere novamente antes de confirmar.');
       }
      setComposed(stamped);
      setPreviewUrl(result.url);
      setPreviewHash(result.hash);
      setPendingId(null);
      const evidence: PreviewEvidence = { idempotencyKey: key, fingerprint: fingerprintNow, hash: result.hash, stamped, placement: placementForPreview };
      previewEvidenceRef.current = evidence;
      return evidence;
    } catch (reason) {
      if (generation !== previewGenerationRef.current) return null;
      setComposed(null);
      setPreviewUrl(null);
      setPreviewHash(null);
      const text = reason instanceof Error ? reason.message : 'Não foi possível gerar a prévia. Verifique sua conexão e tente de novo.';
      flag('sign', text);
      previewEvidenceRef.current = null;
      return null;
    } finally {
      if (generation === previewGenerationRef.current) setPreviewBusy(false);
    }
  }

  function invalidatePreview() {
    previewGenerationRef.current += 1;
    previewEvidenceRef.current = null;
    setPreviewBusy(false);
    setComposed(null);
    setPreviewUrl(null);
    setPreviewHash(null);
  }

  // Prévia integrada: assim que há traço + documento, gera sozinha.
  useEffect(() => {
    if (step !== 'confirm' || !image || !documentId || previewUrl || previewBusy || autoPreviewTried.current) return;
    autoPreviewTried.current = true;
    void runPreview(image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, image, documentId]);

  function flag(item: string, text: string, action?: { label: string; target: React.RefObject<HTMLElement | null> }) {
    setMessage(text);
    setPendingId(item);
    toast.warning(text);
    window.setTimeout(() => {
      const checklistEl = document.querySelector(`[data-checklist-item="${item}"]`);
      (checklistEl as HTMLElement | null)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      if (action) action.target.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      else if (item === 'sign') padWrapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      else if (item === 'consent') {
        consentRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => consentInputRef.current?.focus({ preventScroll: true }), 180);
      }
      if (item === 'sign') padHandle.current?.focus();
    }, 60);
  }

  function handleStroke(draw: string) {
    setImage(draw);
    invalidatePreview();
    setComposed(null);
    autoPreviewTried.current = false;
    setMessage(null);
    setPendingId(null);
  }

  function handleClear() {
    padHandle.current?.clear();
    setImage(null);
    invalidatePreview();
    setComposed(null);
    setPendingId(null);
    setMessage(null);
  }

  function handlePlacementChange(position: Partial<typeof placement>) {
    setPlacement((current) => ({ ...current, ...position }));
    // Moving or resizing changes the evidence sent to the server. The old
    // candidate preview must not be reused with the new geometry.
    invalidatePreview();
  }

  function handleUseSaved() {
    if (!saved) return;
    padHandle.current?.clear();
    setUseSaved(true);
    handleStroke(saved);
  }

  function handleDrawOther() {
    padHandle.current?.clear();
    setUseSaved(false);
    setImage(null);
    invalidatePreview();
    setComposed(null);
    setMessage(null);
    setPendingId(null);
  }

  async function handleConfirm() {
    if (!reviewed) {
      setHint('Role até o final do documento para continuar.');
      viewerEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      viewerScrollRef.current?.scrollTo({ top: viewerScrollRef.current.scrollHeight, behavior: 'smooth' });
      flag('read', 'Falta revisar o documento até o fim antes de assinar.');
      return;
    }
    let draw = image;
    if (!useSaved) {
      const fromPad = padHandle.current?.toDataURL();
      if (fromPad) {
        draw = fromPad;
        setImage(fromPad);
      }
    }
    if (!draw) {
      flag('sign', 'Falta sua assinatura. Desenhe ou use a salva para continuar.');
      return;
    }
    if (!consentGiven) {
      flag('consent', 'Falta aceitar o termo. Marque “Li o documento e assino como representante”.');
      return;
    }
    // Prévia é etapa automática da confirmação, não botão-gate.
    let evidence = previewEvidenceRef.current;
    if (!evidence || JSON.stringify(evidence.placement) !== JSON.stringify(placement)) {
      toast.message('Gerando a prévia final antes de assinar…');
      evidence = await runPreview(draw);
      if (!evidence) return;
    }
    if (!documentId || !currentRevision || !participantId || !participantId) {
      flag('read', 'O documento ainda não está disponível para assinatura.');
      return;
    }
    setMessage(null);
    setConfirmBusy(true);
    try {
      // Persiste antes de confirmar o documento para não concluir a assinatura
      // deixando o usuário com a falsa impressão de que o padrão foi salvo.
      if (saveAsDefault && draw && !useSaved) await saveDefaultSignature.mutateAsync(draw);
      await confirmMutation.mutateAsync({
        id: participantId,
        body: {
          documentId,
          baseRevisionId: currentRevision.id,
          signaturePng: evidence.stamped,
          placement: evidence.placement,
          idempotencyKey: evidence.idempotencyKey,
          fingerprint: evidence.fingerprint,
          previewHash: evidence.hash,
          confirmed: true,
          acceptanceText: 'Confirmo a assinatura visual deste contrato.',
        },
      });
      try {
        sessionStorage.removeItem(draftKey(followupContractId));
      } catch {
        // sem storage: nada a limpar
      }
      setSubmitted(true);
      toast.success('Assinatura do representante registrada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null;
      flag(
        'sign',
        apiError?.status === 409
          ? /STALE_DOCUMENT_REVISION/i.test(apiError.message)
            ? 'O documento foi atualizado antes da confirmação. Recarregue para revisar a versão atual.'
            : apiError.message
          : reason instanceof Error
            ? reason.message
            : 'Não foi possível confirmar. Tente de novo sem sair da página.',
      );
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handlePrimaryAction() {
    if (step === 'sign') {
      const draw = useSaved ? activeImage : padHandle.current?.toDataURL() ?? image;
      if (!draw) {
        flag('sign', 'Falta sua assinatura. Desenhe ou use a salva para continuar.');
        return;
      }
      setImage(draw);
      setStep('confirm');
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
      return;
    }

    await handleConfirm();
  }

  if (history.isSuccess && professional?.status === 'signed' && !submitted) {
    return (
      <div className="grid gap-4">
        <Link to="/documentos" className="text-sm font-semibold text-[#26785f] underline underline-offset-2">
          ← Voltar para documentos
        </Link>
        <section className="panel mx-auto grid w-full max-w-xl justify-items-center gap-2 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#e8f2ed] text-2xl text-[#26785f]" aria-hidden="true">
            ✓
          </div>
          <h2 className="m-0">Você já assinou este documento</h2>
          <p className="m-0 text-sm text-muted-foreground">Não é preciso fazer nada — o registro já está no histórico.</p>
        </section>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="grid gap-4">
        <section className="panel mx-auto grid w-full max-w-xl justify-items-center gap-2 text-center" aria-live="polite">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#e8f2ed] text-2xl text-[#26785f]" aria-hidden="true">
            ✓
          </div>
          <div className="section-kicker">ASSINATURA DO REPRESENTANTE</div>
          <h2 className="m-0">Documento assinado</h2>
          <p className="m-0 text-sm text-muted-foreground">
            {title}
            {patientName ? ` · ${patientName}` : ''} — sua assinatura de representante foi confirmada.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {nextInQueue ? (
              <Button asChild>
                <Link
                  to="/documentos/$followupContractId/assinar"
                  params={{ followupContractId: nextInQueue }}
                  search={search.queue ? { queue: search.queue } : {}}
                >
                  Assinar próximo{remaining > 0 ? ` (${remaining} restantes)` : ''}
                </Link>
              </Button>
            ) : (
              queue.length > 1 && <span className="text-sm font-medium text-[#26785f]">Fila concluída — todos assinados.</span>
            )}
            <Button variant="outline" asChild>
              <Link to="/documentos">Voltar para a lista</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const steps = [
    { id: 'sign', label: 'Assinar' },
    { id: 'confirm', label: 'Confirmar' },
  ];

  return (
    <div className="signing-flow mx-auto grid max-w-none gap-5 pb-24 lg:pb-0" data-step={step}>
      <header className="grid gap-5 border-b border-[#e3e9e4] pb-5">
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Navegação">
          <Link to="/documentos" className="font-semibold text-[#26785f] transition-colors hover:text-[#194d40]">
            ← Documentos
          </Link>
          <span className="text-[#85908b]" aria-hidden="true">·</span>
          <span className="text-sm text-[#5b6b64]">{queueIndex >= 0 ? `Documento ${queueIndex + 1} de ${queue.length}` : 'Documento pendente'}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-[#1f2a26]">{patientName || title}</span>
          {pdfDownloadUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={pdfDownloadUrl} download><Download size={15} aria-hidden="true" /> Baixar PDF</a>
            </Button>
          )}
        </nav>
        <div>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight text-[#1f2a26] sm:text-[32px]">Assinar como representante</h1>
          <p className="m-0 text-base text-[#4a5a53]">{patientName || 'Paciente'} · {title}</p>
        </div>
        <SigningSteps
          stepIndex={Math.min(stepIndex, steps.length - 1)}
          steps={steps}
          onBackStep={(index) => {
            if (index === 0) {
              setMessage(null);
              setPendingId(null);
              invalidatePreview();
              setStep('sign');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
        <p className="sr-only" role="status">
          Passo {Math.min(stepIndex + 1, steps.length)} de {steps.length}: {steps[Math.min(stepIndex, steps.length - 1)]?.label}
        </p>
      </header>

      <QueryError query={history} />

      <div className="grid gap-5">
        <aside
          ref={panelRef}
          className="mx-auto grid w-full max-w-2xl gap-4 rounded-2xl border border-[#e3e9e4] bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-4 lg:max-w-none"
          aria-label="Painel de assinatura"
        >
          <div className="grid gap-1">
            <h2 className="m-0 text-lg font-bold text-[#1f2a26]">{step === 'confirm' ? 'Conferir e concluir' : saved && useSaved ? 'Sua assinatura salva' : 'Sua assinatura'}</h2>
            <p className="m-0 text-sm text-[#40524a]">
              {step === 'confirm'
                ? 'Confira a prévia abaixo, aceite o termo e conclua.'
                : saved && useSaved
                  ? 'Usaremos esta assinatura neste documento. Você pode desenhar outra.'
                  : 'Desenhe com o mouse, dedo ou caneta.'}
            </p>
          </div>

          {step === 'confirm' && (
            <div ref={previewBlockRef} className="overflow-hidden rounded-2xl border border-[#e3e9e4] bg-white">
              <p className="m-0 border-b border-[#e9ede8] bg-[#f7f8f5] p-3 text-sm font-semibold">Confira e ajuste a posição da assinatura</p>
              {(pdfUrl || previewUrl) ? (
                <PreviewPdf
                  url={pdfUrl ?? previewUrl!}
                  placement={placement}
                  signatureImage={composed ?? activeImage}
                  onPlacementChange={handlePlacementChange}
                />
              ) : (
                <p className="m-0 p-4 text-sm text-[#40524a]" role="status">Carregando o documento…</p>
              )}
            </div>
          )}

          {step === 'sign' && (saved && useSaved ? (
            <div className="grid gap-2">
              <div className="grid justify-items-center gap-1 rounded-xl border-2 border-[#26785f] bg-white px-3 py-4">
                <img src={saved} alt="Sua assinatura salva" className="max-h-28 w-auto max-w-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleDrawOther}>
                  Desenhar outra
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseSaved}
                >
                  Usar esta
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2" ref={padWrapRef}>
              <SignaturePadField ref={padHandle} onStroke={handleStroke} onClear={handleClear} tall />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                  Limpar
                </Button>
                {saved && (
                  <Button type="button" variant="outline" size="sm" onClick={handleUseSaved}>
                    Voltar para a salva
                  </Button>
                )}
                <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[#40524a]">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#26785f]"
                    checked={saveAsDefault}
                    onChange={(event) => setSaveAsDefault(event.target.checked)}
                  />
                    {saved ? 'Atualizar minha assinatura salva' : 'Usar nos próximos documentos'}
                </label>
              </div>
            </div>
          ))}

          {step === 'confirm' && <StampPreview image={activeImage} composedImage={composed} name={session.data?.user.name ?? 'Profissional'} registration={registrationLine} />}
          {missingRegistration && (
            <p className="m-0 text-xs text-muted-foreground">
              Cadastre seu registro em <Link to="/configuracoes" className="font-semibold underline underline-offset-2">Configurações</Link> para
              carimbar número e UF.
            </p>
          )}

          {step === 'sign' && !signed && (
            <p className="m-0 rounded-lg bg-[#f7f8f5] px-3 py-2 text-sm text-[#5b6b64]" role="status">
              Desenhe sua assinatura para continuar.
            </p>
          )}

          <hr className="m-0 border-[#eef1ed]" />

          <div className={step === 'confirm' ? 'grid gap-4' : 'hidden'}>
            <SignChecklist
              pendingId={pendingId}
              items={[
                { id: 'sign', label: 'Assinatura pronta', done: signed, hint: signed ? undefined : 'Desenhe ou use a salva' },
                { id: 'preview', label: 'Prévia conferida', done: previewReady, hint: previewBusy ? 'Gerando…' : previewReady ? undefined : 'Gera sozinha após o traço' },
                { id: 'consent', label: 'Aceite confirmado', done: consentGiven, hint: consentGiven ? undefined : 'Marque a caixa abaixo' },
              ]}
            />
            <label ref={consentRef} className="scroll-mt-28 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 text-[15px] leading-snug">
            <input
              ref={consentInputRef}
              type="checkbox"
              className="mt-0.5 size-5 flex-none accent-[#26785f]"
              checked={consentGiven}
              onChange={(event) => {
                setConsentGiven(event.target.checked);
                if (event.target.checked) {
                  setPendingId(null);
                  setMessage(null);
                }
              }}
            />
            <span>Li o documento e assino como representante da clínica.</span>
            </label>
          </div>

          {previewBusy && (
            <p className="m-0 text-sm text-[#40524a]" role="status">
              Gerando a prévia do documento assinado…
            </p>
          )}
          {message && (
            <p className="m-0 text-sm font-medium text-[#b3261e]" role="alert">
              {message}
            </p>
          )}

          <div className="sticky bottom-0 z-10 -mx-1 grid gap-2 bg-white px-1 pb-1 pt-3">
            <Button
              type="button"
              className="min-h-12 w-full text-base transition-transform duration-150 ease-out active:scale-[0.97]"
              disabled={confirmBusy || previewBusy || (step === 'sign' && !signed)}
              onClick={() => void handlePrimaryAction()}
            >
              {confirmBusy ? 'Gerando documento assinado…' : step === 'sign' ? 'Continuar para confirmação' : 'Assinar documento'}
            </Button>
            <Button variant="ghost" size="sm" asChild className="justify-self-center text-[#5b6b64]">
              <Link to="/documentos">Voltar</Link>
            </Button>
          </div>
        </aside>
      </div>

    </div>
  );
}
