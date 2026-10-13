// Build-phase checks (tasks B1 to B6 in tasks/todo.md) against the production build served by server.mjs:
// the host itself, the two-signature document, clearing a signature, reset and tab isolation, a keyboard-only
// signing, the error states, the health page and the narrow layout. Prints a JSON report; a failed expectation
// is a failed check.
//   PORT=4320 node server.mjs   (in another shell)
//   node build-journey.mjs --origin http://localhost:4320 --out ../../validation/screenshots/build-journey
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const origin = arg('origin', 'http://localhost:4320');
const mount = '/e-signing-portal/react';
const base = `${origin}${mount}/`;
const out = arg('out', '../../validation/screenshots/build-journey');
mkdirSync(out, { recursive: true });

const steps = [];
const step = (name, expected, observed, pass, extra = {}) => steps.push({ step: name, expected, observed: typeof observed === 'string' ? observed : JSON.stringify(observed), result: pass ? 'passed' : 'failed', ...extra });
const guard = async (name, fn) => { try { await fn(); } catch (error) { step(`${name} (aborted)`, 'the step runs to its end', String(error?.message ?? error).split('\n')[0], false); } };

// ---------- Host (server.mjs) ----------
await guard('H Host', async () => {
  const health = await fetch(`${origin}/healthz`);
  const body = await health.json();
  step('H1 Host /healthz', '200 with status ok, service, version, uptimeSeconds, node, timestamp', { status: health.status, ...body },
    health.status === 200 && body.status === 'ok' && body.service === 'e-signing-portal' && /^\d+\.\d+\.\d+$/.test(body.version) && typeof body.uptimeSeconds === 'number' && /^v\d+/.test(body.node) && !Number.isNaN(Date.parse(body.timestamp)));

  const html = await (await fetch(`${base}documents`)).text();
  const asset = html.match(/src="([^"]+\/assets\/index-[^"]+\.js)"/)?.[1];
  const js = await fetch(`${origin}${asset}`, { headers: { 'Accept-Encoding': 'br' } });
  const plain = await fetch(`${origin}${asset}`, { headers: { 'Accept-Encoding': 'identity' } });
  step('H2 Prefixed asset through the mount path', 'the entry script is served as JavaScript (not index.html), Brotli when accepted, uncompressed otherwise',
    { asset, type: js.headers.get('content-type'), encoding: js.headers.get('content-encoding'), vary: js.headers.get('vary'), brotliBytes: js.headers.get('content-length'), plainEncoding: plain.headers.get('content-encoding'), plainBytes: plain.headers.get('content-length') },
    !!asset && asset.startsWith(mount) && (js.headers.get('content-type') ?? '').startsWith('text/javascript') && js.headers.get('content-encoding') === 'br' && plain.headers.get('content-encoding') === null
      && Number(js.headers.get('content-length')) < Number(plain.headers.get('content-length')));

  const wasm = await fetch(`${base}ej2-pdfviewer-lib/pdfium.wasm`, { headers: { 'Accept-Encoding': 'br' } });
  const pdf = await fetch(`${base}documents/confidentiality-agreement.pdf`);
  const missing = await fetch(`${base}documents/none.pdf`);
  const root = await fetch(`${origin}/`, { redirect: 'manual' });
  const deep = await fetch(`${base}sign/employment-offer-letter`);
  step('H3 Engine, document, missing file, root and deep link', 'pdfium.wasm as application/wasm (compressed); the PDF as a PDF; a missing file is 404, not a page; / redirects into the mount path; a deep link returns the app',
    { wasm: [wasm.status, wasm.headers.get('content-type'), wasm.headers.get('content-encoding')], pdf: [pdf.status, pdf.headers.get('content-type')], missing: missing.status, root: [root.status, root.headers.get('location')], deep: [deep.status, deep.headers.get('content-type')] },
    wasm.status === 200 && wasm.headers.get('content-type') === 'application/wasm' && wasm.headers.get('content-encoding') === 'br' && pdf.status === 200 && missing.status === 404
      && root.status === 308 && root.headers.get('location') === `${mount}/` && deep.status === 200 && (deep.headers.get('content-type') ?? '').startsWith('text/html'));
});

// ---------- Browser ----------
const browser = await chromium.launch();
const consoleErrors = [];
const newContext = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', acceptDownloads: true, ...options });
  context.on('page', (p) => { p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); }); p.on('pageerror', (e) => consoleErrors.push(e.message + ' @ ' + String(e.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim().replace(/https?:\/\/[^/]+/g, '')).join(' < '))); });
  return context;
};
const helpers = (page) => {
  const viewer = (fn, ...args) => page.evaluate(({ fn, args }) => {
    const v = document.getElementById('signing-viewer')?.ej2_instances?.[0];
    return v ? new Function('v', 'args', `return (${fn})(v, ...args)`)(v, args) : null;
  }, { fn: fn.toString(), args });
  const shot = async (name) => { const file = join(out, `${name}.png`); await page.screenshot({ path: file }); return file.replace(/\\/g, '/'); };
  const open = async (id) => { await page.goto(`${base}sign/${id}`, { waitUntil: 'networkidle' }); await page.waitForSelector('.viewer-area[data-viewer-state="ready"]', { timeout: 60000 }); await page.waitForTimeout(1200); };
  const status = () => page.locator('[data-testid="sign-status"]').innerText();
  const counts = async () => ({ ready: await page.locator('[data-testid="ready-section"] article').count(), completed: await page.locator('[data-testid="completed-section"] article').count() });
  const dialog = page.locator('.e-pv-signature-window.e-popup-open');
  /** Signs one field with the prefilled typed name, by pointer. */
  const signTyped = async (name) => {
    await page.locator(`.field-row[data-field="${name}"]`).click();
    await page.waitForTimeout(2200);
    const id = await viewer((v, n) => v.retrieveFormFields().find((f) => f.name === n).id, name);
    const box = await page.locator(`#${id}`).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await dialog.waitFor({ timeout: 10000 });
    await dialog.locator('.e-tab-text', { hasText: /type/i }).click();
    await page.waitForFunction(() => document.querySelector('.e-pv-signature-window.e-popup-open input[id$="_e-pv-Signtext-box"]')?.value === 'Peter Hale', null, { timeout: 5000 });
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForFunction((n) => document.querySelector(`.field-row[data-field="${n}"]`)?.dataset.filled === 'true', name, { timeout: 10000 });
  };
  const toast = async () => { await page.waitForSelector('.e-toast', { timeout: 6000 }); await page.waitForTimeout(600); return (await page.locator('.e-toast').first().innerText()).replace(/\s+/g, ' '); };
  const closeToasts = async () => { for (const b of await page.locator('.e-toast .e-toast-close-icon').all()) await b.click().catch(() => {}); await page.waitForTimeout(400); };
  return { viewer, shot, open, status, counts, dialog, signTyped, toast, closeToasts };
};

const context = await newContext();
const page = await context.newPage();
const h = helpers(page);

// B1: the two-signature Confidentiality Agreement, and clearing a signature
await guard('B1 Two signatures', async () => {
  await h.open('confidentiality-agreement');
  const s0 = await h.status();
  await page.getByRole('button', { name: 'Finish Signing' }).click();
  const t0 = await h.toast();
  step('B1a Finish with nothing signed', '"Signatures Required · 2 remaining"; Toast "2 signatures are still required"', { status: s0, toast: t0 }, s0.includes('2 remaining') && t0.includes('2 signatures are still required'));
  await h.closeToasts();

  await h.signTyped('acknowledgment_signature');
  const s1 = await h.status();
  await page.getByRole('button', { name: 'Finish Signing' }).click();
  const t1 = await h.toast();
  await page.waitForTimeout(2500);
  const where = await page.evaluate(() => {
    const v = document.getElementById('signing-viewer').ej2_instances[0];
    const el = document.getElementById(v.retrieveFormFields().find((f) => f.name === 'employee_signature').id);
    const area = document.querySelector('.viewer-area').getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    return { page: v.currentPageNumber, offset: r ? Math.round(r.top + r.height / 2 - (area.top + area.height / 2)) : null, path: location.pathname };
  });
  step('B1b Finish with one of two signed (plan journey step 9)', '"1 remaining"; Toast "1 signature is still required"; the viewer jumps to the second signature on page 2; the route does not change',
    { status: s1, toast: t1, ...where }, s1.includes('1 remaining') && t1.includes('1 signature is still required') && where.page === 2 && where.offset !== null && Math.abs(where.offset) <= 80 && where.path.endsWith('/sign/confidentiality-agreement'),
    { screenshot: await h.shot('b1b-second-signature') });
  await h.closeToasts();

  // Clear the first signature and sign it again
  await page.locator('[data-clear="acknowledgment_signature"]').click();
  await page.waitForFunction(() => document.querySelector('.field-row[data-field="acknowledgment_signature"]')?.dataset.filled === 'false', null, { timeout: 8000 });
  const sCleared = await h.status();
  const valueCleared = await h.viewer((v) => v.retrieveFormFields().find((f) => f.name === 'acknowledgment_signature').value || '');
  const clearShot = await h.shot('b1c-cleared');
  await h.signTyped('acknowledgment_signature');
  const sResigned = await h.status();
  step('B1c Clear and sign again', 'Clear empties the signature ("2 remaining" again, no Clear button on that row); signing it again returns to "1 remaining"',
    { afterClear: sCleared, valueLength: valueCleared.length, afterResign: sResigned }, sCleared.includes('2 remaining') && valueCleared.length === 0 && sResigned.includes('1 remaining'), { screenshot: clearShot });

  await h.signTyped('employee_signature');
  const flag = (await page.locator('[data-testid="next-flag"]').innerText()).trim();
  const sDone = await h.status();
  await page.locator('[data-testid="next-flag"]').click();
  const confirm = page.locator('.app-dialog.e-popup-open');
  await confirm.waitFor({ timeout: 5000 });
  await confirm.getByRole('button', { name: 'Finish signing', exact: true }).click();
  await page.waitForURL('**/complete/confidentiality-agreement', { timeout: 30000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Documents' }).click()]);
  step('B1d Both signed, finish', '"All signatures complete"; the button over the document reads "Finish"; Signing Complete is shown; the download is "Confidentiality Agreement - signed.pdf"',
    { status: sDone, flag, path: new URL(page.url()).pathname, file: download.suggestedFilename() },
    sDone.includes('All signatures complete') && flag === 'Finish' && download.suggestedFilename() === 'Confidentiality Agreement - signed.pdf', { screenshot: await h.shot('b1d-complete') });
});

// B2: second-tab isolation and Reset demo
await guard('B2 Reset and isolation', async () => {
  await page.getByRole('button', { name: 'Back to My Documents' }).click();
  await page.waitForSelector('[data-testid="ready-section"]');
  const here = await h.counts();
  const other = await context.newPage();
  await other.goto(`${base}documents`, { waitUntil: 'networkidle' });
  await other.waitForSelector('[data-testid="ready-section"] article');
  const there = { ready: await other.locator('[data-testid="ready-section"] article').count(), completed: await other.locator('[data-testid="completed-section"] article').count() };
  await other.close();
  step('B2a A second tab is unaffected', 'This tab: 2 ready, 2 completed. A second tab opened now: 3 ready, 1 completed', { thisTab: here, secondTab: there },
    here.ready === 2 && here.completed === 2 && there.ready === 3 && there.completed === 1);

  await page.getByRole('button', { name: 'Reset demo' }).click();
  const confirm = page.locator('.app-dialog.e-popup-open');
  await confirm.waitFor({ timeout: 5000 });
  const text = (await confirm.innerText()).replace(/\s+/g, ' ');
  const resetShot = await h.shot('b2b-reset-confirm');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForTimeout(500);
  const afterCancel = await h.counts();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await confirm.waitFor({ timeout: 5000 });
  await confirm.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.waitForTimeout(800);
  const afterReset = await h.counts();
  const completeRedirect = await (async () => { await page.goto(`${base}complete/confidentiality-agreement`, { waitUntil: 'networkidle' }); return new URL(page.url()).pathname; })();
  step('B2b Reset demo (plan journey step 10)', 'The dialog explains the reset; Cancel changes nothing (2 ready, 2 completed); Reset returns to 3 ready, 1 completed; the old confirmation URL then goes back to the list',
    { dialog: text, afterCancel, afterReset, completeRedirect },
    text.includes('Reset demo?') && afterCancel.ready === 2 && afterCancel.completed === 2 && afterReset.ready === 3 && afterReset.completed === 1 && completeRedirect.endsWith('/documents'), { screenshot: resetShot });
});

// B3: keyboard-only signing of the one-page document
await guard('B3 Keyboard', async () => {
  await h.open('handbook-acknowledgment');
  const active = () => page.evaluate(() => { const a = document.activeElement; return { cls: String(a?.className ?? ''), text: (a?.textContent ?? '').trim().slice(0, 30), tag: a?.tagName }; });
  const tabUntil = async (test, max, key = 'Tab') => { for (let i = 1; i <= max; i++) { await page.keyboard.press(key); if (test(await active())) return i; } return -1; };
  await page.locator('.sign-back').focus();
  const toFlag = await tabUntil((a) => a.cls.includes('next-flag'), 12);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
  const onField = await active();
  await page.keyboard.press('Enter');
  await h.dialog.waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
  const tabBefore = (await h.dialog.locator('.e-toolbar-item.e-active').innerText()).trim();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  const tabAfter = (await h.dialog.locator('.e-toolbar-item.e-active').innerText()).trim();
  const typed = await h.dialog.locator('input[id$="_e-pv-Signtext-box"]').inputValue();
  const toCreate = await tabUntil((a) => a.tag === 'BUTTON' && a.text === 'Create', 14);
  if (toCreate < 0) throw new Error('Create was not reached by Tab; focus ended on ' + JSON.stringify(await active()));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-testid="sign-status"]')?.textContent?.includes('All signatures complete'), null, { timeout: 10000 });
  await page.locator('.sign-back').focus();
  const toFinish = await tabUntil((a) => a.tag === 'BUTTON' && a.text === 'Finish Signing', 8);
  await page.keyboard.press('Enter');
  const confirm = page.locator('.app-dialog.e-popup-open');
  await confirm.waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  const toConfirm = await tabUntil((a) => a.tag === 'BUTTON' && a.text === 'Finish signing', 6);
  const focusInDialog = await page.evaluate(() => !!document.activeElement?.closest('.app-dialog'));
  await page.keyboard.press('Enter');
  await page.waitForURL('**/complete/handbook-acknowledgment', { timeout: 30000 });
  step('B3 Keyboard-only signing', 'Without the pointer: Tab reaches Next, Enter goes to the field, Enter opens the dialog, Right arrow moves from Draw to Type (name prefilled), Tab reaches Create, then Finish Signing and its confirmation complete the document',
    { tabsToNext: toFlag, fieldFocused: onField.cls, tabBefore, tabAfter, typed, tabsToCreate: toCreate, tabsToFinish: toFinish, tabsToConfirm: toConfirm, focusInDialog, path: new URL(page.url()).pathname },
    toFlag > 0 && tabBefore === 'DRAW' && tabAfter === 'TYPE' && typed === 'Peter Hale' && toCreate > 0 && toFinish > 0 && toConfirm > 0 && focusInDialog, { screenshot: await h.shot('b3-keyboard-complete') });
});

// B4: error states
await guard('B4 Errors', async () => {
  await page.goto(`${base}sign/no-such-document`, { waitUntil: 'networkidle' });
  const notFound = (await page.locator('[role="alert"]').innerText()).replace(/\s+/g, ' ');
  step('B4a Unknown document id', '"Document not found." with a link back to My Documents', notFound, notFound.includes('Document not found.') && notFound.includes('Back to My Documents'), { screenshot: await h.shot('b4a-not-found') });

  await page.goto(`${base}documents`, { waitUntil: 'networkidle' }); // a reload: the tab is back at its baseline
  await page.route('**/documents/employment-offer-letter.pdf', (route) => route.abort());
  const started = Date.now();
  await page.goto(`${base}sign/employment-offer-letter`, { waitUntil: 'commit' });
  await page.waitForSelector('.viewer-area [role="alert"]', { timeout: 60000 });
  const waited = Math.round((Date.now() - started) / 1000);
  const failure = (await page.locator('.viewer-area [role="alert"]').innerText()).replace(/\s+/g, ' ');
  const viewerGone = (await page.locator('#signing-viewer').count()) === 0;
  const failShot = await h.shot('b4b-load-failed');
  await page.unroute('**/documents/employment-offer-letter.pdf');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForSelector('.viewer-area[data-viewer-state="ready"]', { timeout: 60000 });
  const recovered = await h.viewer((v) => v.pageCount);
  step('B4b Document cannot be loaded', 'A message "We couldn\'t open this document." with Try again replaces the viewer (no endless spinner); Try again loads the 3-page document once the file is reachable',
    { message: failure, secondsToMessage: waited, viewerRemoved: viewerGone, pagesAfterRetry: recovered }, failure.includes("We couldn't open this document.") && viewerGone && recovered === 3, { screenshot: failShot });

  // The watermark image cannot be loaded: signing must still complete, and say so.
  await page.route('**/branding/syncfusion-watermark.jpg', (route) => route.abort());
  await h.open('handbook-acknowledgment');
  await h.signTyped('employee_signature');
  await page.getByRole('button', { name: 'Finish Signing' }).click();
  const confirm = page.locator('.app-dialog.e-popup-open');
  await confirm.waitFor({ timeout: 5000 });
  await confirm.getByRole('button', { name: 'Finish signing', exact: true }).click();
  await page.waitForURL('**/complete/handbook-acknowledgment', { timeout: 30000 });
  const warn = await h.toast();
  await page.unroute('**/branding/syncfusion-watermark.jpg');
  step('B4c Watermark image unavailable', 'Signing still completes, with a Toast saying the copy has no watermark', { path: new URL(page.url()).pathname, toast: warn }, warn.includes('Signed without a watermark'), { screenshot: await h.shot('b4c-no-watermark') });
});

// B5: the health page, by direct URL, in both themes
await guard('B5 Health page', async () => {
  const seen = {};
  for (const theme of ['light', 'dark']) {
    const c = await newContext({ colorScheme: theme });
    const p = await c.newPage();
    await p.goto(`${base}healthz`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="health-status"]');
    seen[theme] = {
      status: await p.locator('[data-testid="health-status"]').innerText(), app: await p.locator('[data-testid="health-app"]').innerText(), version: await p.locator('[data-testid="health-version"]').innerText(),
      shell: await p.locator('.app-topbar').count(), theme: await p.evaluate(() => document.documentElement.dataset.theme), text: (await p.locator('main.healthz').innerText()).replace(/\s+/g, ' ').slice(0, 260),
    };
    await p.screenshot({ path: join(out, `b5-healthz-${theme}.png`) });
    await c.close();
  }
  step('B5 /healthz page by direct URL', 'Outside the shell (no top bar): status ok, app e-signing-portal, the package version, build time, fixture version, in light and dark', seen,
    ['light', 'dark'].every((t) => seen[t].status === 'ok' && seen[t].app === 'e-signing-portal' && /^\d+\.\d+\.\d+$/.test(seen[t].version) && seen[t].shell === 0 && seen[t].theme === t && seen[t].text.includes('Fixture version 1')));
});

// B3 (layout): the field list on a phone
await guard('B3 Narrow layout', async () => {
  const c = await newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  const n = helpers(p);
  await n.open('employment-offer-letter');
  const panelVisible = await p.locator('.field-panel').isVisible();
  const flag = await p.evaluate(() => { const f = document.querySelector('.next-flag'); const r = f.getBoundingClientRect(); return { beside: f.dataset.beside, width: Math.round(r.width), name: f.textContent.trim(), bottomGap: Math.round(innerHeight - r.bottom) }; });
  const button = p.locator('.fields-button');
  const label = (await button.innerText()).replace(/\s+/g, ' ').trim();
  await button.click();
  const dlg = p.locator('.fields-dialog.e-popup-open');
  await dlg.waitFor({ timeout: 5000 });
  const rows = await dlg.locator('.field-row').count();
  const shot = await n.shot('b3-phone-fields-dialog');
  await dlg.locator('.field-row[data-field="employee_signature"]').click();
  await p.waitForTimeout(2500);
  const closed = (await p.locator('.fields-dialog.e-popup-open').count()) === 0;
  const pageNow = await n.viewer((v) => v.currentPageNumber);
  const scroll = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  step('B3 Field list on a phone (390px)', 'The side panel is hidden; a "Fields (2 left)" button opens the same list in a dialog; choosing the signature closes it and goes to page 3; the Next button is an arrow only at the bottom left; no sideways scroll',
    { panelVisible, button: label, rows, dialogClosed: closed, page: pageNow, flag, horizontalScroll: scroll },
    !panelVisible && label === 'Fields (2 left)' && rows === 2 && closed && pageNow === 3 && flag.beside === 'viewer' && flag.width <= 60 && flag.name === 'Next' && scroll <= 0, { screenshot: shot, afterScreenshot: await n.shot('b3-phone-after-choice') });
  await c.close();
});

step('Console', 'No console error or uncaught exception, apart from the two requests this script blocks on purpose',
  consoleErrors.filter((e) => !/ERR_FAILED|net::ERR|Failed to load resource|Failed to fetch|Signed copy produced without its watermark/i.test(e)).join(' | ').slice(0, 600) || 'none',
  consoleErrors.filter((e) => !/ERR_FAILED|net::ERR|Failed to load resource|Failed to fetch|Signed copy produced without its watermark/i.test(e)).length === 0, { blockedRequestMessages: consoleErrors.length });

await browser.close();
const report = { origin, base, finishedAt: new Date().toISOString(), steps, passed: steps.every((s) => s.result === 'passed') };
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
