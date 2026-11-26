import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createQueryClient } from '../router';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('clinic onboarding', () => {
  it('collects all required clinic details and submits them without a client-supplied tenant id', async () => {
    let clinicCreated = false;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/account/state') return new Response(JSON.stringify({ kind: clinicCreated ? 'clinic' : 'onboarding' }), { status: 200 });
      if (input === '/api/clinics/onboarding') clinicCreated = true;
      return new Response(JSON.stringify({ tenant: { id: 'new-tenant' }, recovered: false }), { status: 201 });
    });
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/onboarding'] }));
    render(<QueryClientProvider client={createQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nome da clínica'), 'Clínica Nova');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.type(screen.getByLabelText('Endereço'), 'Rua Um, 10');
    await user.type(screen.getByLabelText('Telefone'), '(11) 99999-9999');
    await user.click(screen.getByRole('button', { name: 'Começar no Free' }));
    expect(await screen.findAllByRole('link', { name: /Visão geral/ })).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith('/api/clinics/onboarding', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Clínica Nova', cnpj: '11.222.333/0001-81', address: 'Rua Um, 10', phone: '(11) 99999-9999' }),
    }));
  });
});
