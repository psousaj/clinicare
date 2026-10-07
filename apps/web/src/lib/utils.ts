import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Liga/desliga um id numa lista de seleção (pickers de ofertas, anamneses e contratos).
export function toggleId(list: string[], id: string, on: boolean) {
  return on ? [...list.filter((entry) => entry !== id), id] : list.filter((entry) => entry !== id);
}
