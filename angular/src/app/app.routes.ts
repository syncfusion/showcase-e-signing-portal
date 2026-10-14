// Three pages inside the shell, each loaded on demand: the PDF Viewer's library downloads only on the signing
// route. Same routes as the React reference, served from the root (no base path, no /healthz).
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn, Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { SigningStore } from './state/signing-store';

/** Signing Complete follows a signing in this session; anything else goes back to the list. */
const signedInThisSession: CanActivateFn = (route) => {
  const store = inject(SigningStore);
  const id = route.paramMap.get('documentId');
  return id && store.session()[id] ? true : inject(Router).createUrlTree(['/documents']);
};

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'documents' },
      { path: 'documents', loadComponent: () => import('./pages/documents/documents.component').then((m) => m.DocumentsComponent) },
      { path: 'sign/:documentId', loadComponent: () => import('./pages/sign/sign.component').then((m) => m.SignComponent) },
      { path: 'complete/:documentId', canActivate: [signedInThisSession],
        loadComponent: () => import('./pages/complete/complete.component').then((m) => m.CompleteComponent) },
      { path: '**', redirectTo: 'documents' },
    ],
  },
];
