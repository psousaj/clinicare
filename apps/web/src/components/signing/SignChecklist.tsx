// Checklist sempre visível ao lado do CTA: o usuário nunca precisa
// adivinhar o que falta. Item pendente recebe destaque âmbar + shake.
export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export function SignChecklist({ items, pendingId }: { items: ChecklistItem[]; pendingId: string | null }) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0 text-sm" aria-label="O que falta">
      {items.map((item, index) => {
        const pending = item.id === pendingId;
        return (
          <li
            key={item.id}
            data-checklist-item={item.id}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ring-1 ring-inset transition-colors duration-200 ${
              pending
                ? 'bg-[#fef6e4] font-semibold text-[#7c4a03] ring-[#e8c87a]'
                : item.done
                  ? 'bg-[#eef5f1] font-medium text-[#194d40] ring-transparent'
                  : 'bg-white text-[#5b6b64] ring-[#e9ede8]'
            }`}
            style={pending ? { animation: 'sign-shake 300ms ease-out' } : undefined}
            aria-current={pending ? 'true' : undefined}
          >
            <span
              aria-hidden="true"
              className={`grid size-5 flex-none place-items-center rounded-full text-[11px] font-bold ${
                item.done ? 'bg-[#26785f] text-white' : pending ? 'bg-[#e8a13d] text-white' : 'bg-[#eef1ed] text-[#85908b]'
              }`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {item.done ? '✓' : index + 1}
            </span>
            <span>
              {item.label}
              {item.hint && !item.done && <span className="block text-xs font-normal opacity-80">{item.hint}</span>}
            </span>
          </li>
        );
      })}
      <style>{`@keyframes sign-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } } @media (prefers-reduced-motion: reduce) { li[data-checklist-item] { animation: none !important; } }`}</style>
    </ul>
  );
}

export function SigningSteps({ stepIndex, steps }: { stepIndex: number; steps: Array<{ id: string; label: string }> }) {
  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0" aria-label="Progresso da assinatura">
      {steps.map((item, index) => {
        const done = index < stepIndex;
        const current = index === stepIndex;
        return (
          <li
            key={item.id}
            className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
            aria-current={current ? 'step' : undefined}
          >
            <span
              className={`grid size-7 flex-none place-items-center rounded-full text-[13px] font-bold transition-colors duration-200 ${
                done || current ? 'bg-[#26785f] text-white' : 'bg-white text-[#85908b] ring-1 ring-inset ring-[#d5ddd7]'
              }`}
              aria-hidden="true"
            >
              {done ? '✓' : index + 1}
            </span>
            <span
              className={`flex-none text-sm ${
                current ? 'font-bold text-[#1f2a26]' : done ? 'font-semibold text-[#26785f]' : 'text-[#85908b]'
              }`}
            >
              {item.label}
            </span>
            {index < steps.length - 1 && (
              <span className={`mx-1 h-0.5 min-w-3 flex-1 rounded-full ${done ? 'bg-[#26785f]' : 'bg-[#e3e9e4]'}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
