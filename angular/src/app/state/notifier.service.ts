// One Toast for the whole app, rendered by the shell; every message is mirrored to a polite live region.
// Port of the reference's NotifierProvider.
import { Injectable, signal } from '@angular/core';
import type { ToastComponent } from '@syncfusion/ej2-angular-notifications';

export type NotifyKind = 'success' | 'warning' | 'danger' | 'info';

@Injectable({ providedIn: 'root' })
export class Notifier {
  private toast: ToastComponent | null = null;
  /** The text of the last message, for the shell's live region. */
  readonly live = signal('');

  attach(toast: ToastComponent | null): void { this.toast = toast; }

  notify(title: string, content: string, kind: NotifyKind): void {
    this.toast?.show({ title, content, cssClass: `e-toast-${kind}`, timeOut: kind === 'danger' || kind === 'warning' ? 6000 : 4000 });
    this.live.set(`${title}. ${content}`);
  }
}
