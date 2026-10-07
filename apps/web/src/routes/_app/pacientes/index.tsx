import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { PatientRow, matchesPatient } from '@/components/PatientRow';
import { QueryError } from '@/components/QueryState';
import { patientsQuery, useDeletePatient } from '@/lib/queries';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_app/pacientes/')({
  validateSearch: z.object({ q: z.string().optional() }),
  component: Patients,
});

function Patients() {
  const { q = '' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const patients = useQuery(patientsQuery);
  const remove = useDeletePatient();
  return (
    <section className="panel">
      <div className="panel-header"><h2>Pacientes</h2></div>
      <label className="search-box">
        <Search size={16} />
        <input value={q} onChange={(event) => navigate({ search: { q: event.target.value || undefined }, replace: true })} placeholder="Buscar por nome ou telefone" />
      </label>
      <QueryError query={patients} />
      {(patients.data ?? []).filter((patient) => matchesPatient(patient, q)).map((patient) => (
        <div key={patient.id} className="flex items-center gap-2">
          <PatientRow patient={patient} />
          <Button variant="ghost" size="sm" asChild aria-label={`Editar ${patient.fullName}`}><Link to="/pacientes/$patientId" params={{ patientId: patient.id }}><Pencil /></Link></Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm('Excluir este paciente?')) remove.mutate(patient.id); }} aria-label={`Excluir ${patient.fullName}`}><Trash2 /></Button>
        </div>
      ))}
    </section>
  );
}
