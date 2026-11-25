import { type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfirmProvider } from '../../shared/ui';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  // ConfirmProvider sits above the routes, not in AppLayout: the first access
  // and other full-screen pages render outside the layout and confirm too.
  return (
    <BrowserRouter>
      <ConfirmProvider>{children}</ConfirmProvider>
    </BrowserRouter>
  );
}
