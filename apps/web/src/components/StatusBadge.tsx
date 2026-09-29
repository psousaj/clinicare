import type { Tone } from '@/lib/format';
import { cn } from '@/lib/utils';

const tones: Record<Tone, string> = {
  neutral: 'bg-accent text-accent-foreground',
  success: 'bg-[#cfe7dc] text-[#124132]',
  warning: 'bg-[#fbf1d9] text-[#7a5610]',
  danger: 'bg-[#f8e4e1] text-[#8a2a1f]',
};

export function StatusBadge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tones[tone])}>{children}</span>;
}
