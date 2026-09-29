import type { UseQueryResult } from '@tanstack/react-query';

export function QueryError({ query }: { query: UseQueryResult<unknown, Error> }) {
  if (!query.isError) return null;
  return (
    <p className="section-note" role="alert">
      {query.error.message}{' '}
      <button className="text-button inline-flex" onClick={() => query.refetch()}>Tentar novamente</button>
    </p>
  );
}
