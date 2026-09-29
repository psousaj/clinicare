import { format, parse } from 'date-fns';
import { CalendarDays, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ptBR } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type PickerProps = {
  value?: string | null;
  onChange: (value: string | undefined) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const triggerClass = 'h-9 w-full justify-start gap-2 bg-white px-3 font-normal';

// O valor trafega como yyyy-MM-dd, exibido como dd/MM/yyyy.
export function DatePicker({ value, onChange, id, name, disabled, placeholder = 'Selecione a data', className }: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const valid = selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  const thisYear = new Date().getFullYear();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} className={cn(triggerClass, !valid && 'text-muted-foreground', className)}>
          <CalendarDays className="size-4" />
          {valid ? format(valid, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          captionLayout="dropdown"
          startMonth={new Date(thisYear - 100, 0)}
          endMonth={new Date(thisYear + 10, 11)}
          defaultMonth={valid}
          selected={valid}
          onSelect={(day) => {
            onChange(day ? format(day, 'yyyy-MM-dd') : undefined);
            setOpen(false);
          }}
        />
        {valid && <div className="border-t p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(undefined); setOpen(false); }}>Limpar</Button></div>}
      </PopoverContent>
    </Popover>
  );
}

const two = (value: number) => String(value).padStart(2, '0');
const hours = Array.from({ length: 24 }, (_, index) => two(index));
const minutes = Array.from({ length: 60 }, (_, index) => two(index));

function Column({ items, selected, onPick, label }: { items: string[]; selected?: string; onPick: (item: string) => void; label: string }) {
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => active.current?.scrollIntoView({ block: 'center' }), []);
  return (
    <div className="grid w-20 grid-rows-[auto_1fr]">
      <span className="border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground" aria-hidden>{label}</span>
      <div role="listbox" aria-label={label} className="grid max-h-56 content-start gap-0.5 overflow-x-hidden overflow-y-auto p-1 [scrollbar-width:thin]">
        {items.map((item) => (
          <Button key={item} ref={item === selected ? active : undefined} type="button" role="option" aria-selected={item === selected} size="sm" variant={item === selected ? 'default' : 'ghost'} className="w-full" onClick={() => onPick(item)}>{item}</Button>
        ))}
      </div>
    </div>
  );
}

// O valor trafega e é exibido como HH:mm.
export function TimePicker({ value, onChange, id, name, disabled, placeholder = 'Selecione a hora', className }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = /^\d{2}:\d{2}$/.test(value ?? '') ? value!.split(':') : [undefined, undefined];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} className={cn(triggerClass, !value && 'text-muted-foreground', className)}>
          <Clock className="size-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x">
          <Column label="Hora" items={hours} selected={hour} onPick={(next) => onChange(`${next}:${minute ?? '00'}`)} />
          <Column label="Minuto" items={minutes} selected={minute} onPick={(next) => { onChange(`${hour ?? '00'}:${next}`); setOpen(false); }} />
        </div>
        {value && <div className="border-t p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(undefined); setOpen(false); }}>Limpar</Button></div>}
      </PopoverContent>
    </Popover>
  );
}
