import { QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });

export const createAppRouter = (history?: RouterHistory) =>
  createRouter({ routeTree, history, defaultPreload: 'intent', defaultNotFoundComponent: () => <p className="section-note">Página não encontrada.</p> });

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
