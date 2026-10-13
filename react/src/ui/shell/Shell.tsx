import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { AppBarComponent } from '@syncfusion/ej2-react-navigations';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { FilePenLine, Files, Moon, RotateCcw, Sun } from 'lucide-react';
import { useSigningStore } from '../../app/SigningStore';
import { useTheme } from '../theme';
import { NotifierProvider, useNotify } from '../components/useNotifier';
import { ErrorState } from '../components/States';
import { initials } from '../format';

export function Shell() {
  return <NotifierProvider><ShellFrame /></NotifierProvider>;
}

function ShellFrame() {
  const { load, catalogue, reset } = useSigningStore();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const notify = useNotify();
  const [resetOpen, setResetOpen] = useState(false);
  const profile = catalogue?.profile;

  const confirmReset = useCallback(() => {
    setResetOpen(false);
    reset();
    navigate('/documents');
    notify('Demo reset', 'Every document is back to its original state.', 'info');
  }, [reset, navigate, notify]);
  const resetButtons = useMemo(() => [
    { buttonModel: { content: 'Cancel' }, click: () => setResetOpen(false) },
    { buttonModel: { content: 'Reset demo', isPrimary: true }, click: confirmReset },
  ], [confirmReset]);

  return (
    <div className="app-frame">
      <AppBarComponent colorMode="Inherit" cssClass="app-topbar">
        <Link to="/documents" className="app-brand" aria-label="E-Signing Portal, My Documents">
          <span className="app-brand-mark" aria-hidden="true"><FilePenLine size={18} /></span>
          <span className="app-brand-name">E-Signing Portal</span>
        </Link>
        <NavLink to="/documents" className="app-toplink" title="My Documents">
          <Files size={16} aria-hidden="true" /><span className="btn-text">My Documents</span>
        </NavLink>
        <div className="e-appbar-spacer" />
        <ButtonComponent cssClass="e-outline app-reset" disabled={!load.ok} onClick={() => setResetOpen(true)} title="Return every document to its original state" aria-label="Reset demo">
          <RotateCcw size={16} aria-hidden="true" /><span className="btn-text">Reset demo</span>
        </ButtonComponent>
        <button type="button" className="app-icon-button" onClick={toggle} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
        {profile && (
          <div className="app-profile" title={`Signed in as ${profile.fullName}`}>
            <span className="app-avatar" aria-hidden="true">{initials(profile.fullName)}</span>
            <span className="app-profile-text">
              <span className="app-profile-name"><span className="sr-only">Signed in as </span>{profile.fullName}</span>
              <span className="app-profile-role">{profile.role}</span>
            </span>
          </div>
        )}
      </AppBarComponent>

      <main className="app-main">
        {load.ok ? <Outlet /> : (
          <ErrorState title="We couldn't load your documents." message="The document list is not in the expected format.">
            <ButtonComponent cssClass="e-primary" onClick={() => window.location.reload()}>Reload</ButtonComponent>
          </ErrorState>
        )}
      </main>

      <DialogComponent visible={resetOpen} isModal header="Reset demo?" showCloseIcon closeOnEscape width="min(420px, calc(100vw - 32px))"
        target={document.body} buttons={resetButtons} close={() => setResetOpen(false)} cssClass="app-dialog">
        <p>Signed documents in this tab are discarded, and every document returns to its original state.</p>
      </DialogComponent>
    </div>
  );
}