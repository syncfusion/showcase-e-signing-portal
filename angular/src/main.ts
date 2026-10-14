import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// The Syncfusion license is activated before start, build and test by `npx syncfusion-license activate`, which
// reads the SYNCFUSION_LICENSE environment variable (syncfusion-angular-license, license-registration.md); no key
// is kept in source. The four signature fonts are bundled through angular.json "styles".

// Web fonts load on first use; the signature dialog draws typed signatures on a canvas, which needs them loaded already.
if ('fonts' in document) {
  for (const family of ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat']) void document.fonts.load(`32px "${family}"`).catch(() => undefined);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
