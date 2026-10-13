import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  PdfViewerComponent, Toolbar, Magnification, Navigation, BookmarkView, Annotation, FormFields, FormDesigner, Inject,
} from '@syncfusion/ej2-react-pdfviewer';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { absoluteAssetUrl } from '../../../adapters/basePath';
import type { FieldDefinition, FieldValues } from '../../../domain/types';
import { AppLoading } from '../../components/AppLoading';
import { ErrorState } from '../../components/States';

// Open-licence handwriting fonts for the Type tab (loaded in main.tsx). The viewer accepts exactly four.
export const SIGNATURE_FONTS = ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat'];
// The viewer lays form fields out in CSS pixels at 96 dpi; the catalogue stores PDF points (72 per inch).
const POINTS_TO_VIEWER = 96 / 72;
const VIEWER_ID = 'signing-viewer';
// A file the engine cannot read can end with neither documentLoad nor documentLoadFailed; never spin for ever.
// Long enough for a cold load on a slow connection: the measured fast-3G load of the engine and a document was
// about 30 seconds, so a shorter limit would report a failure on a document that is still arriving.
const LOAD_TIMEOUT_MS = 120000;

interface ViewerField { id?: string; name?: string; value?: string }
// The members used here, as declared in the installed typings (pdfviewer.d.ts, form-designer.d.ts).
interface ViewerInstance {
  retrieveFormFields(): ViewerField[];
  focusFormField(field: unknown): void;
  saveAsBlob(): Promise<Blob>;
  clearFormFields(field?: unknown): void;
  formDesigner?: { addFormField(type: string, options: object): unknown; updateFormField(id: string, options: object): void };
}

export interface DocumentViewerHandle {
  /** Current value of every field, by name. */
  readValues(): FieldValues;
  focusField(name: string): void;
  /** Empties one field (removes a signature) so it can be filled again. */
  clearField(name: string): void;
  /** The working copy with signatures and field values, as the viewer saves it. */
  save(): Promise<Blob>;
}

interface Props {
  /** Absolute or blob URL of the PDF. */
  url: string;
  /** Fields to add once the document has loaded; empty for a read-only review. */
  fields: readonly FieldDefinition[];
  /** The signed-in person's name, filled into the signature dialog's Type tab when its name box is empty. */
  typedName?: string;
  onReady?(): void;
  onValuesChanged?(): void;
}

/** The PDF Viewer with its loading and failure states (app-source-baseline.md, "Heavy controls"). */
export const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(function DocumentViewer({ url, fields, typedName, onReady, onValuesChanged }, ref) {
  const viewerRef = useRef<InstanceType<typeof PdfViewerComponent>>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const seeded = useRef(false);

  const instance = useCallback((): ViewerInstance | null => {
    const fromRef = viewerRef.current as unknown as ViewerInstance | null;
    if (fromRef?.retrieveFormFields) return fromRef;
    const el = document.getElementById(VIEWER_ID) as (HTMLElement & { ej2_instances?: ViewerInstance[] }) | null;
    return el?.ej2_instances?.[0] ?? null;
  }, []);

  useImperativeHandle(ref, () => ({
    readValues() {
      const out: Record<string, string> = {};
      // retrieveFormFields() returns the same objects mutated in place, so read values out rather than keep them.
      for (const f of instance()?.retrieveFormFields() ?? []) if (f?.name) out[f.name] = typeof f.value === 'string' ? f.value : '';
      return out;
    },
    focusField(name) {
      const viewer = instance();
      if (!viewer) return;
      viewer.focusFormField(name); // goes to the field's page and focuses it
      // The viewer stops with the page top (or the field's lower edge) in view, so a field low on a page can sit
      // at the bottom edge or below it. Once its page has drawn, bring the field to the middle of the view.
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
    },
    clearField(name) {
      const viewer = instance();
      const field = viewer?.retrieveFormFields().find((f) => f?.name === name);
      if (viewer && field) viewer.clearFormFields(field); // documented PdfViewer method; needs the Annotation service for signatures
    },
    async save() {
      const viewer = instance();
      if (!viewer) throw new Error('The document is not open.');
      // Field borders and fills are editing aids; clear them on the live viewer so they are not baked into the signed copy.
      for (const f of viewer.retrieveFormFields()) {
        if (f?.id) { try { viewer.formDesigner?.updateFormField(f.id, { borderColor: 'transparent', backgroundColor: 'transparent' }); } catch { /* the field is still saved */ } }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      const blob = await Promise.resolve(viewer.saveAsBlob());
      if (!blob) throw new Error('The viewer could not export the document.');
      return blob;
    },
  }), [instance]);

  const handleLoad = useCallback(() => {
    setState('ready');
    if (!seeded.current) {
      seeded.current = true;
      const designer = instance()?.formDesigner;
      for (const f of fields) {
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
    onReady?.();
    onValuesChanged?.();
  }, [fields, instance, onReady, onValuesChanged]);

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = window.setTimeout(() => setState('failed'), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);

  // The signature dialog belongs to the viewer and is rebuilt on every open; it has no property for a default
  // typed name. While the Type tab's name box is shown and empty, fill in the person's name once per opening
  // and fire the input events the dialog draws its four font previews from. The person can still change it.
  useEffect(() => {
    if (!typedName) return;
    let filledFor: Element | null = null;
    const timer = window.setInterval(() => {
      const dialog = document.getElementById(`${VIEWER_ID}_signature_window`);
      if (!dialog || !dialog.classList.contains('e-popup-open')) { filledFor = null; return; }
      const box = dialog.querySelector<HTMLInputElement>('input[id$="_e-pv-Signtext-box"]');
      if (!box || box.offsetParent === null || filledFor === box) return;
      filledFor = box;
      if (box.value) return;
      box.value = typedName;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
    }, 200);
    return () => window.clearInterval(timer);
  }, [typedName]);

  // Keyboard access to the signature dialog's tabs. The dialog puts focus on its tab strip when it opens, but in
  // 34.2.8 the arrow keys do nothing there, so Type and Upload (the alternatives to drawing with a pointer) could
  // not be reached without a mouse. Left and Right now move between the tabs through the Tab control's own
  // documented select(); Home and End go to the first and last.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const dialog = document.getElementById(`${VIEWER_ID}_signature_window`);
      const active = document.activeElement as HTMLElement | null;
      if (!dialog?.classList.contains('e-popup-open') || !active || !dialog.contains(active)) return;
      const tabEl = document.getElementById(`${VIEWER_ID}Signature_tab`) as (HTMLElement & { ej2_instances?: Array<{ selectedItem: number; select(index: number): void }> }) | null;
      const tab = tabEl?.ej2_instances?.[0];
      // Only from the tab strip itself, never while typing in the name box or drawing.
      if (!tabEl || !tab || !active.closest('.e-tab-header')) return;
      const count = tabEl.querySelectorAll('.e-tab-header .e-toolbar-item:not(.e-hidden)').length;
      if (count < 2) return;
      const current = tab.selectedItem ?? 0;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
      event.preventDefault();
      event.stopPropagation();
      tab.select(next);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // Keyboard signing. With a signature field focused, the viewer's own Enter handling opens the dialog without
  // recording which field it is for, and Create then throws ("Cannot read properties of undefined (reading
  // 'name')" in drawSignature, 34.2.8). Enter or Space on a focused, unsigned signature field is therefore turned
  // into the pointer sequence the viewer handles correctly.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const active = document.activeElement as HTMLElement | null;
      const host = document.getElementById(VIEWER_ID);
      if (!active || !host?.contains(active) || !active.classList.contains('foreign-object')) return;
      const field = active.querySelector<HTMLElement>('.e-pdfviewer-signatureformfields');
      if (!field) return; // not a signature field, or already signed
      event.preventDefault();
      event.stopPropagation();
      const r = field.getBoundingClientRect();
      const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, view: window };
      field.dispatchEvent(new PointerEvent('pointerdown', { ...at, buttons: 1 }));
      field.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
      field.dispatchEvent(new PointerEvent('pointerup', at));
      field.dispatchEvent(new MouseEvent('mouseup', at));
      field.dispatchEvent(new MouseEvent('click', at));
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // On failure the viewer is taken down, or its own error dialog would cover the message.
  const handleFailed = useCallback(() => setState('failed'), []);
  const retry = () => { seeded.current = false; setState('loading'); setAttempt((n) => n + 1); };

  if (state === 'failed') {
    return (
      <div className="viewer-area">
        <ErrorState title="We couldn't open this document." message="Check your connection and try again.">
          <ButtonComponent cssClass="e-primary" onClick={retry}>Try again</ButtonComponent>
        </ErrorState>
      </div>
    );
  }
  return (
    <div className="viewer-area" data-viewer-state={state}>
      {state === 'loading' && <AppLoading variant="overlay" label="Loading document…" />}
      <PdfViewerComponent
        key={attempt}
        ref={viewerRef}
        id={VIEWER_ID}
        documentPath={url}
        resourceUrl={absoluteAssetUrl('ej2-pdfviewer-lib')}
        height="100%"
        // The signer reads, moves between pages and zooms. The document comes from the portal (no Open), and
        // Download is the portal's own button: the viewer's would export the unflattened working copy.
        toolbarSettings={{ toolbarItems: ['PageNavigationTool', 'MagnificationTool'] }}
        contextMenuOption="None"
        enableNavigationToolbar={false}
        enableAnnotationToolbar={false}
        isFormDesignerToolbarVisible={false}
        // Keeps the viewer's working data in memory instead of sessionStorage: the app stores nothing in the browser.
        enableLocalStorage={true}
        signatureFieldSettings={{ typeSignatureFonts: SIGNATURE_FONTS }}
        handWrittenSignatureSettings={{ typeSignatureFonts: SIGNATURE_FONTS }}
        documentLoad={handleLoad}
        documentLoadFailed={handleFailed}
        formFieldFocusOut={onValuesChanged}
        formFieldPropertiesChange={onValuesChanged}
        addSignature={onValuesChanged}
      >
        {/* BookmarkView has no visible part here (the navigation pane is off), but focusFormField calls into it:
            without it the viewer throws "Cannot read properties of undefined (reading 'goToBookmark')". */}
        <Inject services={[Toolbar, Magnification, Navigation, BookmarkView, Annotation, FormFields, FormDesigner]} />
      </PdfViewerComponent>
    </div>
  );
});
