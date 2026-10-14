// Shared loading, empty, error and status-badge pieces, ported from the reference's AppLoading, States and
// StatusBadge. The loading indicator's styles live in index.html, so the startup screen looks the same before
// the app's CSS has loaded.
import { Component, computed, input } from '@angular/core';
import { LucideCircleCheck, LucideClock, LucideInbox, LucidePenLine, LucideTriangleAlert } from '@lucide/angular';
import type { Badge } from '../domain/types';

/** `screen` fills the window, `overlay` covers its positioned parent, `page` sits in the content area. */
@Component({
  selector: 'app-loading',
  template: `
    <div [class]="'app-loading' + (variant() === 'page' ? '' : ' app-loading--' + variant())" role="status" aria-live="polite">
      <div class="app-loading__ring" aria-hidden="true"></div>
      <div>{{ label() }}</div>
    </div>`,
  host: { style: 'display: contents' },
})
export class AppLoadingComponent {
  readonly label = input.required<string>();
  readonly variant = input<'screen' | 'overlay' | 'page'>('page');
}

@Component({
  selector: 'app-empty-state',
  imports: [LucideInbox],
  template: `<div class="state"><svg lucideInbox [size]="28"></svg><p>{{ message() }}</p></div>`,
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
}

/** An error the person can act on: the message, then the actions projected inside (Try again, a link back). */
@Component({
  selector: 'app-error-state',
  imports: [LucideTriangleAlert],
  template: `
    <div class="state error" role="alert">
      <svg lucideTriangleAlert [size]="28"></svg>
      <p class="state-title">{{ title() }}</p>
      @if (message()) { <p>{{ message() }}</p> }
      <div class="state-actions"><ng-content /></div>
    </div>`,
})
export class ErrorStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>();
}

const BADGES: Record<Badge, { label: string; tone: string }> = {
  ready: { label: 'Ready to sign', tone: 'info' },
  'due-soon': { label: 'Due soon', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
};

/** Status tone plus an icon and a label, so the meaning never rests on colour alone. */
@Component({
  selector: 'app-status-badge',
  imports: [LucidePenLine, LucideClock, LucideCircleCheck],
  template: `
    <span [class]="'status-badge tone-' + info().tone" [attr.data-badge]="badge()">
      @switch (badge()) {
        @case ('ready') { <svg lucidePenLine [size]="13"></svg> }
        @case ('due-soon') { <svg lucideClock [size]="13"></svg> }
        @case ('completed') { <svg lucideCircleCheck [size]="13"></svg> }
      }
      {{ info().label }}
    </span>`,
  host: { style: 'display: contents' },
})
export class StatusBadgeComponent {
  readonly badge = input.required<Badge>();
  readonly info = computed(() => BADGES[this.badge()]);
}
