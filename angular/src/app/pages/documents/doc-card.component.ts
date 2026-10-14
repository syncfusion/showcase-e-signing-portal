// One document as Syncfusion Card markup, with its one action (or Review and Download once completed).
import { Component, input, output } from '@angular/core';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { LucideDownload, LucideEye, LucideFileText, LucidePenLine } from '@lucide/angular';
import type { Badge, SigningDocument } from '../../domain/types';
import { StatusBadgeComponent } from '../../shared/states';

export interface CardView { doc: SigningDocument; badge: Badge; received: string; due: string | null; signed: string | null; done: boolean; length: string }

@Component({
  // An attribute selector on the <li>, so the list keeps its ul > li structure.
  selector: 'li[app-doc-card]',
  imports: [ButtonModule, LucideDownload, LucideEye, LucideFileText, LucidePenLine, StatusBadgeComponent],
  templateUrl: './doc-card.component.html',
})
export class DocCardComponent {
  readonly card = input.required<CardView>();
  readonly openDoc = output<SigningDocument>();
  readonly downloadDoc = output<SigningDocument>();
}
