// Generates the sample PDFs in public/documents/ with the Syncfusion JS PDF library (@syncfusion/ej2-pdf).
// All text is fictional and written for this app. Signature and text-field positions come from
// src/data/documents.json, so the catalogue stays the one source for field geometry: this script only
// draws the printed label and rule where each field will sit. Rerun with `npm run generate-documents`
// when the text or the catalogue's field bounds change; the PDFs are committed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { PdfDocument, PdfPageSettings, PdfMargins, PdfStandardFont, PdfFontFamily, PdfFontStyle, PdfBrush, PdfPen, PdfPath, PdfBitmap } = require('@syncfusion/ej2-pdf');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'documents');
const catalogue = JSON.parse(readFileSync(join(root, 'src', 'data', 'documents.json'), 'utf8'));
const profile = catalogue.profile;

const PAGE = { width: 595, height: 842 }; // A4, points
const MARGIN = 72;
const WIDTH = PAGE.width - MARGIN * 2;
const INK = { r: 23, g: 32, b: 51 };
const MUTED = { r: 102, g: 112, b: 133 };
const BRAND = { r: 23, g: 92, b: 211 };
const RULE = { r: 208, g: 213, b: 221 };
const SIGN_INK = { r: 20, g: 40, b: 110 };

const font = (size, style = PdfFontStyle.regular) => new PdfStandardFont(PdfFontFamily.helvetica, size, style);
const makeFonts = () => ({ title: font(20, PdfFontStyle.bold), h: font(12, PdfFontStyle.bold), body: font(10.5), small: font(8.5), label: font(9, PdfFontStyle.bold), brand: font(11, PdfFontStyle.bold) });
// Fonts belong to one document. Reusing font objects in a second PdfDocument made ej2-pdf 34.2.8 write duplicate
// object numbers there (an unreadable file: "Bad (uncompressed) XRef entry"), so each document gets its own set.
let F = makeFonts();

function newDocument() {
  F = makeFonts();
  const doc = new PdfDocument();
  const settings = new PdfPageSettings();
  settings.size = PAGE;
  settings.margins = new PdfMargins(0);
  return { doc, settings, pages: [] };
}

/** One page with the letterhead and footer drawn; returns a cursor for flowing text. */
function addPage(ctx, title, pageNumber, pageCount) {
  const page = ctx.doc.addPage(ctx.settings);
  const g = page.graphics;
  g.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: 6 }, new PdfBrush(BRAND));
  g.drawString('NORTHWIND HARBOR LOGISTICS', F.brand, { x: MARGIN, y: 30, width: WIDTH, height: 16 }, new PdfBrush(BRAND));
  g.drawString('People Operations  |  1200 Quayside Avenue, Port Meridian', F.small, { x: MARGIN, y: 46, width: WIDTH, height: 12 }, new PdfBrush(MUTED));
  g.drawLine(new PdfPen(RULE, 0.75), { x: MARGIN, y: 64 }, { x: PAGE.width - MARGIN, y: 64 });
  g.drawLine(new PdfPen(RULE, 0.75), { x: MARGIN, y: PAGE.height - 54 }, { x: PAGE.width - MARGIN, y: PAGE.height - 54 });
  g.drawString(`${title}  |  Sample document, fictional content`, F.small, { x: MARGIN, y: PAGE.height - 46, width: WIDTH - 80, height: 12 }, new PdfBrush(MUTED));
  g.drawString(`Page ${pageNumber} of ${pageCount}`, F.small, { x: PAGE.width - MARGIN - 70, y: PAGE.height - 46, width: 70, height: 12 }, new PdfBrush(MUTED));
  const cursor = { page, g, y: 88, limit: PAGE.height - 70, title, pageNumber };
  ctx.pages.push(cursor);
  return cursor;
}

// Adds every page of a document, with its letterhead and footer, and returns them in order.
function addPages(ctx, title, pageCount) {
  for (let n = 1; n <= pageCount; n++) addPage(ctx, title, n, pageCount);
  return ctx.pages;
}

function write(c, text, f = F.body, { gap = 8, color = INK, indent = 0 } = {}) {
  const width = WIDTH - indent;
  // The (text, width) overload returns 0 x 0 in 34.2.8; the layout-area overload wraps as expected.
  const height = Math.ceil(f.measureString(text, { width, height: 2000 }).height) + 2;
  if (c.y + height > c.limit) throw new Error(`${c.title} page ${c.pageNumber}: text runs past ${c.limit} at "${text.slice(0, 40)}"`);
  c.g.drawString(text, f, { x: MARGIN + indent, y: c.y, width, height }, new PdfBrush(color));
  c.y += height + gap;
}
const title = (c, text) => write(c, text, F.title, { gap: 14 });
const heading = (c, text) => { c.y += 4; write(c, text, F.h, { gap: 6 }); };
const para = (c, text) => write(c, text);
const clause = (c, number, text) => write(c, `${number}  ${text}`, F.body, { indent: 0 });

/** Draws the printed label and rule for a field from the catalogue; the interactive field is added by the app. */
function fieldArea(ctx, field, caption) {
  const c = ctx.pages[field.page - 1];
  const b = field.bounds;
  if (c.y > b.Y - 16) throw new Error(`${c.title} page ${field.page}: text (y=${Math.round(c.y)}) overlaps field ${field.name} at Y=${b.Y}`);
  if (field.type === 'signature') {
    c.g.drawString(caption, F.label, { x: b.X, y: b.Y - 14, width: 300, height: 12 }, new PdfBrush(MUTED));
    c.g.drawLine(new PdfPen(INK, 0.75), { x: b.X, y: b.Y + b.Height + 2 }, { x: b.X + b.Width, y: b.Y + b.Height + 2 });
    c.g.drawString(`${profile.fullName}, ${profile.role}`, F.small, { x: b.X, y: b.Y + b.Height + 6, width: 300, height: 12 }, new PdfBrush(MUTED));
  } else {
    c.g.drawString(caption, F.label, { x: MARGIN, y: b.Y + 7, width: b.X - MARGIN - 6, height: 12 }, new PdfBrush(MUTED));
    c.g.drawLine(new PdfPen(RULE, 0.75), { x: b.X, y: b.Y + b.Height + 1 }, { x: b.X + b.Width, y: b.Y + b.Height + 1 });
  }
}

function countersign(c, y) {
  c.g.drawString('For Northwind Harbor Logistics', F.label, { x: 330, y: y - 14, width: 200, height: 12 }, new PdfBrush(MUTED));
  drawInk(c.g, 334, y + 10, 0.8, 7);
  c.g.drawLine(new PdfPen(INK, 0.75), { x: 330, y: y + 62 }, { x: 523, y: y + 62 });
  c.g.drawString('Dana Whitlock, People Operations', F.small, { x: 330, y: y + 66, width: 200, height: 12 }, new PdfBrush(MUTED));
}

/** A handwritten-looking stroke built from Bezier curves; `seed` varies the shape. */
function drawInk(g, x, y, scale = 1, seed = 1) {
  const pen = new PdfPen(SIGN_INK, 1.4);
  const path = new PdfPath();
  let px = x, py = y + 22 * scale;
  for (let i = 0; i < 9; i++) {
    const up = i % 2 === 0;
    const w = (10 + ((i * 7 + seed * 3) % 9)) * scale;
    const h = (up ? -(14 + ((i * 5 + seed) % 12)) : 10 + ((i * 3 + seed) % 8)) * scale;
    path.addBezier({ x: px, y: py }, { x: px + w * 0.3, y: py + h }, { x: px + w * 0.7, y: py + h }, { x: px + w, y: py + (up ? 4 : -4) * scale });
    px += w; py += (up ? 4 : -4) * scale;
  }
  path.addBezier({ x: px, y: py }, { x: px + 12 * scale, y: py - 6 * scale }, { x: px + 26 * scale, y: py + 6 * scale }, { x: px + 44 * scale, y: py - 2 * scale });
  g.drawPath(path, pen);
}

function save(ctx, fileName) {
  const bytes = ctx.doc.save();
  ctx.doc.destroy();
  // Self-check: the file must open again with the expected page count and unique object numbers.
  const check = new PdfDocument(bytes);
  const pages = check.pageCount;
  for (let i = 0; i < pages; i++) void check.getPage(i).size;
  check.destroy();
  const ids = [...Buffer.from(bytes).toString('latin1').matchAll(/(?:^|[\r\n])(\d+) 0 obj/g)].map((m) => m[1]);
  if (pages !== ctx.pages.length || new Set(ids).size !== ids.length) {
    throw new Error(`${fileName}: generated file failed its self-check (pages ${pages}, objects ${ids.length}, unique ${new Set(ids).size})`);
  }
  writeFileSync(join(outDir, fileName), bytes);
  console.log(`${fileName}: ${ctx.pages.length} page(s), ${bytes.length} bytes, self-check passed`);
}
const entry = (id) => catalogue.documents.find((d) => d.id === id);
const fieldOf = (doc, name) => doc.fields.find((f) => f.name === name);

// ---- Employment Offer Letter: 3 pages, optional text field on page 1, required signature on page 3 ----
function offerLetter() {
  const meta = entry('employment-offer-letter');
  const ctx = newDocument();
  const t = meta.title;
  const [p1, p2, p3] = addPages(ctx, t, 3);
  let c = p1;
  title(c, 'Employment Offer Letter');
  para(c, `Dear ${profile.firstName},`);
  para(c, `We are pleased to offer you the position of ${profile.role} with ${profile.company}. This letter sets out the main terms of your employment. Please read all three pages. Your signature is requested at the end of the letter.`);
  heading(c, '1. Position and reporting');
  para(c, 'You will join the Terminal Planning team at our Port Meridian office and report to the Planning Manager. Your work covers berth schedules, yard capacity reports and the weekly performance review for inbound cargo.');
  heading(c, '2. Start date and hours');
  para(c, 'Your employment begins on the start date agreed with People Operations. Standard hours are 40 per week, Monday to Friday. Hybrid working is available after your first four weeks, with at least three office days each week.');
  heading(c, '3. Compensation');
  para(c, 'Your base salary is USD 72,000 per year, paid twice a month. You are eligible for the annual performance bonus plan with a target of 8 percent of base salary, pro-rated in your first year.');
  heading(c, '4. Probation');
  para(c, 'The first 90 days of employment are a probation period. During this time either party may end the employment with one week of written notice.');
  heading(c, 'Your details');
  para(c, 'If you go by a name other than your legal first name, tell us below. This field is optional and can be left empty.');
  fieldArea(ctx, fieldOf(meta, 'preferred_name'), 'Preferred name (optional)');

  c = p2;
  heading(c, '5. Benefits');
  para(c, 'From your first day you are covered by the company medical, dental and vision plans. The company pays 80 percent of the employee premium. You may enrol dependants during your first 30 days.');
  para(c, 'You are enrolled in the retirement savings plan after 60 days. The company matches your contributions up to 4 percent of base salary.');
  heading(c, '6. Paid time off');
  para(c, 'You accrue 18 days of paid time off per year, in addition to 10 company holidays. Unused days up to a limit of 5 carry over to the following year.');
  heading(c, '7. Equipment and expenses');
  para(c, 'The company provides a laptop, a monitor and a mobile allowance of USD 40 per month. Approved business travel is reimbursed under the Travel and Expense Policy.');
  heading(c, '8. Confidentiality and conduct');
  para(c, 'As a condition of employment you will sign the Confidentiality Agreement and acknowledge the Employee Handbook. Both documents are in your onboarding packet.');
  heading(c, '9. Learning and development');
  para(c, 'You have an annual learning budget of USD 1,500 for courses and certifications related to your role, subject to your manager\'s approval.');
  heading(c, '10. Relocation');
  para(c, 'This position does not include relocation assistance.');

  c = p3;
  heading(c, '11. Ending employment');
  para(c, 'After probation, either party may end the employment with four weeks of written notice. The company may pay salary in place of notice.');
  heading(c, '12. Entire offer');
  para(c, 'This letter, together with the documents it refers to, is the whole offer and replaces any earlier discussion. Changes must be made in writing and signed by both parties.');
  heading(c, '13. Acceptance');
  para(c, 'To accept this offer, sign below. By signing you confirm that you have read all three pages and accept the terms set out in this letter. This offer remains open until the due date shown in your signing portal.');
  para(c, 'We look forward to working with you.');
  const sig = fieldOf(meta, 'employee_signature');
  fieldArea(ctx, sig, 'Accepted by (signature required)');
  countersign(c, sig.bounds.Y);
  save(ctx, 'employment-offer-letter.pdf');
}

// ---- Confidentiality Agreement: 2 pages, one required signature on each ----
function confidentialityAgreement() {
  const meta = entry('confidentiality-agreement');
  const ctx = newDocument();
  const t = meta.title;
  const [q1, q2] = addPages(ctx, t, 2);
  let c = q1;
  title(c, 'Confidentiality Agreement');
  para(c, `This agreement is between ${profile.company} ("the Company") and ${profile.fullName} ("the Employee"). It takes effect on the date the Employee signs it.`);
  heading(c, '1. Definitions');
  clause(c, '1.1', '"Confidential Information" means any non-public information about the Company\'s customers, vessel schedules, pricing, contracts, systems, finances or staff that the Employee learns through their work.');
  clause(c, '1.2', 'It does not include information that is already public through no fault of the Employee, or that the Employee knew lawfully before joining the Company.');
  clause(c, '1.3', '"Materials" means documents, files, devices and records in any form that contain Confidential Information.');
  heading(c, '2. Duty of confidentiality');
  clause(c, '2.1', 'The Employee will use Confidential Information only to do their job and will not disclose it to anyone outside the Company without written permission.');
  clause(c, '2.2', 'The Employee will take reasonable care to keep Materials secure, including locking devices and using only approved systems to store or send them.');
  clause(c, '2.3', 'The Employee will tell their manager promptly if they believe Confidential Information has been lost or disclosed.');
  para(c, 'Sign below to confirm that you have read and understood the definitions in section 1.');
  fieldArea(ctx, fieldOf(meta, 'acknowledgment_signature'), 'Definitions acknowledged (signature required)');

  c = q2;
  heading(c, '3. Permitted disclosure');
  clause(c, '3.1', 'Nothing in this agreement stops the Employee from making a disclosure that the law protects or requires, including reporting a concern to a regulator.');
  heading(c, '4. Return of materials');
  clause(c, '4.1', 'When employment ends, or earlier if asked, the Employee will return all Materials and delete any copies held on personal devices or accounts.');
  heading(c, '5. Duration');
  clause(c, '5.1', 'The duties in this agreement continue during employment and for three years after it ends. Trade secrets remain protected for as long as they stay secret.');
  heading(c, '6. General');
  clause(c, '6.1', 'If any part of this agreement cannot be enforced, the rest continues to apply.');
  clause(c, '6.2', 'This agreement does not change the Employee\'s other terms of employment.');
  heading(c, '7. Agreement');
  para(c, 'By signing below the Employee agrees to all of the terms on both pages of this agreement.');
  const sig = fieldOf(meta, 'employee_signature');
  fieldArea(ctx, sig, 'Agreed by (signature required)');
  countersign(c, sig.bounds.Y);
  save(ctx, 'confidentiality-agreement.pdf');
}

// ---- Employee Handbook Acknowledgment: 1 page, one required signature ----
function handbookAcknowledgment() {
  const meta = entry('handbook-acknowledgment');
  const ctx = newDocument();
  const c = addPage(ctx, meta.title, 1, 1);
  title(c, 'Employee Handbook Acknowledgment');
  para(c, `I, ${profile.fullName}, confirm that I have received the ${profile.company} Employee Handbook and that I know where to find the current version on the company intranet.`);
  heading(c, 'I understand that');
  clause(c, 'a.', 'the handbook describes company policies on conduct, safety, working hours, time off, expenses and the use of company systems;');
  clause(c, 'b.', 'I am expected to read it within my first two weeks and to follow the policies it contains;');
  clause(c, 'c.', 'the company may update the handbook and will tell employees when it does;');
  clause(c, 'd.', 'the handbook is a guide to company policy and is not a contract of employment;');
  clause(c, 'e.', 'I can ask my manager or People Operations if anything in it is unclear.');
  heading(c, 'Site safety');
  para(c, 'I understand that terminal areas have additional safety rules, and that I must complete the site safety induction before entering any operational area.');
  heading(c, 'Acknowledgment');
  para(c, 'Sign below to acknowledge the statements above.');
  fieldArea(ctx, fieldOf(meta, 'employee_signature'), 'Acknowledged by (signature required)');
  save(ctx, 'handbook-acknowledgment.pdf');
}

// ---- Direct Deposit Authorization: 1 page, already signed (no fields; the signature is page content) ----
function directDeposit() {
  const meta = entry('direct-deposit-authorization');
  const ctx = newDocument();
  const c = addPage(ctx, meta.title, 1, 1);
  title(c, 'Direct Deposit Authorization');
  para(c, `I, ${profile.fullName}, authorize ${profile.company} to pay my salary and reimbursements by direct deposit to the account I have registered with Payroll.`);
  heading(c, 'Account on file');
  para(c, 'Bank: Meridian Coast Credit Union (fictional)');
  para(c, 'Account type: Checking');
  para(c, 'Account: ending in 0000 (sample value, not a real account)');
  heading(c, 'Terms');
  clause(c, '1.', 'This authorization stays in effect until I change it in writing or my employment ends.');
  clause(c, '2.', 'If a payment is made in error, the company may correct it with an adjusting entry.');
  clause(c, '3.', 'Changes received after the payroll cut-off take effect in the next pay period.');
  heading(c, 'Authorization');
  para(c, 'Signed by the employee:');
  const y = c.y + 8;
  drawInk(c.g, MARGIN + 4, y + 6, 1, 2);
  c.g.drawLine(new PdfPen(INK, 0.75), { x: MARGIN, y: y + 62 }, { x: MARGIN + 230, y: y + 62 });
  c.g.drawString(`${profile.fullName}, ${profile.role}`, F.small, { x: MARGIN, y: y + 66, width: 300, height: 12 }, new PdfBrush(MUTED));
  c.g.drawString('Signed electronically. This document is complete and read-only.', F.small, { x: MARGIN, y: y + 90, width: WIDTH, height: 12 }, new PdfBrush(MUTED));
  // A signed copy carries the watermark, with the same placement as src/adapters/pdfFinalizer.ts (WATERMARK).
  const mark = new PdfBitmap(new Uint8Array(readFileSync(join(root, 'public', 'branding', 'syncfusion-watermark.jpg'))));
  const markWidth = 112;
  const markHeight = mark.height * (markWidth / mark.width);
  const state = c.g.save();
  c.g.setTransparency(0.16);
  c.g.drawImage(mark, { x: PAGE.width - markWidth - 24, y: PAGE.height - markHeight - 60, width: markWidth, height: markHeight });
  c.g.restore(state);
  save(ctx, 'direct-deposit-authorization.pdf');
}

mkdirSync(outDir, { recursive: true });
offerLetter();
confidentialityAgreement();
handbookAcknowledgment();
directDeposit();
// ej2 keeps the Node event loop alive after the work is done.
process.exit(0);
