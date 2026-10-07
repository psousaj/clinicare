import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { PageLoadingIndicator } from '@/components/PageLoadingIndicator';

export const Route = createRootRoute({
  component: () => (
    <>
      <PageLoadingIndicator />
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  ),
});
