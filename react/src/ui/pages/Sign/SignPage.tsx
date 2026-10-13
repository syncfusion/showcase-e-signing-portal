import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { ArrowLeft, ArrowRight, Check, CircleCheck, Download, ListChecks, PenLine } from 'lucide-react';
import { useSigningStore } from '../../../app/SigningStore';
import { absoluteAssetUrl } from '../../../adapters/basePath';
import { downloadFile } from '../../../adapters/download';
import { signedCopyFinalizer } from '../../../adapters/pdfFinalizer';
import { canFinish, hasValue, inReadingOrder, nextOpenField, nextUnsignedField, remainingRequired, signedAt, signedFileName, statusOf, stillRequiredMessage } from '../../../domain/rules';
import type { FieldValues, Profile, SigningDocument } from '../../../domain/types';
import { ErrorState } from '../../components/States';
import { useNotify } from '../../components/useNotifier';
import { useMediaQuery } from '../../useMediaQuery';
import { formatDate } from '../../format';
import { DocumentViewer } from './DocumentViewer';
import type { DocumentViewerHandle } from './DocumentViewer';

export function SignPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { catalogue, session } = useSigningStore();
  if (!catalogue) return null;
  const doc = catalogue.documents.find((d) => d.id === documentId);
  if (!doc) {
    return (
      <div className="page">
        <ErrorState title="Document not found." message="It may have been removed from your list.">
          <Link to="/documents" className="text-link">Back to My Documents</Link>
        </ErrorState>
      </div>
    );
  }
  // A completed document opens the same route read-only (app-plan.md): the signed copy, no fields.
  return statusOf(doc, session) === 'completed'
    ? <ReviewView key={`review-${doc.id}`} doc={doc} />
    : <SigningView key={`sign-${doc.id}`} doc={doc} profile={catalogue.profile} />;
}

function ReviewView({ doc }: { doc: SigningDocument }) {
  const { session, today } = useSigningStore();
  useEffect(() => { document.title = `${doc.title} (signed) · E-Signing Portal`; }, [doc.title]);
  const entry = session[doc.id];
  const url = entry ? entry.signedUrl : absoluteAssetUrl(doc.file);
  const fileName = entry ? entry.fileName : signedFileName(doc.title);
  const signed = signedAt(doc, session, today);
  return (
    <div className="sign-page" data-mode="review">
      <header className="sign-subheader">
        <Link to="/documents" className="sign-back" aria-label="Back to My Documents" title="Back to My Documents"><ArrowLeft size={18} aria-hidden="true" /></Link>
        <div className="sign-titleblock">
          <h1>{doc.title}</h1>
          <p className="sign-status" data-testid="sign-status">
            <CircleCheck size={15} aria-hidden="true" />Signed{signed ? ` on ${formatDate(signed)}` : ''} · read-only
          </p>
        </div>
        <div className="sign-actions">
          <ButtonComponent cssClass="e-primary" onClick={() => downloadFile(url, fileName)}><Download size={16} aria-hidden="true" />Download</ButtonComponent>
        </div>
      </header>
      <div className="sign-body">
        <div className="viewer-wrap"><DocumentViewer url={url} fields={[]} /></div>
      </div>
    </div>
  );
}

function SigningView({ doc, profile }: { doc: SigningDocument; profile: Profile }) {
  const { completeDocument } = useSigningStore();
  const navigate = useNavigate();
  const notify = useNotify();
  const viewer = useRef<DocumentViewerHandle>(null);
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState<FieldValues>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const lastFocused = useRef<string | undefined>(undefined);
  useEffect(() => { document.title = `Sign ${doc.title} · E-Signing Portal`; }, [doc.title]);

  const fields = useMemo(() => inReadingOrder(doc.fields), [doc.fields]);
  const refresh = useCallback(() => {
    const next = viewer.current?.readValues();
    if (!next) return;
    setValues((prev) => (fields.every((f) => (prev[f.name] ?? '') === (next[f.name] ?? '')) ? prev : next));
  }, [fields]);
  // The viewer's field events do not fire for every change (a signature added from its dialog, for one),
  // so the field collection is also read on a short interval while the page is open.
  useEffect(() => { const timer = window.setInterval(refresh, 500); return () => window.clearInterval(timer); }, [refresh]);

  const remaining = remainingRequired(fields, values);

  // The Next button sits just outside the PDF page's left edge. The viewer centres the page and moves it when the
  // window or the zoom changes, and it reports neither, so the page's position is read on a short interval.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready) return;
    const place = () => {
      const wrap = wrapRef.current;
      const flag = wrap?.querySelector<HTMLElement>('.next-flag');
      const pageEl = wrap?.querySelector<HTMLElement>('[id^="signing-viewer_pageDiv_"]');
      if (!wrap || !flag || !pageEl) return;
      const gap = 4;
      // Room is judged against the full button, measured once while its label is showing.
      if (flag.dataset.beside !== 'viewer') flag.dataset.fullWidth = String(flag.offsetWidth);
      const room = pageEl.getBoundingClientRect().left - wrap.getBoundingClientRect().left - Number(flag.dataset.fullWidth ?? flag.offsetWidth) - gap;
      // No room beside the page (it fills the width): stay at the viewer's own edge, as an arrow only, so the
      // button stays inside the page's margin and off its text. The label remains its accessible name.
      flag.dataset.beside = room >= 0 ? 'page' : 'viewer';
      flag.style.left = `${Math.max(0, Math.round(room))}px`;
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener('resize', place);
    return () => { window.clearInterval(timer); window.removeEventListener('resize', place); };
  }, [ready, finishing, remaining]);
  const focusField = (name: string) => { lastFocused.current = name; setFieldsOpen(false); viewer.current?.focusField(name); };
  const clearField = (name: string) => { viewer.current?.clearField(name); window.setTimeout(refresh, 150); };

  // One list, shown in the side panel on wide screens and in a dialog below 1024px.
  const fieldList = (
    <ul className="field-list">
      {fields.map((f) => {
        const filled = hasValue(values, f.name);
        return (
          <li key={f.name} className="field-item">
            <button type="button" className={`field-row${filled ? ' filled' : ''}`} disabled={!ready} onClick={() => focusField(f.name)} data-field={f.name} data-filled={filled}>
              <span className="field-mark" aria-hidden="true">{filled && <Check size={12} />}</span>
              <span className="field-text">
                <span className="field-label">{f.label}</span>
                <span className="field-state">
                  {f.type === 'signature'
                    ? (filled ? `Signed by ${profile.fullName}` : f.required ? 'Required · page ' + f.page : 'Optional · page ' + f.page)
                    : (filled ? 'Filled in' : (f.required ? 'Required' : 'Optional') + ' · page ' + f.page)}
                </span>
              </span>
            </button>
            {filled && f.type === 'signature' && (
              <button type="button" className="field-clear" disabled={finishing} onClick={() => clearField(f.name)} aria-label={`Clear ${f.label}`} data-clear={f.name}>Clear</button>
            )}
          </li>
        );
      })}
    </ul>
  );
  const fieldHint = <div className="field-hint">Scroll through the document, or press Next to go to each field. Select a signature field to sign: you can draw, type or upload your signature. Clear removes a signature so you can sign again.</div>;
  const openFields = fields.filter((f) => !hasValue(values, f.name)).length;

  // Next visits every field that still needs input, optional ones included, in reading order.
  const onNext = () => {
    const current = viewer.current?.readValues() ?? values;
    const next = nextOpenField(fields, current, lastFocused.current);
    if (next) focusField(next.name);
  };
  const onFinish = () => {
    refresh();
    const current = viewer.current?.readValues() ?? values;
    if (!canFinish(fields, current)) {
      const missing = remainingRequired(fields, current);
      notify(stillRequiredMessage(missing), 'Sign the highlighted field to continue.', 'warning');
      const first = nextUnsignedField(fields, current);
      if (first) focusField(first.name);
      return;
    }
    setConfirmOpen(true);
  };
  const confirmFinish = useCallback(async () => {
    setConfirmOpen(false);
    setFinishing(true);
    try {
      const saved = await viewer.current!.save();
      const { pdf, watermarked } = await signedCopyFinalizer.finalize(saved);
      completeDocument(doc, pdf);
      navigate(`/complete/${doc.id}`);
      if (!watermarked) notify('Signed without a watermark', 'The watermark image could not be loaded. Your signed document is complete.', 'warning');
    } catch (error) {
      console.error('Signing could not be completed', error);
      setFinishing(false);
      notify('We couldn\'t finish signing', 'Your signature is still on the document. Try Finish Signing again.', 'danger');
    }
  }, [completeDocument, doc, navigate, notify]);
  const confirmButtons = useMemo(() => [
    { buttonModel: { content: 'Cancel' }, click: () => setConfirmOpen(false) },
    { buttonModel: { content: 'Finish signing', isPrimary: true }, click: () => { void confirmFinish(); } },
  ], [confirmFinish]);

  return (
    <div className="sign-page" data-mode="sign">
      <header className="sign-subheader">
        <Link to="/documents" className="sign-back" aria-label="Back to My Documents" title="Back to My Documents"><ArrowLeft size={18} aria-hidden="true" /></Link>
        <div className="sign-titleblock">
          <h1>{doc.title}</h1>
          {/* The visible line is a label, always on screen. Changes are announced from a separate live region, so the
              page never presents a permanent "status" (which also reads as "still loading" to the loading check). */}
          <span className="sr-only" role="status" aria-live="polite">{remaining === 0 ? 'All signatures complete' : `Signatures required, ${remaining} remaining`}</span>
          <p className={`sign-status${remaining === 0 ? ' done' : ''}`} data-testid="sign-status">
            {remaining === 0
              ? <><CircleCheck size={15} aria-hidden="true" />All signatures complete</>
              : <><PenLine size={15} aria-hidden="true" />Signatures Required · {remaining} remaining</>}
          </p>
        </div>
        <div className="sign-actions">
          <ButtonComponent cssClass="e-outline fields-button" disabled={!ready || finishing} onClick={() => setFieldsOpen(true)} aria-label={`Fields to complete, ${openFields} left`}>
            <ListChecks size={16} aria-hidden="true" />Fields ({openFields} left)
          </ButtonComponent>
          <ButtonComponent cssClass="e-primary" disabled={!ready || finishing} onClick={onFinish}>{finishing ? 'Finishing…' : 'Finish Signing'}</ButtonComponent>
        </div>
      </header>

      <div className="sign-body">
        <div className="viewer-wrap" ref={wrapRef}>
          {/* The Next button over the document (the requirement's overlay). It scrolls to the next field that needs
              input; once no required field is left it finishes instead. Before the viewer in the tab order. */}
          {ready && !finishing && (
            remaining === 0
              ? <button type="button" className="next-flag finish" onClick={onFinish} data-testid="next-flag"><Check size={16} aria-hidden="true" /><span className="next-flag-text">Finish</span></button>
              : <button type="button" className="next-flag" onClick={onNext} data-testid="next-flag"><ArrowRight size={16} aria-hidden="true" /><span className="next-flag-text">Next</span></button>
          )}
          <DocumentViewer ref={viewer} url={absoluteAssetUrl(doc.file)} fields={doc.fields} typedName={profile.fullName} onReady={() => setReady(true)} onValuesChanged={refresh} />
        </div>
        <aside className="e-card field-panel" aria-labelledby="fields-heading">
          <div className="e-card-header"><div className="e-card-header-caption"><h2 className="e-card-header-title" id="fields-heading">Fields to complete</h2></div></div>
          <div className="e-card-content">
            {!narrow && fieldList}
            {fieldHint}
          </div>
        </aside>
      </div>

      {/* Below 1024px the side panel is hidden; the same list opens from the header's Fields button. */}
      {/* The dialog exists only on narrow screens, and its children never come and go: the Syncfusion Dialog
          moves its content in the DOM, and React cannot add or remove a top-level child there afterwards. */}
      {narrow && (
        <DialogComponent visible={fieldsOpen} isModal header="Fields to complete" showCloseIcon closeOnEscape width="min(420px, calc(100vw - 32px))"
          // Inside #root, not document.body: React delivers events only within its root, and this dialog's content
          // holds React buttons.
          target={document.getElementById('root') ?? document.body} close={() => setFieldsOpen(false)} cssClass="app-dialog fields-dialog">
          <div className="fields-dialog-body">{fieldList}{fieldHint}</div>
        </DialogComponent>
      )}

      <DialogComponent visible={confirmOpen} isModal header="Finish signing?" showCloseIcon closeOnEscape width="min(420px, calc(100vw - 32px))"
        target={document.body} buttons={confirmButtons} close={() => setConfirmOpen(false)} cssClass="app-dialog">
        <p>The document becomes read-only. You can review and download the signed copy afterwards.</p>
      </DialogComponent>
    </div>
  );
}
