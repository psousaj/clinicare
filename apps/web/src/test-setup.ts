import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// jsdom não implementa ResizeObserver (usado pelo Checkbox do Radix).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

// A primeira renderização de cada rota compila módulos pesados (rjsf, calendário) sob demanda.
configure({ asyncUtilTimeout: 5000 });
