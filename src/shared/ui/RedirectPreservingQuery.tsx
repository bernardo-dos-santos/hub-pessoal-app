import { Navigate, useLocation } from 'react-router-dom';

/**
 * Route that moved: send the old address to the new one, keeping the query —
 * pushes, alerts and bookmarks still carry the old path and its parameters.
 */
export function RedirectPreservingQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}
