// The tab's signing session: the validated catalogue plus an in-memory overlay of documents signed here.
// Nothing is written to browser storage; a reload or Reset returns to the baseline (reference app-plan.md,
// "Profiles"). Port of the React reference's SigningStore context, as a service with signals.
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { loadCatalogue } from '../adapters/catalogue';
import type { CatalogueResult } from '../adapters/catalogue';
import { browserClock } from '../adapters/clock';
import type { Clock } from '../adapters/clock';
import { signedFileName, statusOf } from '../domain/rules';
import type { Catalogue, SigningDocument, SigningSession } from '../domain/types';

export const CLOCK = new InjectionToken<Clock>('Clock', { providedIn: 'root', factory: () => browserClock });
export const CATALOGUE = new InjectionToken<CatalogueResult>('Catalogue', { providedIn: 'root', factory: () => loadCatalogue() });

@Injectable({ providedIn: 'root' })
export class SigningStore {
  private readonly clock = inject(CLOCK);
  readonly load = inject(CATALOGUE);
  readonly catalogue: Catalogue | null = this.load.ok ? this.load.catalogue : null;
  /** Fixed for the session, so dates do not shift while the app is open. */
  readonly today = this.clock.now();
  private readonly sessionState = signal<SigningSession>({});
  readonly session = this.sessionState.asReadonly();
  readonly signedCount = computed(() => Object.keys(this.sessionState()).length);
  private urls: string[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokeAll());
  }

  /** Records a finished document; the blob is the flattened signed PDF. */
  completeDocument(doc: SigningDocument, signedPdf: Blob): void {
    const signedUrl = URL.createObjectURL(signedPdf);
    this.urls.push(signedUrl);
    this.sessionState.update((s) => (statusOf(doc, s) === 'completed' ? s
      : { ...s, [doc.id]: { signedAt: this.clock.now().toISOString(), signedUrl, fileName: signedFileName(doc.title) } }));
  }

  reset(): void {
    this.revokeAll();
    this.sessionState.set({});
  }

  document(id: string | null | undefined): SigningDocument | undefined {
    return this.catalogue?.documents.find((d) => d.id === id);
  }

  private revokeAll(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];
  }
}
