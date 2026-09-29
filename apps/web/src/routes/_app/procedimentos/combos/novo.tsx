import { createFileRoute } from '@tanstack/react-router';
import { ComboFormPage } from '@/components/ComboForm';

export const Route = createFileRoute('/_app/procedimentos/combos/novo')({ component: () => <ComboFormPage /> });
