import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLoadingIndicator } from './PageLoadingIndicator';

afterEach(cleanup);

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function setup(loader?: () => Promise<string>, queryFn?: () => Promise<string>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Destination() {
    useQuery({ queryKey: ['page-data'], queryFn: queryFn ?? (() => Promise.resolve('ok')) });
    return <p>Destino</p>;
  }
  const root = createRootRoute({ component: () => <><PageLoadingIndicator /><Outlet /></> });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <p>Início</p> });
  const destination = createRoute({ getParentRoute: () => root, path: '/destination', loader, component: Destination });
  const router = createRouter({ routeTree: root.addChildren([index, destination]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await screen.findByText('Início');
  return { router, client };
}

describe('PageLoadingIndicator', () => {
  it('covers a slow route loader and clears after navigation', async () => {
    const load = deferred();
    const { router } = await setup(() => load.promise);
    act(() => { void router.navigate({ to: '/destination' }); });
    await screen.findByText('Carregando página…');
    await act(async () => { load.resolve('ok'); });
    await screen.findByText('Destino');
    await waitFor(() => expect(screen.queryByText('Carregando página…')).not.toBeInTheDocument());
  });

  it.each(['success', 'error'])('covers initial data loading and clears on %s', async (outcome) => {
    const data = deferred();
    const { router } = await setup(undefined, () => data.promise);
    await act(async () => { await router.navigate({ to: '/destination' }); });
    await screen.findByText('Carregando página…');
    await act(async () => {
      if (outcome === 'success') data.resolve('ok');
      else data.reject(new Error('Network failure'));
    });
    await waitFor(() => expect(screen.queryByText('Carregando página…')).not.toBeInTheDocument());
  });

  it('does not show a page transition for background prefetches', async () => {
    const data = deferred();
    const { client } = await setup();
    act(() => { void client.prefetchQuery({ queryKey: ['prefetch'], queryFn: () => data.promise }); });
    expect(screen.queryByText('Carregando página…')).not.toBeInTheDocument();
    await act(async () => { data.resolve('ok'); });
  });
});
