import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { CircleCheck, Download, Eye } from 'lucide-react';
import { useSigningStore } from '../../../app/SigningStore';
import { downloadFile } from '../../../adapters/download';
import { formatDateTime } from '../../format';

export function CompletePage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { catalogue, session } = useSigningStore();
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Signing Complete · E-Signing Portal'; }, []);

  const doc = catalogue?.documents.find((d) => d.id === documentId);
  const entry = doc ? session[doc.id] : undefined;
  // This screen follows a signing in this session; anything else goes back to the list.
  if (!catalogue || !doc || !entry) return <Navigate to="/documents" replace />;

  return (
    <div className="page complete-page">
      <section className="e-card complete-panel" aria-labelledby="complete-title">
        <div className="e-card-header">
          <span className="complete-icon" aria-hidden="true"><CircleCheck size={28} /></span>
          <div className="e-card-header-caption">
            <h1 className="e-card-header-title" id="complete-title">Thank you, {catalogue.profile.firstName}</h1>
            <div className="e-card-sub-title">Signing complete! You may now view or download your signed document.</div>
          </div>
        </div>
        <div className="e-card-content">
          <dl className="complete-facts">
            <div><dt>Document</dt><dd>{doc.title}</dd></div>
            <div><dt>Signed</dt><dd>{formatDateTime(new Date(entry.signedAt))}</dd></div>
            <div><dt>Signed by</dt><dd>{catalogue.profile.fullName}</dd></div>
          </dl>
          <div className="complete-note">We have everything we need at this stage. The signed copy is read-only.</div>
        </div>
        <div className="e-card-actions">
          <div className="complete-actions">
            <ButtonComponent cssClass="e-outline" onClick={() => navigate(`/sign/${doc.id}`)}><Eye size={16} aria-hidden="true" />Review Documents</ButtonComponent>
            <ButtonComponent cssClass="e-primary" onClick={() => downloadFile(entry.signedUrl, entry.fileName)}><Download size={16} aria-hidden="true" />Download Documents</ButtonComponent>
            <ButtonComponent cssClass="e-flat" onClick={() => navigate('/documents')}>Back to My Documents</ButtonComponent>
          </div>
        </div>
      </section>
    </div>
  );
}