import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { z } from 'zod';
import { PatientRow, matchesPatient } from '@/components/PatientRow';
import { QueryError } from '@/components/QueryState';
import { patientsQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes')({
  validateSearch: z.object({ q: z.string().optional() }),
  component: Patients,
});

function Patients() {
  const { q = '' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const patients = useQuery(patientsQuery);
  return (
    <>
      <section className="panel">
        <div className="panel-header"><h2>Pacientes</h2></div>
        <label className="search-box">
          <Search size={16} />
          <input value={q} onChange={(event) => navigate({ search: { q: event.target.value || undefined }, replace: true })} placeholder="Buscar por nome ou telefone" />
        </label>
        <QueryError query={patients} />
        {(patients.data ?? []).filter((patient) => matchesPatient(patient, q)).map((patient) => <PatientRow key={patient.id} patient={patient} />)}
      </section>
      <Outlet />
    </>
  );
}
