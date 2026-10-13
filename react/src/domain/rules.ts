// Pure signing rules and selectors (contracts/data-contract.md, "Queries and commands").
import type { Badge, DocumentStatus, FieldDefinition, FieldValues, SigningDocument, SigningSession } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 2;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (today: Date, days: number) => new Date(startOfDay(today).getTime() + days * DAY_MS);

export interface ResolvedDates { received: Date; due: Date | null; baselineSigned: Date | null }

/** The catalogue stores day offsets; dates are worked out from today so the list never looks stale. */
export function resolveDates(doc: SigningDocument, today: Date): ResolvedDates {
  return {
    received: addDays(today, -doc.receivedDaysAgo),
    due: doc.dueInDays === null ? null : addDays(today, doc.dueInDays),
    baselineSigned: doc.signedDaysAgo === null ? null : addDays(today, -doc.signedDaysAgo),
  };
}

export function statusOf(doc: SigningDocument, session: SigningSession): DocumentStatus {
  return doc.baselineStatus === 'completed' || session[doc.id] ? 'completed' : 'ready';
}

export function badge(doc: SigningDocument, session: SigningSession): Badge {
  if (statusOf(doc, session) === 'completed') return 'completed';
  return doc.dueInDays !== null && doc.dueInDays <= DUE_SOON_DAYS ? 'due-soon' : 'ready';
}

/** When a completed document was signed: this session's time, else the baseline's. */
export function signedAt(doc: SigningDocument, session: SigningSession, today: Date): Date | null {
  const entry = session[doc.id];
  if (entry) return new Date(entry.signedAt);
  return resolveDates(doc, today).baselineSigned;
}

export function groupByStatus(documents: readonly SigningDocument[], session: SigningSession, today: Date) {
  const ready = documents.filter((d) => statusOf(d, session) === 'ready')
    .sort((a, b) => (a.dueInDays ?? Infinity) - (b.dueInDays ?? Infinity) || a.title.localeCompare(b.title));
  const completed = documents.filter((d) => statusOf(d, session) === 'completed')
    .sort((a, b) => (signedAt(b, session, today)?.getTime() ?? 0) - (signedAt(a, session, today)?.getTime() ?? 0));
  return { ready, completed };
}

export const hasValue = (values: FieldValues, name: string) => (values[name] ?? '').trim().length > 0;

/** Page order, then top to bottom, then left to right. */
export function inReadingOrder(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort((a, b) => a.page - b.page || a.bounds.Y - b.bounds.Y || a.bounds.X - b.bounds.X);
}

export function remainingRequired(fields: readonly FieldDefinition[], values: FieldValues): number {
  return fields.filter((f) => f.required && !hasValue(values, f.name)).length;
}

export const canFinish = (fields: readonly FieldDefinition[], values: FieldValues) => remainingRequired(fields, values) === 0;

/** The next required field with no value, after `afterName` in reading order and wrapping; null when none. */
export function nextUnsignedField(fields: readonly FieldDefinition[], values: FieldValues, afterName?: string): FieldDefinition | null {
  const ordered = inReadingOrder(fields);
  const start = afterName ? ordered.findIndex((f) => f.name === afterName) + 1 : 0;
  for (let i = 0; i < ordered.length; i++) {
    const field = ordered[(start + i) % ordered.length];
    if (field.required && !hasValue(values, field.name)) return field;
  }
  return null;
}

/** The next field with no value, required or optional, after `afterName` in reading order and wrapping; null when none.
 *  This is what the Next button over the document visits. */
export function nextOpenField(fields: readonly FieldDefinition[], values: FieldValues, afterName?: string): FieldDefinition | null {
  const ordered = inReadingOrder(fields);
  const start = afterName ? ordered.findIndex((f) => f.name === afterName) + 1 : 0;
  for (let i = 0; i < ordered.length; i++) {
    const field = ordered[(start + i) % ordered.length];
    if (!hasValue(values, field.name)) return field;
  }
  return null;
}

export function signedFileName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'document'} - signed.pdf`;
}

export function stillRequiredMessage(count: number): string {
  return count === 1 ? '1 signature is still required' : `${count} signatures are still required`;
}
