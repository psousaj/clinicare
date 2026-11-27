import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const emailWasVerified = new URLSearchParams(window.location.search).get('verified') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(isSignUp ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isSignUp ? { name, email, password } : { email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string; error?: string; code?: string } | null;
        if (!isSignUp && (data?.code === 'EMAIL_NOT_VERIFIED' || data?.message?.includes('verify'))) {
          setConfirmationPending(true);
          return;
        }
        throw new Error(data?.message ?? data?.error ?? 'E-mail ou senha inválidos.');
      }
      if (isSignUp) {
        setConfirmationPending(true);
        return;
      }
      const stateResponse = await fetch('/api/account/state', { credentials: 'include' });
      const state = stateResponse.ok ? await stateResponse.json() as { kind?: string } : null;
      await navigate({ to: state?.kind === 'onboarding' ? '/onboarding' : '/' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-7 shadow-sm">
        <div><p className="text-sm text-muted-foreground">Clínicare</p><h1 className="text-2xl font-semibold">{isSignUp ? 'Crie sua conta' : 'Entrar na sua clínica'}</h1></div>
        {emailWasVerified && <p role="status" className="text-sm">Agora você pode entrar para continuar o cadastro da sua clínica.</p>}
        {isSignUp && <label className="block space-y-2 text-sm font-medium">Nome<Input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>}
        <label className="block space-y-2 text-sm font-medium">E-mail<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label className="block space-y-2 text-sm font-medium">Senha<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={isSignUp ? 'new-password' : 'current-password'} /></label>
        {confirmationPending && <p role="status" className="text-sm">Confira sua caixa de entrada para confirmar o e-mail. Você pode solicitar um novo link abaixo.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Aguarde…' : isSignUp ? 'Criar conta' : 'Entrar'}</Button>
        {confirmationPending && <Button type="button" variant="outline" className="w-full" disabled={submitting} onClick={async () => {
          setSubmitting(true);
          setError(null);
          try {
            const response = await fetch('/api/auth/send-verification-email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
            if (!response.ok) throw new Error('Não foi possível reenviar agora. Aguarde e tente novamente.');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível reenviar o e-mail.');
          } finally {
            setSubmitting(false);
          }
        }}>Reenviar confirmação</Button>}
        {!confirmationPending && <button type="button" className="w-full text-sm text-primary underline" onClick={() => { setIsSignUp(!isSignUp); setError(null); }}>{isSignUp ? 'Já tenho uma conta' : 'Criar conta'}</button>}
      </form>
    </main>
  );
}
