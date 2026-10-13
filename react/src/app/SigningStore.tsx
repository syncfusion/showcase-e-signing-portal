// The tab's signing session: the validated catalogue plus an in-memory overlay of documents signed here.
// Nothing is written to browser storage; a reload or Reset returns to the baseline (app-plan.md, "Profiles").
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CatalogueResult } from '../adapters/catalogue';
import type { Clock } from '../adapters/clock';
import type { Catalogue, SigningDocument, SigningSession } from '../domain/types';
import { signedFileName, statusOf } from '../domain/rules';

interface Store {
  load: CatalogueResult;
  catalogue: Catalogue | null;
  session: SigningSession;
  today: Date;
  /** Records a finished document; the blob is the flattened signed PDF. */
  completeDocument(doc: SigningDocument, signedPdf: Blob): void;
  reset(): void;
  signedCount: number;
}

const Ctx = createContext<Store | null>(null);

export function SigningStoreProvider({ load, clock, children }: { load: CatalogueResult; clock: Clock; children: ReactNode }) {
  const [session, setSession] = useState<SigningSession>({});
  const [today] = useState(() => clock.now());
  const urls = useRef<string[]>([]);

  const completeDocument = useCallback((doc: SigningDocument, signedPdf: Blob) => {
    const signedUrl = URL.createObjectURL(signedPdf);
    urls.current.push(signedUrl);
    setSession((s) => (statusOf(doc, s) === 'completed' ? s : { ...s, [doc.id]: { signedAt: clock.now().toISOString(), signedUrl, fileName: signedFileName(doc.title) } }));
  }, [clock]);

  const reset = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setSession({});
  }, []);

  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const value = useMemo<Store>(() => ({
    load, catalogue: load.ok ? load.catalogue : null, session, today, completeDocument, reset, signedCount: Object.keys(session).length,
  }), [load, session, today, completeDocument, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSigningStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useSigningStore must be used inside SigningStoreProvider');
  return store;
}