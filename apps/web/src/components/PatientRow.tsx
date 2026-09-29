import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { Patient } from '@/lib/schemas';

export function PatientRow({ patient }: { patient: Patient }) {
  return (
    <Link to="/pacientes/$patientId" params={{ patientId: patient.id }} className="patient-row">
      <span className="patient-initials">{patient.fullName.slice(0, 2).toUpperCase()}</span>
      <span className="patient-info">
        <strong>{patient.fullName}</strong>
        <small>{patient.phone || patient.email || 'Sem contato'}</small>
      </span>
      <ChevronRight size={16} />
    </Link>
  );
}

export const matchesPatient = (patient: Patient, query: string) => patient.fullName.toLowerCase().includes(query.toLowerCase()) || !!patient.phone?.includes(query);
