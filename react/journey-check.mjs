// Runs the plan's approval journey (openspec/architecture/app-plan.md) for the prototype slice against a
// running build, in light and dark, and prints a JSON report. A failed expectation is a failed check.
//   node journey-check.mjs --base http://localhost:4319/e-signing-portal/react/ --out ../../validation/screenshots/prototype-journey
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { PdfDocument } = require('@syncfusion/ej2-pdf');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:4319/e-signing-portal/react/');
const out = arg('out', '../../validation/screenshots/prototype-journey');
mkdirSync(out, { recursive: true });

const report = { base, startedAt: new Date().toISOString(), runs: [] };
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const steps = [];
  const consoleErrors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, acceptDownloads: true });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  const shot = async (name) => { const file = join(out, `${theme}-${name}.png`); await page.screenshot({ path: file }); return file.replace(/\\/g, '/'); };
  const step = (name, expected, observed, pass, extra = {}) => steps.push({ step: name, expected, observed, result: pass ? 'passed' : 'failed', ...extra });
  const viewer = (fn, ...args) => page.evaluate(({ fn, args }) => {
    const v = document.getElementById('signing-viewer')?.ej2_instances?.[0];
    return v ? new Function('v', 'args', `return (${fn})(v, ...args)`)(v, args) : null;
  }, { fn: fn.toString(), args });
  const waitViewer = () => page.waitForSelector('.viewer-area[data-viewer-state="ready"]', { timeout: 60000 });
  const statusText = () => page.locator('[data-testid="sign-status"]').innerText();
  const counts = async () => ({
    ready: await page.locator('[data-testid="ready-section"] article').count(),
    completed: await page.locator('[data-testid="completed-section"] article').count(),
  });

  try {
    // 1. My Documents
    await page.goto(new URL('./documents', base).href, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="ready-section"] article');
    const c1 = await counts();
    const readyIds = await page.locator('[data-testid="ready-section"] article').evaluateAll((els) => els.map((e) => e.dataset.document));
    const profile = await page.locator('.app-profile-name').innerText();
    const appliedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    step('1 My Documents', '3 ready (NDA, offer letter, handbook), 1 completed, Peter Hale signed in, theme follows the system setting',
      `${c1.ready} ready [${readyIds.join(', ')}], ${c1.completed} completed, profile "${profile.replace(/\s+/g, ' ')}", theme ${appliedTheme}`,
      c1.ready === 3 && c1.completed === 1 && readyIds.join() === 'confidentiality-agreement,employment-offer-letter,handbook-acknowledgment' && profile.includes('Peter Hale') && appliedTheme === theme,
      { screenshot: await shot('01-documents') });

    // 2. Open the offer letter
    await page.getByRole('button', { name: 'Review and sign Employment Offer Letter' }).click();
    await waitViewer();
    await page.waitForTimeout(1500);
    const info = await viewer((v) => ({ pages: v.pageCount, fields: v.retrieveFormFields().map((f) => ({ name: f.name, type: f.type, page: f.pageNumber, required: f.isRequired, filled: !!f.value })) }));
    const s2 = await statusText();
    step('2 Open Employment Offer Letter', '3 pages; "Signatures Required · 1 remaining"; optional text field on page 1, required signature on page 3',
      `${info.pages} pages; "${s2}"; ${JSON.stringify(info.fields)}`,
      info.pages === 3 && s2.includes('Signatures Required') && s2.includes('1 remaining') && info.fields.length === 2
        && info.fields.some((f) => f.name === 'preferred_name' && f.page === 1 && !f.required) && info.fields.some((f) => f.name === 'employee_signature' && f.page === 3 && f.required),
      { screenshot: await shot('02-sign-loaded') });

    // 2b. Next over the document: each press scrolls the next unfilled field to the middle of the view.
    const flag = page.locator('[data-testid="next-flag"]');
    const centreOffset = (name) => page.evaluate((name) => {
      const v = document.getElementById('signing-viewer').ej2_instances[0];
      const el = document.getElementById(v.retrieveFormFields().find((f) => f.name === name).id);
      const area = document.querySelector('.viewer-area').getBoundingClientRect();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return Math.round(r.top + r.height / 2 - (area.top + area.height / 2));
    }, name);
    await page.waitForTimeout(600); // the button settles beside the page
    const flagBox = await flag.boundingBox();
    const pageBox = await page.locator('#signing-viewer_pageDiv_0').boundingBox();
    const flagGap = Math.round(pageBox.x - (flagBox.x + flagBox.width));
    const flagText1 = (await flag.innerText()).trim();
    await flag.click();
    await page.waitForTimeout(2500);
    const off1 = await centreOffset('preferred_name');
    const page1 = await viewer((v) => v.currentPageNumber);
    const nextShot1 = await shot('02b-next-preferred-name');
    await flag.click();
    await page.waitForTimeout(3000);
    const off2 = await centreOffset('employee_signature');
    const page2 = await viewer((v) => v.currentPageNumber);
    step('2b Next over the document', 'A "Next" button just outside the left edge of the PDF page (0 to 8px from it); first press brings Preferred name (page 1) to the middle of the view, second press the signature field (page 3)',
      `button "${flagText1}" ending ${flagGap}px before the page's left edge; press 1: page ${page1}, field ${off1}px from the middle; press 2: page ${page2}, field ${off2}px from the middle`,
      flagText1 === 'Next' && flagGap >= 0 && flagGap <= 8 && page1 === 1 && off1 !== null && Math.abs(off1) <= 80 && page2 === 3 && off2 !== null && Math.abs(off2) <= 80,
      { screenshot: await shot('02c-next-signature'), firstPressScreenshot: nextShot1 });

    // 3. Finish without signing
    await page.getByRole('button', { name: 'Finish Signing' }).click();
    await page.waitForSelector('.e-toast', { timeout: 5000 });
    await page.waitForTimeout(1500);
    const toast = (await page.locator('.e-toast').first().innerText()).replace(/\s+/g, ' ');
    const pageNow = await viewer((v) => v.currentPageNumber);
    step('3 Finish Signing with no signature', 'Toast "1 signature is still required"; the viewer shows page 3; the route does not change',
      `toast "${toast}"; page ${pageNow}; path ${new URL(page.url()).pathname}`,
      toast.includes('1 signature is still required') && pageNow === 3 && page.url().includes('/sign/employment-offer-letter'),
      { screenshot: await shot('03-validation-toast') });

    // 4. Open the signature dialog
    const fieldId = await viewer((v) => v.retrieveFormFields().find((f) => f.name === 'employee_signature').id);
    const box = await page.locator(`#${fieldId}`).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const dialog = page.locator('.e-pv-signature-window.e-popup-open');
    await dialog.waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const tabs = (await dialog.locator('.e-tab-text').allInnerTexts()).map((t) => t.trim().toUpperCase());
    const buttonState = async (name) => dialog.getByRole('button', { name, exact: true }).isDisabled();
    const createDisabledEmpty = await buttonState('Create');
    const drawShot = await shot('04-dialog-draw');
    step('4 Signature dialog', 'Opens on the default dialog with Draw, Type and Upload tabs; Create is unavailable while nothing is drawn',
      `tabs [${tabs.join(', ')}]; Create disabled when empty: ${createDisabledEmpty}`,
      ['DRAW', 'TYPE', 'UPLOAD'].every((t) => tabs.includes(t)) && createDisabledEmpty === true, { screenshot: drawShot });

    // Upload and Type tabs (screenshots), then sign: draw in light, type in dark, so both paths are exercised.
    await dialog.locator('.e-tab-text', { hasText: /upload/i }).click();
    await page.waitForTimeout(600);
    const uploadShot = await shot('04b-dialog-upload');
    await dialog.locator('.e-tab-text', { hasText: /type/i }).click();
    await page.waitForTimeout(600);
    const typeBox = dialog.locator('input[id$="_e-pv-Signtext-box"]');
    await page.waitForTimeout(900); // the app fills in the signed-in person's name; nothing is typed here
    const prefilled = await typeBox.inputValue();
    const createEnabledTyped = !(await buttonState('Create'));
    const fonts = await dialog.locator('.e-pv-font-sign').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '')));
    const fontsLoaded = await page.evaluate((families) => families.map((f) => document.fonts.check(`24px "${f}"`)), ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat']);
    const typeShot = await shot('04c-dialog-type');
    const previews = (await dialog.locator('.e-pv-font-sign').allInnerTexts()).map((t) => t.trim());
    step('4b Type and Upload tabs', 'Type tab already reads "Peter Hale" with nothing typed, previewed in the four open-licence fonts, all loaded, and Create available; Upload tab is present',
      `name box "${prefilled}"; previews [${previews.join(', ')}]; fonts [${fonts.join(', ')}]; loaded [${fontsLoaded.join(', ')}]; Create enabled: ${createEnabledTyped}`,
      prefilled === 'Peter Hale' && previews.length === 4 && previews.every((t) => t === 'Peter Hale') && createEnabledTyped
        && fonts.join() === 'Dancing Script,Sacramento,Pacifico,Caveat' && fontsLoaded.every(Boolean), { screenshot: typeShot, uploadScreenshot: uploadShot });

    let method = 'typed';
    if (theme === 'light') {
      method = 'drawn';
      await dialog.getByRole('button', { name: 'Clear', exact: true }).click().catch(() => {});
      await dialog.locator('.e-tab-text', { hasText: /draw/i }).click();
      await page.waitForTimeout(600);
      const canvas = await dialog.locator('canvas').first().boundingBox();
      const pts = [[0.2, 0.6], [0.3, 0.3], [0.4, 0.7], [0.5, 0.35], [0.6, 0.65], [0.75, 0.4]];
      await page.mouse.move(canvas.x + canvas.width * pts[0][0], canvas.y + canvas.height * pts[0][1]);
      await page.mouse.down();
      for (const [px, py] of pts.slice(1)) await page.mouse.move(canvas.x + canvas.width * px, canvas.y + canvas.height * py, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="sign-status"]')?.textContent?.includes('All signatures complete'), null, { timeout: 10000 });
    const after = await viewer((v) => v.retrieveFormFields().map((f) => ({ name: f.name, filled: !!f.value, kind: f.signatureType || '' })));
    const row = (await page.locator('.field-row[data-field="employee_signature"]').innerText()).replace(/\s+/g, ' ');
    step('5 Signature placed', `The ${method} signature is in the field; the list says "Signed by Peter Hale"; header "All signatures complete"; Preferred name still empty`,
      `${JSON.stringify(after)}; row "${row}"; status "${await statusText()}"`,
      after.find((f) => f.name === 'employee_signature').filled && !after.find((f) => f.name === 'preferred_name').filled && row.includes('Signed by Peter Hale'),
      { screenshot: await shot('05-signed') });

    const flagAfter = (await flag.innerText()).trim();
    step('5b Button over the document after signing', 'Reads "Finish" once no required field is left', `"${flagAfter}"`, flagAfter === 'Finish');

    // 6. Finish: from the header in light, from the button over the document in dark.
    if (theme === 'light') await page.getByRole('button', { name: 'Finish Signing' }).click(); else await flag.click();
    const confirm = page.locator('.app-dialog.e-popup-open');
    await confirm.waitFor({ timeout: 5000 });
    const confirmText = (await confirm.innerText()).replace(/\s+/g, ' ');
    const confirmShot = await shot('06-finish-confirm');
    await confirm.getByRole('button', { name: 'Finish signing', exact: true }).click();
    await page.waitForURL('**/complete/employment-offer-letter', { timeout: 30000 });
    const heading = await page.locator('#complete-title').innerText();
    step('6 Finish Signing', 'Confirmation dialog, then /complete/employment-offer-letter with "Thank you, Peter"',
      `dialog "${confirmText}"; path ${new URL(page.url()).pathname}; heading "${heading}"`,
      confirmText.includes('Finish signing?') && confirmText.includes('read-only') && heading === 'Thank you, Peter',
      { screenshot: await shot('06b-complete'), confirmScreenshot: confirmShot });

    // 7. Download and review
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Documents' }).click()]);
    const saved = join(out, `${theme}-${download.suggestedFilename()}`);
    await download.saveAs(saved);
    const pdf = new PdfDocument(new Uint8Array(readFileSync(saved)));
    const savedBytes = readFileSync(saved);
    const images = (buf) => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length;
    const pdfInfo = { pages: pdf.pageCount, formFields: pdf.form ? pdf.form.count : 0, bytes: savedBytes.length, header: savedBytes.subarray(0, 5).toString('latin1'), images: images(savedBytes) };
    pdf.destroy();
    // The unsigned source the person was signing has no image at all: the watermark exists only in the signed copy.
    const sourceImages = images(Buffer.from(await (await fetch(new URL('./documents/employment-offer-letter.pdf', base))).arrayBuffer()));
    await page.getByRole('button', { name: 'Review Documents' }).click();
    await waitViewer();
    await viewer((v) => v.navigation.goToPage(3));
    await page.waitForTimeout(2500);
    const review = await viewer((v) => ({ pages: v.pageCount, fields: v.retrieveFormFields().length }));
    const s7 = await statusText();
    // Bring the bottom of the last page into view, where the watermark sits.
    await page.evaluate(() => { const c = document.getElementById('signing-viewer_viewerContainer'); if (c) c.scrollTop = c.scrollHeight; });
    await page.waitForTimeout(2000);
    step('7 Download and review', 'Download is a PDF named "Employment Offer Letter - signed.pdf" with 3 pages, no form fields and the watermark image; the unsigned source has no image; review opens read-only with no editable field',
      `file "${download.suggestedFilename()}" ${JSON.stringify(pdfInfo)}; images in the unsigned source: ${sourceImages}; review ${JSON.stringify(review)}; status "${s7}"`,
      download.suggestedFilename() === 'Employment Offer Letter - signed.pdf' && pdfInfo.header === '%PDF-' && pdfInfo.pages === 3 && pdfInfo.formFields === 0 && pdfInfo.images >= 1 && sourceImages === 0
        && review.pages === 3 && review.fields === 0 && s7.includes('read-only'),
      { screenshot: await shot('07-review-page-3-watermark'), downloaded: saved.replace(/\\/g, '/') });

    // 8. Back to the list
    await page.getByRole('link', { name: 'Back to My Documents' }).click();
    await page.waitForSelector('[data-testid="ready-section"]');
    const c8 = await counts();
    step('8 Back to My Documents', '2 ready, 2 completed', `${c8.ready} ready, ${c8.completed} completed`, c8.ready === 2 && c8.completed === 2, { screenshot: await shot('08-documents-after') });

    // 9. Every other listed document opens, with one loading indicator while it loads.
    const expectedPages = { 'confidentiality-agreement': 2, 'handbook-acknowledgment': 1, 'direct-deposit-authorization': 1 };
    const opened = [];
    for (const [id, pages] of Object.entries(expectedPages)) {
      await page.goto(new URL(`./sign/${id}`, base).href, { waitUntil: 'commit' });
      const loading = await page.waitForFunction(() => {
        const area = document.querySelector('.viewer-area[data-viewer-state="loading"]');
        const own = area?.querySelector('.e-pdfviewer');
        if (!area || !own) return document.querySelector('.viewer-area[data-viewer-state="ready"]') ? 'missed' : false;
        return { appIndicator: !!area.querySelector('.app-loading'), viewerHidden: getComputedStyle(own).visibility === 'hidden' };
      }, null, { timeout: 30000, polling: 50 }).then((h) => h.jsonValue());
      await waitViewer();
      await page.waitForTimeout(800);
      const got = await viewer((v) => ({ pages: v.pageCount, fields: v.retrieveFormFields().length }));
      opened.push({ id, expectedPages: pages, ...got, loading });
    }
    await shot('09-direct-deposit-signed-sample').catch(() => null);
    step('9 Every other document opens', 'Confidentiality Agreement 2 pages and 2 fields, Handbook Acknowledgment 1 page and 1 field, Direct Deposit 1 page and no fields; while loading only the app indicator is visible',
      JSON.stringify(opened),
      opened.every((o) => o.pages === o.expectedPages) && opened[0].fields === 2 && opened[1].fields === 1 && opened[2].fields === 0
        && opened.every((o) => o.loading === 'missed' || (o.loading.appIndicator && o.loading.viewerHidden)) && opened.some((o) => o.loading !== 'missed'));

    // Theme: the choice made in this tab survives a refresh, and is the only thing the app stores.
    await page.goto(new URL('./documents', base).href, { waitUntil: 'networkidle' });
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('.app-icon-button').click();
    const toggled = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    step('10 Theme after a refresh', 'Switching the theme and refreshing keeps the switched theme', `system ${before}, switched to ${toggled}, after refresh ${afterReload}`, before === theme && toggled !== before && afterReload === toggled);

    // Storage: the app writes nothing; Syncfusion's base library writes its own usage-telemetry ids.
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookies: document.cookie }));
    const appKeys = [...storage.local, ...storage.session.filter((k) => k !== 'e-signing-portal-theme')].filter((k) => !k.startsWith('telemetry_'));
    step('Storage', 'The only key written by the app is the theme choice in sessionStorage; nothing in localStorage or cookies', JSON.stringify(storage),
      appKeys.length === 0 && storage.cookies === '' && storage.session.includes('e-signing-portal-theme') && !storage.local.includes('e-signing-portal-theme'));

    const banner = await page.locator('.sf-license-validation-banner, [class*="license"]').count();
    step('Trial banner', 'No Syncfusion trial banner (a license key is registered)', `${banner} banner element(s)`, banner === 0);
    step('Console', 'No console error or uncaught exception during the journey', consoleErrors.length ? consoleErrors.join(' | ').slice(0, 600) : 'none', consoleErrors.length === 0);
  } catch (error) {
    step('Journey aborted', 'Every step runs', String(error?.message ?? error).split('\n')[0], false, { screenshot: await shot('error').catch(() => null), consoleErrors });
  }
  report.runs.push({ theme, viewport: '1440x900', steps, passed: steps.every((s) => s.result === 'passed') });
  await context.close();
}

await browser.close();
report.passed = report.runs.every((r) => r.passed);
report.finishedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
