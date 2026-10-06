import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCpf } from '@/lib/fieldKinds';

export function CpfField({ defaultValue = '' }: { defaultValue?: string }) {
  const [value, setValue] = useState(() => formatCpf(defaultValue));

  return (
    <Label className="flex-col items-stretch gap-1.5">
      CPF
      <Input name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={value} onChange={(event) => setValue(formatCpf(event.target.value))} />
    </Label>
  );
}
