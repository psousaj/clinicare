import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Clinic dashboard', () => {
  it('shows prototype mode and patient creation entry point', () => {
    render(<App />);
    expect(screen.getByText(/PROTÓTIPO · DADOS FICTÍCIOS/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /novo paciente/i }).length).toBeGreaterThan(0);
  });
});
