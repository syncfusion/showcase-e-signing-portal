import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerLicense } from '@syncfusion/ej2-base'; // transitive; never add ej2-base to package.json
// Open-licence (SIL OFL 1.1) handwriting fonts for the signature dialog's Type tab, self-hosted by the build.
import '@fontsource/dancing-script/400.css';
import '@fontsource/sacramento/400.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/caveat/400.css';
import './styles/app.css';
import { resolveBasename } from './adapters/basePath';
import { loadCatalogue } from './adapters/catalogue';
import { browserClock } from './adapters/clock';
import { SigningStoreProvider } from './app/SigningStore';
import { ThemeProvider } from './ui/theme';
import { App } from './ui/App';

const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY;
if (licenseKey) registerLicense(licenseKey);

// Web fonts load on first use; the signature dialog draws typed signatures on a canvas, which needs them loaded already.
if ('fonts' in document) {
  for (const family of ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat']) void document.fonts.load(`32px "${family}"`).catch(() => undefined);
}

// Composition root. No StrictMode: the EJ2 PDF Viewer does imperative DOM setup on mount, and StrictMode's
// development-only double mount breaks it (lesson recorded in app-plan.md from the reference project).
createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <SigningStoreProvider load={loadCatalogue()} clock={browserClock}>
      <BrowserRouter basename={resolveBasename()}>
        <App />
      </BrowserRouter>
    </SigningStoreProvider>
  </ThemeProvider>,
);