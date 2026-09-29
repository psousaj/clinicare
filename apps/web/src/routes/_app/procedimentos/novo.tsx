import { createFileRoute } from '@tanstack/react-router';
import { ProcedureFormPage } from '@/components/ProcedureForm';

export const Route = createFileRoute('/_app/procedimentos/novo')({ component: () => <ProcedureFormPage /> });
