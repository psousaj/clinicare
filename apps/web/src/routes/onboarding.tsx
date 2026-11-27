import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const response = await fetch('/api/account/state', { credentials: 'include' });
    if (response.status === 401) throw redirect({ to: '/login' });
    const state = await response.json() as { kind: string };
    if (state.kind !== 'onboarding') throw redirect({ to: '/' });
  },
  component: ClinicOnboardingPage,
});

function ClinicOnboardingPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState({ name: '', cnpj: '', address: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const response = await fetch('/api/clinics/onboarding', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível cadastrar a clínica.');
      await navigate({ to: '/' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a clínica.');
    } finally { setSaving(false); }
  }
  return <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <form onSubmit={submit} className="w-full max-w-lg space-y-5 rounded-2xl border bg-card p-7 shadow-sm">
      <div><p className="text-sm text-muted-foreground">Clínicare · Free</p><h1 className="text-2xl font-semibold">Cadastre sua clínica</h1></div>
      <label className="block space-y-2 text-sm font-medium">Nome da clínica<Input required value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} /></label>
      <label className="block space-y-2 text-sm font-medium">CNPJ<Input required inputMode="numeric" autoComplete="organization" value={fields.cnpj} onChange={e => setFields({ ...fields, cnpj: e.target.value })} /></label>
      <label className="block space-y-2 text-sm font-medium">Endereço<Input required autoComplete="street-address" value={fields.address} onChange={e => setFields({ ...fields, address: e.target.value })} /></label>
      <label className="block space-y-2 text-sm font-medium">Telefone<Input required type="tel" autoComplete="tel" value={fields.phone} onChange={e => setFields({ ...fields, phone: e.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando…' : 'Começar no Free'}</Button>
    </form>
  </main>;
}
