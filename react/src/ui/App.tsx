import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Shell } from './shell/Shell';
import { AppLoading } from './components/AppLoading';
import { useTheme } from './theme';
import { HealthPage } from './pages/Health/HealthPage';

// Pages load on demand: the PDF Viewer's library is only downloaded on the signing route.
const DocumentsPage = lazy(() => import('./pages/Documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const SignPage = lazy(() => import('./pages/Sign/SignPage').then((m) => ({ default: m.SignPage })));
const CompletePage = lazy(() => import('./pages/Complete/CompletePage').then((m) => ({ default: m.CompletePage })));

const page = (name: string, el: ReactNode) => <Suspense fallback={<AppLoading label={`Loading ${name}…`} />}>{el}</Suspense>;

export function App() {
  const { ready } = useTheme();
  const { pathname } = useLocation();
  return (
    <>
      {/* Startup screen until the Syncfusion theme has loaded; the shell mounts underneath so page code downloads meanwhile. */}
      {!ready && pathname !== '/healthz' && <AppLoading variant="screen" label="Loading E-Signing Portal…" />}
      <Routes>
        {/* Standalone status page, outside the shell (factory/standards/health-check.md). */}
        <Route path="/healthz" element={<HealthPage />} />
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="/documents" element={page('My Documents', <DocumentsPage />)} />
          <Route path="/sign/:documentId" element={page('Sign Document', <SignPage />)} />
          <Route path="/complete/:documentId" element={page('Signing Complete', <CompletePage />)} />
          <Route path="*" element={<Navigate to="/documents" replace />} />
        </Route>
      </Routes>
    </>
  );
}