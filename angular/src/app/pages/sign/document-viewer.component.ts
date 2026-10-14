// The PDF Viewer with its loading and failure states. Port of the reference's DocumentViewer.tsx: same viewer
// configuration, same element ids, and the same workarounds (typed-name prefill, keyboard access to the signature
// dialog's tabs, keyboard signing, field centring), written for Angular.
import { Component, DestroyRef, ViewChild, inject, input, output, signal } from '@angular/core';
import {
  AnnotationService, BookmarkViewService, FormDesignerService, FormFieldsService, MagnificationService, NavigationService,
  PdfViewerComponent, PdfViewerModule, ToolbarService,
} from '@syncfusion/ej2-angular-pdfviewer';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { absoluteAssetUrl } from '../../adapters/assets';
import type { FieldDefinition, FieldValues } from '../../domain/types';
import { AppLoadingComponent, ErrorStateComponent } from '../../shared/states';

// Open-licence handwriting fonts for the Type tab (bundled through angular.json). The viewer accepts exactly four.
export const SIGNATURE_FONTS = ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat'];
// The viewer lays form fields out in CSS pixels at 96 dpi; the catalogue stores PDF points (72 per inch).
const POINTS_TO_VIEWER = 96 / 72;
export const VIEWER_ID = 'signing-viewer';
// A file the engine cannot read can end with neither documentLoad nor documentLoadFailed; never spin for ever.
const LOAD_TIMEOUT_MS = 120000;
const PREFILL_SETTLE_MS = 1500;

interface ViewerField { id?: string; name?: string; value?: string }
// The members used here (skill: api-methods.md, form-field-settings.md).
interface ViewerInstance {
  retrieveFormFields(): ViewerField[];
  focusFormField(field: unknown): void;
  saveAsBlob(): Promise<Blob>;
  clearFormFields(field?: unknown): void;
  formDesigner?: { addFormField(type: string, options: object): unknown; updateFormField(id: string, options: object): void };
}

@Component({
  selector: 'app-document-viewer',
  imports: [PdfViewerModule, ButtonModule, AppLoadingComponent, ErrorStateComponent],
  // Services the viewer uses, provided on this component (skill: getting-started.md). BookmarkView has no visible
  // part here, but focusFormField calls into it.
  providers: [ToolbarService, MagnificationService, NavigationService, BookmarkViewService, AnnotationService, FormFieldsService, FormDesignerService],
  template: `
    @if (state() === 'failed') {
      <div class="viewer-area">
        <app-error-state title="We couldn't open this document." message="Check your connection and try again.">
          <button ejs-button cssClass="e-primary" (click)="retry()">Try again</button>
        </app-error-state>
      </div>
    } @else {
      <div class="viewer-area" [attr.data-viewer-state]="state()">
        @if (state() === 'loading') { <app-loading variant="overlay" label="Loading document…" /> }
        @for (key of attempts(); track key) {
          <ejs-pdfviewer #viewer [id]="viewerId" [documentPath]="url()" [resourceUrl]="resourceUrl" height="100%"
            [toolbarSettings]="toolbarSettings" contextMenuOption="None" [enableNavigationToolbar]="false"
            [enableAnnotationToolbar]="false" [isFormDesignerToolbarVisible]="false" [enableLocalStorage]="true"
            [signatureFieldSettings]="signatureSettings" [handWrittenSignatureSettings]="signatureSettings"
            (documentLoad)="handleLoad()" (documentLoadFailed)="state.set('failed')"
            (formFieldFocusOut)="valuesChanged.emit()" (formFieldPropertiesChange)="valuesChanged.emit()" (addSignature)="valuesChanged.emit()">
          </ejs-pdfviewer>
        }
      </div>
    }`,
  host: { style: 'display: contents' },
})
export class DocumentViewerComponent {
  /** Absolute or blob URL of the PDF. */
  readonly url = input.required<string>();
  /** Fields to add once the document has loaded; empty for a read-only review. */
  readonly fields = input<readonly FieldDefinition[]>([]);
  /** The signed-in person's name, filled into the signature dialog's Type tab when its name box is empty. */
  readonly typedName = input<string>();
  readonly ready = output<void>();
  readonly valuesChanged = output<void>();

  @ViewChild('viewer') private viewerRef?: PdfViewerComponent;
  protected readonly viewerId = VIEWER_ID;
  protected readonly state = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly attempts = signal([0]);
  protected readonly resourceUrl = absoluteAssetUrl('ej2-pdfviewer-lib');
  // The signer reads, moves between pages and zooms. The document comes from the portal (no Open), and Download is
  // the portal's own button: the viewer's would export the unflattened working copy.
  protected readonly toolbarSettings = { toolbarItems: ['PageNavigationTool', 'MagnificationTool'] } as never;
  protected readonly signatureSettings = { typeSignatureFonts: SIGNATURE_FONTS } as never;
  private seeded = false;
  private loadTimer = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.startLoadTimer();
    const prefill = window.setInterval(() => this.prefillTypedName(), 200);
    const onKey = (event: KeyboardEvent) => { this.tabKeys(event); this.keyboardSign(event); };
    document.addEventListener('keydown', onKey, true);
    destroyRef.onDestroy(() => {
      window.clearTimeout(this.loadTimer);
      window.clearInterval(prefill);
      document.removeEventListener('keydown', onKey, true);
    });
  }

  private instance(): ViewerInstance | null {
    const fromRef = this.viewerRef as unknown as ViewerInstance | undefined;
    if (fromRef?.retrieveFormFields) return fromRef;
    const el = document.getElementById(VIEWER_ID) as (HTMLElement & { ej2_instances?: ViewerInstance[] }) | null;
    return el?.ej2_instances?.[0] ?? null;
  }

  /** Current value of every field, by name. */
  readValues(): FieldValues {
    const out: Record<string, string> = {};
    // retrieveFormFields() returns the same objects mutated in place, so read values out rather than keep them.
    for (const f of this.instance()?.retrieveFormFields() ?? []) if (f?.name) out[f.name] = typeof f.value === 'string' ? f.value : '';
    return out;
  }

  focusField(name: string): void {
    const viewer = this.instance();
    if (!viewer) return;
    viewer.focusFormField(name); // goes to the field's page and focuses it
    // The viewer stops with the page top (or the field's lower edge) in view, so a field low on a page can sit at
    // the bottom edge or below it. Once its page has drawn, bring the field to the middle of the view.
    const id = viewer.retrieveFormFields().find((f) => f?.name === name)?.id;
    if (!id) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tries = 0;
    const centre = () => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' }); return; }
      if (++tries < 20) window.setTimeout(centre, 150);
    };
    window.setTimeout(centre, 350);
  }

  /** Empties one field (removes a signature) so it can be filled again. */
  clearField(name: string): void {
    const viewer = this.instance();
    const field = viewer?.retrieveFormFields().find((f) => f?.name === name);
    if (viewer && field) viewer.clearFormFields(field); // documented method; needs the Annotation service for signatures
  }

  /** The working copy with signatures and field values, as the viewer saves it. */
  async save(): Promise<Blob> {
    const viewer = this.instance();
    if (!viewer) throw new Error('The document is not open.');
    // Field borders and fills are editing aids; clear them on the live viewer so they are not baked into the signed copy.
    for (const f of viewer.retrieveFormFields()) {
      if (f?.id) { try { viewer.formDesigner?.updateFormField(f.id, { borderColor: 'transparent', backgroundColor: 'transparent' }); } catch { /* the field is still saved */ } }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const blob = await Promise.resolve(viewer.saveAsBlob());
    if (!blob) throw new Error('The viewer could not export the document.');
    return blob;
  }

  protected handleLoad(): void {
    window.clearTimeout(this.loadTimer);
    this.state.set('ready');
    if (!this.seeded) {
      this.seeded = true;
      const designer = this.instance()?.formDesigner;
      for (const f of this.fields()) {
        const b = f.bounds;
        designer?.addFormField(f.type === 'signature' ? 'SignatureField' : 'Textbox', {
          name: f.name,
          pageNumber: f.page, // 1-based; without it every field lands on the page in view
          bounds: { X: b.X * POINTS_TO_VIEWER, Y: b.Y * POINTS_TO_VIEWER, Width: b.Width * POINTS_TO_VIEWER, Height: b.Height * POINTS_TO_VIEWER },
          isRequired: f.required,
          tooltip: f.required ? `${f.label} (required)` : `${f.label} (optional)`,
        });
      }
    }
    this.ready.emit();
    this.valuesChanged.emit();
  }

  protected retry(): void {
    this.seeded = false;
    this.state.set('loading');
    this.attempts.update(([n]) => [n + 1]);
    this.startLoadTimer();
  }

  private startLoadTimer(): void {
    window.clearTimeout(this.loadTimer);
    this.loadTimer = window.setTimeout(() => { if (this.state() === 'loading') this.state.set('failed'); }, LOAD_TIMEOUT_MS);
  }

  // The signature dialog belongs to the viewer and is rebuilt on every open; it has no property for a default typed
  // name. While the Type tab's name box is shown and empty, fill in the person's name once per opening and fire the
  // input events the dialog draws its four font previews from. The person can still change it.
  // The fill is keyed to the Type tab being shown, not to the box element: the viewer can empty the box when the tab
  // is selected again or while it finishes switching in (the port missed the name about one run in six when it filled
  // once per element). Each time the box becomes visible it may be filled, and a box emptied within
  // PREFILL_SETTLE_MS of being shown is filled again; after that an empty box is the person's own choice.
  private shownAt = 0;
  private prefillTypedName(): void {
    const name = this.typedName();
    if (!name) return;
    const dialog = document.getElementById(`${VIEWER_ID}_signature_window`);
    const box = dialog?.classList.contains('e-popup-open') ? dialog.querySelector<HTMLInputElement>('input[id$="_e-pv-Signtext-box"]') : null;
    if (!box || box.offsetParent === null) { this.shownAt = 0; return; }
    if (!this.shownAt) this.shownAt = Date.now();
    if (box.value || Date.now() - this.shownAt > PREFILL_SETTLE_MS) return;
    box.value = name;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
  }

  // Keyboard access to the signature dialog's tabs: in 34.2.8 the arrow keys do nothing on its tab strip, so Type
  // and Upload (the alternatives to drawing) could not be reached without a mouse. Left/Right/Home/End select tabs
  // through the Tab control's documented select().
  private tabKeys(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const dialog = document.getElementById(`${VIEWER_ID}_signature_window`);
    const active = document.activeElement as HTMLElement | null;
    if (!dialog?.classList.contains('e-popup-open') || !active || !dialog.contains(active)) return;
    const tabEl = document.getElementById(`${VIEWER_ID}Signature_tab`) as (HTMLElement & { ej2_instances?: Array<{ selectedItem: number; select(index: number): void }> }) | null;
    const tab = tabEl?.ej2_instances?.[0];
    if (!tabEl || !tab || !active.closest('.e-tab-header')) return;
    const count = tabEl.querySelectorAll('.e-tab-header .e-toolbar-item:not(.e-hidden)').length;
    if (count < 2) return;
    const current = tab.selectedItem ?? 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
    event.preventDefault();
    event.stopPropagation();
    tab.select(next);
  }

  // Keyboard signing: with a signature field focused, the viewer's own Enter handling opens the dialog without
  // recording the field, and Create then throws (34.2.8). Enter or Space on a focused, unsigned signature field is
  // turned into the pointer sequence the viewer handles correctly.
  private keyboardSign(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const active = document.activeElement as HTMLElement | null;
    const host = document.getElementById(VIEWER_ID);
    if (!active || !host?.contains(active) || !active.classList.contains('foreign-object')) return;
    const field = active.querySelector<HTMLElement>('.e-pdfviewer-signatureformfields');
    if (!field) return;
    event.preventDefault();
    event.stopPropagation();
    const r = field.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, view: window };
    field.dispatchEvent(new PointerEvent('pointerdown', { ...at, buttons: 1 }));
    field.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
    field.dispatchEvent(new PointerEvent('pointerup', at));
    field.dispatchEvent(new MouseEvent('mouseup', at));
    field.dispatchEvent(new MouseEvent('click', at));
  }
}
