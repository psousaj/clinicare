import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from '../router';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('public account registration', () => {
  it('submits identity without clinic data and allows a confirmation resend', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      token: null,
      user: { id: 'user-1', email: 'new@example.test', emailVerified: false },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/login'] }));
    render(<QueryClientProvider client={createQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('Nome'), 'New User');
    await user.type(screen.getByLabelText('E-mail'), 'new@example.test');
    await user.type(screen.getByLabelText('Senha'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/confirmar o e-mail/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-up/email', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'New User', email: 'new@example.test', password: 'new-password-123' }),
    }));
    expect(screen.queryByLabelText('CNPJ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar confirmação' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reenviar confirmação' }));
    expect(fetch).toHaveBeenLastCalledWith('/api/auth/send-verification-email', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.test' }),
    }));
  });

  it('shows pending confirmation instead of opening a clinical session for an unverified login', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Email not verified',
    }), { status: 403, headers: { 'content-type': 'application/json' } }));
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/login'] }));
    render(<QueryClientProvider client={createQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail'), 'pending@example.test');
    await user.type(screen.getByLabelText('Senha'), 'pending-password-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/confira sua caixa de entrada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar confirmação' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-in/email', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'pending@example.test', password: 'pending-password-123' }),
    }));
    expect(screen.getByRole('heading', { name: 'Entrar na sua clínica' })).toBeInTheDocument();
  });
});
