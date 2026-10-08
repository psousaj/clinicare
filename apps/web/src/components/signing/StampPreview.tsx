// Prévia ao vivo do carimbo: exatamente o bloco que será aplicado
// (traço + nome + registro + data/hora), em vez de texto cinza solto.
export function StampPreview({
  image,
  composedImage,
  name,
  registration,
  at = new Date(),
}: {
  image: string | null;
  composedImage?: string | null;
  name: string;
  registration: string;
  at?: Date;
}) {
  const stampDate = at.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="grid gap-2 rounded-xl border border-[#e3e9e4] bg-[#f7fbf8] p-3" aria-live="polite" aria-label="Prévia do carimbo">
      <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-[#40524a]">Pré-visualização do carimbo</p>
      <div className="flex min-h-16 items-center justify-center rounded-lg bg-white px-3 py-2 shadow-[0_0_0_1px_rgba(20,40,30,0.05)]">
        {composedImage ? (
          <img src={composedImage} alt="Prévia exata da assinatura e carimbo" className="max-h-24 w-full object-contain" />
        ) : image ? (
          <img src={image} alt="Traço da sua assinatura" className="h-12 w-28 flex-none object-contain" />
        ) : (
          <span className="text-sm text-[#5b6b64]">A prévia aparece após gerar o documento.</span>
        )}
        {!composedImage && <div className="grid gap-0.5 border-l border-[#e3e9e4] pl-3">
          <strong className="text-sm text-[#1f2a26]">{name}</strong>
          {registration && <span className="text-xs font-semibold text-[#40524a]">{registration}</span>}
          <span className="text-xs tabular-nums text-[#5b6b64]">Data definida na confirmação · {stampDate}</span>
        </div>}
      </div>
      <p className="m-0 text-xs text-[#5b6b64]">O carimbo é gerado automaticamente com seus dados.</p>
    </div>
  );
}
