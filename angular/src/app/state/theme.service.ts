// Light or dark, kept for this tab's session only (design/DESIGN.md): a refresh keeps it, a new session starts
// from the system setting. index.html applies the stored choice before Angular starts; this service owns it after.
import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'e-signing-portal-theme';

function apply(theme: Theme): void {
  const root = document.documentElement;
  root.dataset['theme'] = theme;
  // The Syncfusion Tailwind 3 dark variant follows the e-dark-mode class (syncfusion-angular-themes, dark-mode.md);
  // on <html> so the app's :root[data-theme] tokens keep higher specificity than the theme's variables.
  root.classList.toggle('e-dark-mode', theme === 'dark');
}

/** The Syncfusion theme bundle is one stylesheet linked from index.html; the shell has no layout until it has loaded. */
function themeLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="tailwind3.css"]');
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light');
  readonly ready = signal(false);

  constructor() {
    apply(this.theme());
    const link = themeLink();
    if (!link || link.sheet) this.ready.set(true);
    else {
      const done = () => this.ready.set(true);
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', done, { once: true });
    }
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    try { sessionStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable: the choice lasts until a refresh */ }
    this.theme.set(next);
    apply(next);
  }
}
