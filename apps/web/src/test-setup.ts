import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// jsdom não implementa algumas APIs usadas por componentes interativos.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }) as MediaQueryList);

// A primeira renderização de cada rota compila módulos pesados (rjsf, calendário) sob demanda.
configure({ asyncUtilTimeout: 8000 });
