import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Clinic dashboard', () => {
  it('shows prototype mode and patient creation entry point without authentication', async () => {
    render(<App />);
    expect(screen.getAllByText(/PROTÓTIPO · DADOS FICTÍCIOS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /novo paciente/i }).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Gestão de pacientes, procedimentos e cuidados/i)).toBeInTheDocument();
  });
});
