import { useIsFetching } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';

export function PageLoadingIndicator() {
  const navigating = useRouterState({ select: (state) => state.status === 'pending' });
  const loadingQueries = useIsFetching({
    type: 'active',
    predicate: (query) => query.state.status === 'pending',
  });
  const loading = navigating || loadingQueries > 0;

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {loading && (
        <>
          <div className="page-loading-indicator" aria-hidden="true"><span /></div>
          <span className="sr-only">Carregando página…</span>
        </>
      )}
    </div>
  );
}
