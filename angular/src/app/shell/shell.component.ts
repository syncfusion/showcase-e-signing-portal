// The top bar (Syncfusion AppBar), the routed page, the Reset dialog and the app's one Toast.
// Port of the reference's Shell.tsx.
import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppBarModule } from '@syncfusion/ej2-angular-navigations';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { DialogModule } from '@syncfusion/ej2-angular-popups';
import { ToastComponent, ToastModule } from '@syncfusion/ej2-angular-notifications';
import type { ButtonPropsModel } from '@syncfusion/ej2-angular-popups';
import { LucideFilePenLine, LucideFiles, LucideMoon, LucideRotateCcw, LucideSun } from '@lucide/angular';
import { SigningStore } from '../state/signing-store';
import { ThemeService } from '../state/theme.service';
import { Notifier } from '../state/notifier.service';
import { initials } from '../shared/format';
import { AppLoadingComponent, ErrorStateComponent } from '../shared/states';

/** Page names for the "Loading <page>…" indicator while a lazy page downloads. */
const PAGE_NAMES: [RegExp, string][] = [[/^\/sign\//, 'Sign Document'], [/^\/complete\//, 'Signing Complete'], [/^\/documents/, 'My Documents']];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppBarModule, ButtonModule, DialogModule, ToastModule,
    LucideFilePenLine, LucideFiles, LucideMoon, LucideRotateCcw, LucideSun, AppLoadingComponent, ErrorStateComponent],
  templateUrl: './shell.component.html',
  host: { style: 'display: contents' },
})
export class ShellComponent implements AfterViewInit {
  protected readonly store = inject(SigningStore);
  protected readonly theme = inject(ThemeService);
  protected readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  @ViewChild('toast') private toast?: ToastComponent;

  protected readonly profile = this.store.catalogue?.profile ?? null;
  protected readonly initials = this.profile ? initials(this.profile.fullName) : '';
  protected readonly themeLabel = computed(() => (this.theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'));
  protected readonly resetOpen = signal(false);
  /** Set while a lazy page is downloading. */
  protected readonly loadingPage = signal<string | null>(null);
  protected readonly toastPosition = { X: 'Right', Y: 'Top' };
  protected readonly toastAnimation = reducedMotion()
    ? { show: { effect: 'FadeIn' as const, duration: 0 }, hide: { effect: 'FadeOut' as const, duration: 0 } } : undefined;
  protected readonly body = document.body;
  protected readonly resetButtons: ButtonPropsModel[] = [
    { buttonModel: { content: 'Cancel' }, click: () => this.resetOpen.set(false) },
    { buttonModel: { content: 'Reset demo', isPrimary: true }, click: () => this.confirmReset() },
  ];

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loadingPage.set(PAGE_NAMES.find(([re]) => re.test(event.url))?.[1] ?? null);
      } else if (event instanceof NavigationEnd) {
        this.loadingPage.set(null);
        // The router does not move focus; after an in-app navigation put it on the new page's heading, as a page load
        // would (DESIGN.md). Not on the first page, which the browser has just loaded.
        if (event.id > 1) setTimeout(() => document.querySelector<HTMLElement>('.app-main h1')?.focus({ preventScroll: true }), 0);
      } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.loadingPage.set(null);
      }
    });
  }

  ngAfterViewInit(): void { this.notifier.attach(this.toast ?? null); }

  protected openReset(): void { this.resetOpen.set(true); }

  private confirmReset(): void {
    this.resetOpen.set(false);
    this.store.reset();
    void this.router.navigate(['/documents']);
    this.notifier.notify('Demo reset', 'Every document is back to its original state.', 'info');
  }

  protected reload(): void { window.location.reload(); }
}
