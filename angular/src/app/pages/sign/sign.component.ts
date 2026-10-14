// Sign Document: review and sign a ready document, or review a completed one read-only. Port of SignPage.tsx.
import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { DialogModule } from '@syncfusion/ej2-angular-popups';
import type { ButtonPropsModel } from '@syncfusion/ej2-angular-popups';
import { LucideArrowLeft, LucideArrowRight, LucideCheck, LucideCircleCheck, LucideDownload, LucideListChecks, LucidePenLine } from '@lucide/angular';
import { SigningStore } from '../../state/signing-store';
import { Notifier } from '../../state/notifier.service';
import { absoluteAssetUrl } from '../../adapters/assets';
import { downloadFile } from '../../adapters/download';
import { signedCopyFinalizer } from '../../adapters/pdf-finalizer';
import {
  canFinish, hasValue, inReadingOrder, nextOpenField, nextUnsignedField, remainingRequired, signedAt, signedFileName, statusOf, stillRequiredMessage,
} from '../../domain/rules';
import type { FieldValues } from '../../domain/types';
import { formatDate } from '../../shared/format';
import { ErrorStateComponent } from '../../shared/states';
import { DocumentViewerComponent, VIEWER_ID } from './document-viewer.component';

@Component({
  selector: 'app-sign',
  imports: [NgTemplateOutlet, RouterLink, ButtonModule, DialogModule, ErrorStateComponent, DocumentViewerComponent,
    LucideArrowLeft, LucideArrowRight, LucideCheck, LucideCircleCheck, LucideDownload, LucideListChecks, LucidePenLine],
  templateUrl: './sign.component.html',
  host: { style: 'display: contents' },
})
export class SignComponent {
  /** Route parameter (withComponentInputBinding). */
  readonly documentId = input<string>();
  private readonly store = inject(SigningStore);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  @ViewChild(DocumentViewerComponent) private viewer?: DocumentViewerComponent;
  @ViewChild('wrap') private wrapRef?: ElementRef<HTMLElement>;

  protected readonly profile = this.store.catalogue?.profile ?? null;
  protected readonly doc = computed(() => this.store.document(this.documentId()));
  /** A completed document opens the same route read-only: the signed copy, no fields. */
  protected readonly mode = computed(() => {
    const doc = this.doc();
    return !doc ? 'missing' : statusOf(doc, this.store.session()) === 'completed' ? 'review' : 'sign';
  });
  /** Fixed when the page opens, so finishing does not swap the signing view for the review under the person. */
  protected readonly openedAs = signal<'sign' | 'review' | 'missing' | null>(null);

  // Review mode.
  protected readonly review = computed(() => {
    const doc = this.doc();
    if (!doc) return null;
    const entry = this.store.session()[doc.id];
    const signed = signedAt(doc, this.store.session(), this.store.today);
    return { url: entry ? entry.signedUrl : absoluteAssetUrl(doc.file), fileName: entry ? entry.fileName : signedFileName(doc.title),
      signed: signed ? ` on ${formatDate(signed)}` : '' };
  });

  // Signing mode.
  protected readonly fields = computed(() => inReadingOrder(this.doc()?.fields ?? []));
  protected readonly values = signal<FieldValues>({});
  protected readonly ready = signal(false);
  protected readonly finishing = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly fieldsOpen = signal(false);
  protected readonly narrow = signal(window.matchMedia('(max-width: 1023.98px)').matches);
  protected readonly remaining = computed(() => remainingRequired(this.fields(), this.values()));
  protected readonly openFields = computed(() => this.fields().filter((f) => !hasValue(this.values(), f.name)).length);
  protected readonly rows = computed(() => this.fields().map((f) => {
    const filled = hasValue(this.values(), f.name);
    const name = this.profile?.fullName ?? '';
    const state = f.type === 'signature'
      ? (filled ? `Signed by ${name}` : (f.required ? 'Required · page ' : 'Optional · page ') + f.page)
      : (filled ? 'Filled in' : (f.required ? 'Required' : 'Optional') + ' · page ' + f.page);
    return { field: f, filled, state };
  }));
  protected readonly docUrl = computed(() => { const d = this.doc(); return d ? absoluteAssetUrl(d.file) : ''; });
  protected readonly body = document.body;
  protected readonly confirmButtons: ButtonPropsModel[] = [
    { buttonModel: { content: 'Cancel' }, click: () => this.confirmOpen.set(false) },
    { buttonModel: { content: 'Finish signing', isPrimary: true }, click: () => { void this.confirmFinish(); } },
  ];
  private lastFocused: string | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      const doc = this.doc();
      if (this.openedAs() === null && this.documentId() !== undefined) this.openedAs.set(this.mode());
      document.title = !doc ? 'Document not found · E-Signing Portal'
        : this.openedAs() === 'review' ? `${doc.title} (signed) · E-Signing Portal` : `Sign ${doc.title} · E-Signing Portal`;
    });
    const mql = window.matchMedia('(max-width: 1023.98px)');
    const onMedia = () => this.narrow.set(mql.matches);
    mql.addEventListener('change', onMedia);
    // The viewer's field events do not fire for every change (a signature added from its dialog, for one), so the
    // field collection is also read on a short interval while the page is open.
    const refreshTimer = window.setInterval(() => this.refresh(), 500);
    // The Next button sits just outside the PDF page's left edge. The viewer centres the page and moves it when the
    // window or the zoom changes, and reports neither, so the page's position is read on a short interval.
    const placeTimer = window.setInterval(() => this.placeFlag(), 250);
    window.addEventListener('resize', this.placeFlag);
    destroyRef.onDestroy(() => {
      mql.removeEventListener('change', onMedia);
      window.clearInterval(refreshTimer);
      window.clearInterval(placeTimer);
      window.removeEventListener('resize', this.placeFlag);
    });
  }

  protected refresh(): void {
    const next = this.viewer?.readValues();
    if (!next || this.openedAs() !== 'sign') return;
    const prev = this.values();
    if (!this.fields().every((f) => (prev[f.name] ?? '') === (next[f.name] ?? ''))) this.values.set(next);
  }

  protected onReady(): void { this.ready.set(true); setTimeout(this.placeFlag, 0); }

  private readonly placeFlag = (): void => {
    const wrap = this.wrapRef?.nativeElement;
    const flag = wrap?.querySelector<HTMLElement>('.next-flag');
    const pageEl = wrap?.querySelector<HTMLElement>(`[id^="${VIEWER_ID}_pageDiv_"]`);
    if (!wrap || !flag || !pageEl) return;
    const gap = 4;
    // Room is judged against the full button, measured once while its label is showing.
    if (flag.dataset['beside'] !== 'viewer') flag.dataset['fullWidth'] = String(flag.offsetWidth);
    const room = pageEl.getBoundingClientRect().left - wrap.getBoundingClientRect().left - Number(flag.dataset['fullWidth'] ?? flag.offsetWidth) - gap;
    // No room beside the page: stay at the viewer's own edge as an arrow only; the label remains its accessible name.
    flag.dataset['beside'] = room >= 0 ? 'page' : 'viewer';
    flag.style.left = `${Math.max(0, Math.round(room))}px`;
  };

  protected focusField(name: string): void {
    this.lastFocused = name;
    this.fieldsOpen.set(false);
    this.viewer?.focusField(name);
  }

  protected clearField(name: string): void {
    this.viewer?.clearField(name);
    window.setTimeout(() => this.refresh(), 150);
  }

  /** Next visits every field that still needs input, optional ones included, in reading order. */
  protected onNext(): void {
    const current = this.viewer?.readValues() ?? this.values();
    const next = nextOpenField(this.fields(), current, this.lastFocused);
    if (next) this.focusField(next.name);
  }

  protected onFinish(): void {
    this.refresh();
    const current = this.viewer?.readValues() ?? this.values();
    if (!canFinish(this.fields(), current)) {
      const missing = remainingRequired(this.fields(), current);
      this.notifier.notify(stillRequiredMessage(missing), 'Sign the highlighted field to continue.', 'warning');
      const first = nextUnsignedField(this.fields(), current);
      if (first) this.focusField(first.name);
      return;
    }
    this.confirmOpen.set(true);
  }

  private async confirmFinish(): Promise<void> {
    const doc = this.doc();
    if (!doc || !this.viewer) return;
    this.confirmOpen.set(false);
    this.finishing.set(true);
    try {
      const saved = await this.viewer.save();
      const { pdf, watermarked } = await signedCopyFinalizer.finalize(saved);
      this.store.completeDocument(doc, pdf);
      await this.router.navigate(['/complete', doc.id]);
      if (!watermarked) this.notifier.notify('Signed without a watermark', 'The watermark image could not be loaded. Your signed document is complete.', 'warning');
    } catch (error) {
      console.error('Signing could not be completed', error);
      this.finishing.set(false);
      this.notifier.notify('We couldn\'t finish signing', 'Your signature is still on the document. Try Finish Signing again.', 'danger');
    }
  }

  protected download(url: string, fileName: string): void { downloadFile(url, fileName); }
}
