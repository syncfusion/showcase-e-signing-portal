import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

// Zone-based change detection, without event coalescing: the plan's recorded fallback from Angular 21's zoneless
// default. Zoneless (and zone.js with eventCoalescing) checks a newly routed page in a later task, so the browser
// painted My Documents' headings with empty lists for one frame when going back to it (caught by the reference
// journey's step 8; probe in the prototype evidence). Checking in the same task renders the page complete, as the
// React reference does. Template values are still signals.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
