import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { Download, Eye, FileText, PenLine } from 'lucide-react';
import { useSigningStore } from '../../../app/SigningStore';
import { assetUrl } from '../../../adapters/basePath';
import { downloadFile } from '../../../adapters/download';
import { badge, groupByStatus, resolveDates, signedAt, signedFileName } from '../../../domain/rules';
import type { SigningDocument } from '../../../domain/types';
import { EmptyState } from '../../components/States';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate, pages } from '../../format';

export function DocumentsPage() {
  const { catalogue, session, today } = useSigningStore();
  const navigate = useNavigate();
  useEffect(() => { document.title = 'My Documents · E-Signing Portal'; }, []);
  if (!catalogue) return null;
  const { ready, completed } = groupByStatus(catalogue.documents, session, today);

  const download = (doc: SigningDocument) => {
    const entry = session[doc.id];
    downloadFile(entry ? entry.signedUrl : assetUrl(doc.file), entry ? entry.fileName : signedFileName(doc.title));
  };

  const card = (doc: SigningDocument) => {
    const dates = resolveDates(doc, today);
    const signed = signedAt(doc, session, today);
    const done = signed !== null && badge(doc, session) === 'completed';
    return (
      <li key={doc.id}>
        {/* Syncfusion Card markup (CSS only). The surface itself is not clickable; the action row holds the one action. */}
        <article className="e-card doc-item" data-document={doc.id} aria-labelledby={`doc-${doc.id}`}>
          <div className="e-card-header">
            <span className="doc-icon" aria-hidden="true"><FileText size={20} /></span>
            <div className="e-card-header-caption">
              <div className="e-card-header-title" id={`doc-${doc.id}`}>{doc.title}</div>
              <div className="e-card-sub-title">From {doc.sender.name}, {doc.sender.organisation}</div>
            </div>
          </div>
          <div className="e-card-content">
            <div className="doc-meta">
              <StatusBadge badge={badge(doc, session)} />
              <dl>
                <div><dt>Received</dt><dd>{formatDate(dates.received)}</dd></div>
                {done ? <div><dt>Signed</dt><dd>{formatDate(signed)}</dd></div> : dates.due && <div><dt>Due</dt><dd>{formatDate(dates.due)}</dd></div>}
                <div><dt>Length</dt><dd>{pages(doc.pageCount)}</dd></div>
              </dl>
            </div>
          </div>
          <div className="e-card-actions">
            <div className="doc-actions">
              {done ? (
                <>
                  <ButtonComponent cssClass="e-outline" onClick={() => navigate(`/sign/${doc.id}`)} aria-label={`Review ${doc.title}`}><Eye size={16} aria-hidden="true" />Review</ButtonComponent>
                  <ButtonComponent cssClass="e-outline" onClick={() => download(doc)} aria-label={`Download ${doc.title}`}><Download size={16} aria-hidden="true" />Download</ButtonComponent>
                </>
              ) : (
                <ButtonComponent cssClass="e-primary" onClick={() => navigate(`/sign/${doc.id}`)} aria-label={`Review and sign ${doc.title}`}><PenLine size={16} aria-hidden="true" />Review and sign</ButtonComponent>
              )}
            </div>
          </div>
        </article>
      </li>
    );
  };

  return (
    <div className="page documents-page">
      <header className="page-header">
        <div>
          <h1>My Documents</h1>
          <p data-testid="documents-summary">
            {ready.length === 0 ? 'Nothing is waiting for your signature.' : `${ready.length} ${ready.length === 1 ? 'document needs' : 'documents need'} your signature.`}
          </p>
        </div>
        <p className="page-note">Sample portal: signing stays in this tab and nothing is sent.</p>
      </header>

      <section aria-labelledby="ready-heading" data-testid="ready-section">
        <h2 id="ready-heading">Ready to sign <span className="count">{ready.length}</span></h2>
        {ready.length ? <ul className="doc-grid">{ready.map(card)}</ul> : <EmptyState message="You're all caught up." />}
      </section>

      <section aria-labelledby="completed-heading" data-testid="completed-section">
        <h2 id="completed-heading">Completed <span className="count">{completed.length}</span></h2>
        {completed.length ? <ul className="doc-grid">{completed.map(card)}</ul> : <EmptyState message="Signed documents appear here." />}
      </section>
    </div>
  );
}