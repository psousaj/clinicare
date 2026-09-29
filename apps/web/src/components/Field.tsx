import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function Field({ label, className, children, ...props }: { label: string; className?: string; children?: ReactNode } & React.ComponentProps<'input'>) {
  return (
    <Label className={cn('flex-col items-stretch gap-1.5', className)}>
      {label}
      {children ?? <Input {...props} />}
    </Label>
  );
}
