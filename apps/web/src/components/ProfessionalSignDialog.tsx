import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import SignaturePad from 'signature_pad';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QueryError } from '@/components/QueryState';
import { ApiError } from '@/lib/api';
import { collectFingerprint } from '@/lib/fingerprint';
import { composeStampImage } from '@/lib/signatureStamp';
import { confirmProfessionalSignature, fetchProfessionalPdf, keys, previewProfessionalSignature, professionalProfileQuery, sessionQuery, signatureHistoryQuery } from '@/lib/queries';

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
}

export type ProfessionalSignItem = {
  participantId: string;
  followupContractId: string;
  title: string;
  patientName: string;
};

type Geometry = { width: number; height: number };
type Position = { x: number; y: number; width: number; height: number };

const ACCEPTANCE_TEXT = 'Confirmo a assinatura visual deste contrato.';

// Cerimônia de assinatura do representante da clínica: revisa o PDF atual,
// desenha a assinatura, posiciona sobre a página, gera a prévia e confirma.
// Mesma evidência do fluxo do paciente, pelos endpoints autenticados do painel.
export function ProfessionalSignDialog({ item, onClose }: { item: ProfessionalSignItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl" aria-label={item ? `Assinar ${item.title}` : 'Assinar contrato'}>
        {item && <Workspace key={`${item.followupContractId}:${item.participantId}`} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Workspace({ item, onClose }: { item: ProfessionalSignItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const history = useQuery(signatureHistoryQuery(item.followupContractId));
  const profile = useQuery(professionalProfileQuery);
  const session = useQuery(sessionQuery);
  const preview = useMutation({ mutationFn: ({ participantId, body }: { participantId: string; body: Record<string, unknown> }) => previewProfessionalSignature(participantId, body) });
  const confirm = useMutation({
    mutationFn: ({ participantId, body }: { participantId: string; body: Record<string, unknown> }) => confirmProfessionalSignature(participantId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.signaturePending }),
        queryClient.invalidateQueries({ queryKey: keys.followups }),
        queryClient.invalidateQueries({ queryKey: ['signature-history'] }),
      ]);
    },
  });
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageGeometries, setPageGeometries] = useState<Geometry[]>([]);
  const [displayGeometry, setDisplayGeometry] = useState<Geometry | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [composed, setComposed] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, width: 180, height: 86 });
  const [consentGiven, setConsentGiven] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<Position | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fingerprint, setFingerprint] = useState<unknown>({ unavailable: true });
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const professional = history.data?.participants.find((participant) => participant.role === 'professional' && participant.status !== 'signed')
    ?? history.data?.participants.find((participant) => participant.role === 'professional');
  const participantId = professional?.id ?? item.participantId;
  const currentRevision = history.data?.document?.revisions.find((revision) => revision.id === history.data?.document?.currentRevisionId)
    ?? history.data?.document?.revisions.at(-1);
  const documentId = history.data?.document?.id;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);
  useEffect(() => {
    let disposed = false;
    void collectFingerprint().then((result) => { if (!disposed) setFingerprint(result); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!professional) return;
    let cancelled = false;
    fetchProfessionalPdf(participantId)
      .then((url) => { if (!cancelled) { setPdfUrl(url); setPdfError(null); } })
      .catch(() => { if (!cancelled) setPdfError('Não foi possível carregar o PDF do contrato.'); });
    return () => { cancelled = true; };
  }, [participantId, professional]);

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdf = await getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        const geometries: Geometry[] = [];
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const pdfPage = await pdf.getPage(index);
          const viewport = pdfPage.getViewport({ scale: 1.2 });
          geometries.push({ width: viewport.width, height: viewport.height });
        }
        if (!cancelled) setPageGeometries(geometries);
      } catch { if (!cancelled) setPdfError('Não foi possível renderizar o PDF.'); }
    }
    void loadPdf();
    return () => { cancelled = true; pdfRef.current = null; };
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      const pdf = pdfRef.current;
      const canvas = pageCanvasRef.current;
      if (!pdf || !canvas || !pageGeometries[page]) return;
      try {
        const pdfPage = await pdf.getPage(page + 1);
        const viewport = pdfPage.getViewport({ scale: 1.2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvas, viewport }).promise;
      } catch { if (!cancelled) setPdfError('Não foi possível renderizar o PDF.'); }
    }
    void renderPage();
    return () => { cancelled = true; };
  }, [page, pageGeometries]);

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
    const container = pageContainerRef.current;
    if (!container) return;
    const updateGeometry = () => {
      const rect = pageCanvasRef.current?.getBoundingClientRect();
      if (rect?.width && rect.height) setDisplayGeometry({ width: rect.width, height: rect.height });
    };
    updateGeometry();
    const observer = new ResizeObserver(updateGeometry);
    observer.observe(container);
    window.addEventListener('resize', updateGeometry);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateGeometry); };
  }, [page, pageGeometries]);

  useEffect(() => {
    const geometry = displayGeometry;
    if (!geometry) return;
    setPosition((current) => ({ ...current, x: Math.min(current.x, Math.max(0, geometry.width - current.width)), y: Math.min(current.y, Math.max(0, geometry.height - current.height)), width: Math.min(current.width, geometry.width), height: Math.min(current.height, geometry.height) }));
  }, [displayGeometry]);

  // Carimbo que viaja junto do desenho: nome + conselho/número/UF do perfil.
  const stampLines = [
    session.data?.user.name ?? 'Profissional',
    profile.data?.registrationType && profile.data?.registrationNumber
      ? `${profile.data.registrationType} ${profile.data.registrationNumber}${profile.data.registrationState ? `/${profile.data.registrationState}` : ''}`
      : '',
  ].filter((line) => line.length > 0);
  const missingRegistration = profile.isSuccess && !profile.data?.registrationNumber;

  function placement() {
    const geometry = displayGeometry ?? pageGeometries[page];
    return { pageIndex: page, x: position.x / geometry.width, y: position.y / geometry.height, width: position.width / geometry.width, height: position.height / geometry.height };
  }
  function clear() {
    padRef.current?.clear();
    setImage(null);
    setComposed(null);
    setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null);
  }
  function captureDrawing() {
    const pad = padRef.current;
    if (pad && !pad.isEmpty()) {
      const draw = pad.toDataURL('image/png');
      if (draw !== image) {
        setImage(draw);
        setComposed(null);
        setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null);
      }
      return draw;
    }
    return image;
  }

  async function runPreview() {
    const geometry = displayGeometry ?? pageGeometries[page];
    if (!geometry) { setMessage('Aguarde o PDF carregar antes de visualizar a prévia.'); return; }
    const draw = captureDrawing();
    if (!draw) { setMessage('Desenhe sua assinatura antes de visualizar a prévia.'); return; }
    if (!documentId || !currentRevision) { setMessage('O documento ainda não está disponível para assinatura.'); return; }
    setMessage(null);
    try {
      if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready.catch(() => undefined);
      const stamped = await composeStampImage(draw, stampLines);
      const key = crypto.randomUUID();
      setIdempotencyKey(key);
      const result = await preview.mutateAsync({ participantId, body: { documentId, baseRevisionId: currentRevision.id, signaturePng: stamped, placement: placement(), idempotencyKey: key, fingerprint, acceptanceText: ACCEPTANCE_TEXT } });
      setComposed(stamped);
      setPreviewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return result.url; });
      setPreviewHash(result.hash);
      setPreviewPlacement({ ...position });
    } catch (reason) {
      setComposed(null); setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null);
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível gerar a prévia do PDF. Verifique sua conexão e tente novamente.');
    }
  }

  async function runConfirm() {
    if (!consentGiven) { setMessage('Confirme o aceite antes de continuar.'); return; }
    if (!composed || !previewUrl) { setMessage('Visualize a prévia do PDF antes de confirmar.'); return; }
    if (!previewHash || !previewPlacement || JSON.stringify(previewPlacement) !== JSON.stringify(position)) { setMessage('A posição da assinatura mudou. Gere uma nova prévia antes de confirmar.'); return; }
    if (!documentId || !currentRevision) { setMessage('O documento ainda não está disponível para assinatura.'); return; }
    setMessage(null);
    try {
      const confirmationFingerprint = await collectFingerprint();
      setFingerprint(confirmationFingerprint);
      await confirm.mutateAsync({ participantId, body: { documentId, baseRevisionId: currentRevision.id, signaturePng: composed, placement: placement(), idempotencyKey, fingerprint: confirmationFingerprint, previewHash, confirmed: true, acceptanceText: ACCEPTANCE_TEXT } });
      setSubmitted(true);
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null;
      setMessage(apiError?.status === 409
        ? 'O documento foi atualizado antes da confirmação. Feche e revise a versão atual.'
        : reason instanceof Error ? reason.message : 'Não foi possível confirmar a assinatura. Tente novamente.');
    }
  }

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Assinatura registrada</DialogTitle>
          <DialogDescription>{item.title} · {item.patientName} — sua assinatura de representante foi confirmada.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end"><Button type="button" onClick={onClose}>Fechar</Button></div>
      </>
    );
  }

  const geometry = displayGeometry ?? pageGeometries[page];
  return (
    <>
      <DialogHeader>
        <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-primary">Assinatura do representante</div>
        <DialogTitle>{item.title}</DialogTitle>
        <DialogDescription>{item.patientName} — revise todas as páginas, desenhe sua assinatura e confirme. O carimbo do seu registro sai junto do desenho.</DialogDescription>
      </DialogHeader>
      <QueryError query={history} />
      {professional?.status === 'signed' && <p className="text-sm text-muted-foreground" role="status">Esta assinatura já foi registrada.</p>}
      {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
      <div className="grid gap-4">
        <div className="overflow-auto rounded-2xl border bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Páginas do contrato">
            {Array.from({ length: pageCount }, (_, index) => (
              <Button key={index} type="button" size="sm" variant={index === page ? 'default' : 'outline'} onClick={() => { setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null); setPage(index); }}>
                Página {index + 1}
              </Button>
            ))}
          </div>
          {pdfError && <p className="mb-3 text-sm text-destructive" role="alert">{pdfError}</p>}
          <div ref={pageContainerRef} className="relative mx-auto w-fit">
            <canvas ref={pageCanvasRef} className="block" style={{ maxWidth: '100%', height: 'auto' }} aria-label={`Página ${page + 1} do contrato PDF`} />
            {geometry && (
              <Rnd
                bounds="parent"
                size={{ width: position.width, height: position.height }}
                position={{ x: position.x, y: position.y }}
                minWidth={Math.min(80, geometry.width)}
                minHeight={Math.min(40, geometry.height)}
                maxWidth={geometry.width}
                maxHeight={geometry.height}
                onDragStop={(_, data) => { setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null); setPosition((old) => ({ ...old, x: data.x, y: data.y })); }}
                onResizeStop={(_, __, ref, ___, data) => { setPreviewUrl(null); setPreviewHash(null); setPreviewPlacement(null); setPosition({ x: data.x, y: data.y, width: ref.offsetWidth, height: ref.offsetHeight }); }}
                className="border-2 border-dashed border-[#26785f] bg-[#e8f2ed]/70"
                aria-label="Posição da assinatura"
              />
            )}
          </div>
        </div>
        <div className="grid gap-3">
          <canvas ref={signatureCanvasRef} className="h-36 w-full touch-none rounded-xl border bg-white" aria-label="Área para desenhar a assinatura" />
          <p className="m-0 text-xs text-muted-foreground">Carimbo aplicado abaixo do desenho: {stampLines.join(' · ')}</p>
          {missingRegistration && <p className="m-0 text-xs text-muted-foreground">Cadastre seu registro em Configurações para carimbar número e UF.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={clear}>Limpar desenho</Button>
            <Button type="button" variant="outline" disabled={preview.isPending} onClick={() => void runPreview()}>{preview.isPending ? 'Gerando prévia…' : 'Visualizar prévia do PDF'}</Button>
          </div>
          {previewUrl && <iframe title="Prévia do PDF candidato" src={previewUrl} className="h-96 w-full rounded-xl border" />}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consentGiven} onCheckedChange={(value) => setConsentGiven(value === true)} />
            <span>Li e revisei o contrato e confirmo minha assinatura como representante da clínica.</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" disabled={confirm.isPending} onClick={() => void runConfirm()}>{confirm.isPending ? 'Confirmando…' : 'Confirmar assinatura'}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
