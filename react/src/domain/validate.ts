// Validates the catalogue at load (contracts/data-contract.md, "Schema and scenarios"). Returns every problem found.
import type { Catalogue } from './types';

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function validateCatalogue(input: unknown): string[] {
  const errors: string[] = [];
  const c = input as Partial<Catalogue> | null;
  if (!c || typeof c !== 'object') return ['The catalogue is not an object.'];
  if (c.schemaVersion !== 1) errors.push(`schemaVersion must be 1 (found ${String(c.schemaVersion)}).`);
  if (!int(c.fixtureVersion) || c.fixtureVersion < 1) errors.push('fixtureVersion must be an integer of 1 or more.');

  const p = c.profile;
  if (!p || !text(p.id) || !KEBAB.test(p.id) || !text(p.fullName) || !text(p.firstName) || !text(p.role) || !text(p.company)) errors.push('profile is incomplete.');
  else if (!text(p.email) || !p.email.endsWith('@example.com')) errors.push('profile.email must be a fictional example.com address.');

  const docs = c.documents;
  if (!Array.isArray(docs) || docs.length < 1 || docs.length > 12) return [...errors, 'documents must hold 1 to 12 entries.'];
  const ids = new Set<string>();
  for (const d of docs) {
    const where = `Document "${d?.id ?? '?'}"`;
    if (!d || !text(d.id) || !KEBAB.test(d.id)) { errors.push(`${where}: id must be kebab-case.`); continue; }
    if (ids.has(d.id)) errors.push(`${where}: duplicate id.`);
    ids.add(d.id);
    if (!text(d.title)) errors.push(`${where}: title is required.`);
    if (!d.sender || !text(d.sender.name) || !text(d.sender.organisation)) errors.push(`${where}: sender is incomplete.`);
    if (!int(d.receivedDaysAgo) || d.receivedDaysAgo < 0 || d.receivedDaysAgo > 60) errors.push(`${where}: receivedDaysAgo must be 0 to 60.`);
    if (!int(d.pageCount) || d.pageCount < 1) errors.push(`${where}: pageCount must be 1 or more.`);
    if (!text(d.file) || !d.file.startsWith('documents/') || !d.file.endsWith('.pdf')) errors.push(`${where}: file must be a PDF under documents/.`);
    if (!Array.isArray(d.fields)) { errors.push(`${where}: fields must be a list.`); continue; }

    if (d.baselineStatus === 'completed') {
      if (!int(d.signedDaysAgo)) errors.push(`${where}: a completed document needs signedDaysAgo.`);
      if (d.dueInDays !== null) errors.push(`${where}: a completed document has no due date.`);
      if (d.fields.length > 0) errors.push(`${where}: a completed document has no fields.`);
    } else if (d.baselineStatus === 'ready') {
      if (!int(d.dueInDays) || d.dueInDays < -30 || d.dueInDays > 60) errors.push(`${where}: dueInDays must be -30 to 60.`);
      if (d.signedDaysAgo !== null) errors.push(`${where}: a ready document has no signedDaysAgo.`);
      if (!d.fields.some((f) => f?.type === 'signature' && f.required === true)) errors.push(`${where}: a ready document needs at least one required signature.`);
    } else errors.push(`${where}: baselineStatus must be ready or completed.`);

    const names = new Set<string>();
    for (const f of d.fields) {
      const at = `${where} field "${f?.name ?? '?'}"`;
      if (!f || !text(f.name) || !text(f.label)) { errors.push(`${at}: name and label are required.`); continue; }
      if (names.has(f.name)) errors.push(`${at}: duplicate name.`);
      names.add(f.name);
      if (f.type !== 'signature' && f.type !== 'text') errors.push(`${at}: type must be signature or text.`);
      if (typeof f.required !== 'boolean') errors.push(`${at}: required must be true or false.`);
      if (!int(f.page) || f.page < 1 || f.page > d.pageCount) errors.push(`${at}: page must be 1 to ${d.pageCount}.`);
      const b = f.bounds;
      if (!b || !(b.Width > 0) || !(b.Height > 0) || !(b.X >= 0) || !(b.Y >= 0) || b.X + b.Width > PAGE_WIDTH || b.Y + b.Height > PAGE_HEIGHT) errors.push(`${at}: bounds must be positive and inside the page.`);
    }
  }
  return errors;
}
