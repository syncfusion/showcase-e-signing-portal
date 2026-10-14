// Signing Complete: the confirmation card after a signing in this session. Port of CompletePage.tsx.
import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { LucideCircleCheck, LucideDownload, LucideEye } from '@lucide/angular';
import { SigningStore } from '../../state/signing-store';
import { downloadFile } from '../../adapters/download';
import { formatDateTime } from '../../shared/format';

@Component({
  selector: 'app-complete',
  imports: [ButtonModule, LucideCircleCheck, LucideDownload, LucideEye],
  template: `
    @if (view(); as v) {
      <div class="page complete-page">
        <section class="e-card complete-panel" aria-labelledby="complete-title">
          <div class="e-card-header">
            <span class="complete-icon" aria-hidden="true"><svg lucideCircleCheck [size]="28"></svg></span>
            <div class="e-card-header-caption">
              <h1 class="e-card-header-title" id="complete-title" tabindex="-1">Thank you, {{ v.firstName }}</h1>
              <div class="e-card-sub-title">Signing complete! You may now view or download your signed document.</div>
            </div>
          </div>
          <div class="e-card-content">
            <dl class="complete-facts">
              <div><dt>Document</dt><dd>{{ v.doc.title }}</dd></div>
              <div><dt>Signed</dt><dd>{{ v.signedAt }}</dd></div>
              <div><dt>Signed by</dt><dd>{{ v.fullName }}</dd></div>
            </dl>
            <div class="complete-note">We have everything we need at this stage. The signed copy is read-only.</div>
          </div>
          <div class="e-card-actions">
            <div class="complete-actions">
              <button ejs-button cssClass="e-outline" (click)="review(v.doc.id)"><svg lucideEye [size]="16"></svg><span>Review Documents</span></button>
              <button ejs-button cssClass="e-primary" (click)="download(v.url, v.fileName)"><svg lucideDownload [size]="16"></svg><span>Download Documents</span></button>
              <button ejs-button cssClass="e-flat" (click)="back()"><span>Back to My Documents</span></button>
            </div>
          </div>
        </section>
      </div>
    }`,
  host: { style: 'display: block' },
})
export class CompleteComponent {
  /** Route parameter (withComponentInputBinding). */
  readonly documentId = input<string>();
  private readonly store = inject(SigningStore);
  private readonly router = inject(Router);

  protected readonly view = computed(() => {
    const catalogue = this.store.catalogue;
    const doc = this.store.document(this.documentId());
    const entry = doc ? this.store.session()[doc.id] : undefined;
    if (!catalogue || !doc || !entry) return null;
    return { doc, firstName: catalogue.profile.firstName, fullName: catalogue.profile.fullName,
      signedAt: formatDateTime(new Date(entry.signedAt)), url: entry.signedUrl, fileName: entry.fileName };
  });

  constructor() {
    // Reached only after a signing in this session: the route's guard (app.routes.ts) sends anything else to the list.
    document.title = 'Signing Complete · E-Signing Portal';
  }

  protected review(id: string): void { void this.router.navigate(['/sign', id]); }
  protected download(url: string, fileName: string): void { downloadFile(url, fileName); }
  protected back(): void { void this.router.navigate(['/documents']); }
}
