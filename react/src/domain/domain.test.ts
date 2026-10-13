// Expected-value vectors V1 to V9 and the invalid examples from contracts/data-contract.md.
import { describe, expect, it } from 'vitest';
import raw from '../data/documents.json';
import type { Catalogue, SigningSession } from './types';
import { badge, canFinish, groupByStatus, nextOpenField, nextUnsignedField, remainingRequired, resolveDates, signedFileName, stillRequiredMessage } from './rules';
import { validateCatalogue } from './validate';

const catalogue = raw as Catalogue;
const today = new Date(2026, 9, 9, 15, 30); // Oct 9, 2026, local time
const doc = (id: string) => catalogue.documents.find((d) => d.id === id)!;
const offer = doc('employment-offer-letter');
const nda = doc('confidentiality-agreement');
const signedOffer: SigningSession = { 'employment-offer-letter': { signedAt: today.toISOString(), signedUrl: 'blob:x', fileName: 'x.pdf' } };
const clone = (): Catalogue => JSON.parse(JSON.stringify(catalogue));

describe('fixture', () => {
  it('is valid', () => expect(validateCatalogue(catalogue)).toEqual([]));
});

describe('selectors', () => {
  it('V1 baseline: 3 ready ordered by due date, 1 completed', () => {
    const g = groupByStatus(catalogue.documents, {}, today);
    expect(g.ready.map((d) => d.id)).toEqual(['confidentiality-agreement', 'employment-offer-letter', 'handbook-acknowledgment']);
    expect(g.completed.map((d) => d.id)).toEqual(['direct-deposit-authorization']);
  });
  it('V2 badges', () => {
    expect(badge(nda, {})).toBe('due-soon');
    expect(badge(offer, {})).toBe('ready');
    expect(badge(doc('handbook-acknowledgment'), {})).toBe('ready');
    expect(badge(doc('direct-deposit-authorization'), {})).toBe('completed');
  });
  it('V3 offer letter, nothing filled', () => {
    expect(remainingRequired(offer.fields, {})).toBe(1);
    expect(canFinish(offer.fields, {})).toBe(false);
    expect(nextUnsignedField(offer.fields, {})?.name).toBe('employee_signature');
  });
  it('V4 only the optional field filled', () => {
    const v = { preferred_name: 'Pete' };
    expect(remainingRequired(offer.fields, v)).toBe(1);
    expect(canFinish(offer.fields, v)).toBe(false);
  });
  it('V5 signature only', () => {
    const v = { employee_signature: 'data' };
    expect(remainingRequired(offer.fields, v)).toBe(0);
    expect(canFinish(offer.fields, v)).toBe(true);
    expect(nextUnsignedField(offer.fields, v)).toBeNull();
  });
  it('V6 NDA, first signature only', () => {
    const v = { acknowledgment_signature: 'data' };
    expect(remainingRequired(nda.fields, v)).toBe(1);
    const next = nextUnsignedField(nda.fields, v);
    expect(next?.name).toBe('employee_signature');
    expect(next?.page).toBe(2);
  });
  it('V7 after completing the offer letter', () => {
    const g = groupByStatus(catalogue.documents, signedOffer, today);
    expect(g.ready).toHaveLength(2);
    expect(g.completed.map((d) => d.id)).toEqual(['employment-offer-letter', 'direct-deposit-authorization']);
    expect(badge(offer, signedOffer)).toBe('completed');
  });
  it('V8 reset equals the baseline', () => {
    expect(groupByStatus(catalogue.documents, {}, today)).toEqual(groupByStatus(catalogue.documents, {}, today));
    expect(groupByStatus(catalogue.documents, {}, today).ready).toHaveLength(3);
  });
  it('V9 whitespace text counts as empty', () => {
    const v = { preferred_name: '   ' };
    expect(canFinish(offer.fields, v)).toBe(false);
    expect(canFinish(offer.fields, { ...v, employee_signature: 'data' })).toBe(true);
  });
  it('V10 Next order on the offer letter visits optional and required fields', () => {
    expect(nextOpenField(offer.fields, {})?.name).toBe('preferred_name');
    expect(nextOpenField(offer.fields, {}, 'preferred_name')?.name).toBe('employee_signature');
    expect(nextOpenField(offer.fields, { employee_signature: 'data' }, 'employee_signature')?.name).toBe('preferred_name');
  });
  it('V11 Next with everything filled', () => {
    expect(nextOpenField(offer.fields, { preferred_name: 'Pete', employee_signature: 'data' })).toBeNull();
  });
  it('next wraps after the given field', () => {
    expect(nextUnsignedField(nda.fields, {}, 'employee_signature')?.name).toBe('acknowledgment_signature');
    expect(nextUnsignedField(nda.fields, {}, 'acknowledgment_signature')?.name).toBe('employee_signature');
  });
  it('dates come from day offsets', () => {
    const d = resolveDates(offer, today);
    expect([d.received.getMonth(), d.received.getDate()]).toEqual([9, 7]);
    expect([d.due!.getMonth(), d.due!.getDate()]).toEqual([9, 14]);
    expect(resolveDates(doc('direct-deposit-authorization'), today).due).toBeNull();
  });
  it('messages and file names', () => {
    expect(stillRequiredMessage(1)).toBe('1 signature is still required');
    expect(stillRequiredMessage(2)).toBe('2 signatures are still required');
    expect(signedFileName('Employment Offer Letter')).toBe('Employment Offer Letter - signed.pdf');
  });
});

describe('invalid catalogues are rejected', () => {
  const bad = (change: (c: Catalogue) => void) => { const c = clone(); change(c); return validateCatalogue(c); };
  it('schemaVersion 2', () => expect(bad((c) => { (c as { schemaVersion: number }).schemaVersion = 2; })).not.toEqual([]));
  it('duplicate id', () => expect(bad((c) => { c.documents[1].id = c.documents[0].id; })).not.toEqual([]));
  it('ready document with no required signature', () => expect(bad((c) => { c.documents[0].fields.forEach((f) => { f.required = false; }); })).not.toEqual([]));
  it('field page beyond pageCount', () => expect(bad((c) => { c.documents[0].fields[0].page = 9; })).not.toEqual([]));
  it('zero width', () => expect(bad((c) => { c.documents[0].fields[0].bounds.Width = 0; })).not.toEqual([]));
  it('completed with no signedDaysAgo', () => expect(bad((c) => { c.documents[3].signedDaysAgo = null; })).not.toEqual([]));
  it('not an object', () => expect(validateCatalogue(null)).not.toEqual([]));
});
