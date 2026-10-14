// My Documents: Syncfusion Card markup per document, grouped Ready to sign / Completed. Port of DocumentsPage.tsx.
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SigningStore } from '../../state/signing-store';
import { assetUrl } from '../../adapters/assets';
import { downloadFile } from '../../adapters/download';
import { badge, groupByStatus, resolveDates, signedAt, signedFileName } from '../../domain/rules';
import type { SigningDocument } from '../../domain/types';
import { formatDate, pages } from '../../shared/format';
import { EmptyStateComponent } from '../../shared/states';
import { DocCardComponent } from './doc-card.component';
import type { CardView } from './doc-card.component';


@Component({
  selector: 'app-documents',
  imports: [DocCardComponent, EmptyStateComponent],
  templateUrl: './documents.component.html',
  host: { style: 'display: block' },
})
export class DocumentsComponent {
  private readonly store = inject(SigningStore);
  private readonly router = inject(Router);

  protected readonly groups = computed(() => {
    const catalogue = this.store.catalogue;
    if (!catalogue) return { ready: [], completed: [] };
    const session = this.store.session();
    const today = this.store.today;
    const view = (doc: SigningDocument): CardView => {
      const dates = resolveDates(doc, today);
      const signed = signedAt(doc, session, today);
      const b = badge(doc, session);
      const done = signed !== null && b === 'completed';
      return { doc, badge: b, received: formatDate(dates.received), due: dates.due ? formatDate(dates.due) : null,
        signed: done && signed ? formatDate(signed) : null, done, length: pages(doc.pageCount) };
    };
    const { ready, completed } = groupByStatus(catalogue.documents, session, today);
    return { ready: ready.map(view), completed: completed.map(view) };
  });

  constructor() { document.title = 'My Documents · E-Signing Portal'; }

  protected open(doc: SigningDocument): void { void this.router.navigate(['/sign', doc.id]); }

  protected download(doc: SigningDocument): void {
    const entry = this.store.session()[doc.id];
    downloadFile(entry ? entry.signedUrl : assetUrl(doc.file), entry ? entry.fileName : signedFileName(doc.title));
  }
}
