// PDF Viewer DOM touches the Blazor viewer has no API for (reference DocumentViewer.tsx and SignPage.tsx): centring a
// field in view, placing the Next flag beside the page, and the signature dialog's defaults. Each one is a small,
// guarded DOM step; when the viewer's markup changes it simply does nothing.
window.esignViewer = (() => {
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Brings a form field to the middle of the view once its page has drawn. */
  function centreField(viewerId, fieldId) {
    let tries = 0;
    const centre = () => {
      const el = document.getElementById(`${fieldId}_content_html_element`) || document.getElementById(fieldId);
      if (el && document.getElementById(viewerId)?.contains(el)) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
        return;
      }
      if (++tries < 20) setTimeout(centre, 150);
    };
    setTimeout(centre, 350);
  }

  // The Next button sits just outside the PDF page's left edge. The viewer centres the page and moves it when the
  // window or the zoom changes, and it reports neither, so the page's position is read on a short interval.
  function placeNextFlag(wrapSelector) {
    const place = () => {
      const wrap = document.querySelector(wrapSelector);
      const flag = wrap?.querySelector('.next-flag');
      const page = wrap?.querySelector('.e-pv-page-div');
      if (!wrap || !flag || !page) return;
      const gap = 4;
      // Room is judged against the full button, measured once while its label is showing.
      if (flag.dataset.beside !== 'viewer') flag.dataset.fullWidth = String(flag.offsetWidth);
      const room = page.getBoundingClientRect().left - wrap.getBoundingClientRect().left - Number(flag.dataset.fullWidth ?? flag.offsetWidth) - gap;
      // No room beside the page: stay at the viewer's own edge, as an arrow only. The label remains its accessible name.
      flag.dataset.beside = room >= 0 ? 'page' : 'viewer';
      flag.style.left = `${Math.max(0, Math.round(room))}px`;
    };
    place();
    const timer = setInterval(place, 250);
    window.addEventListener('resize', place);
    return esignApp.register(() => { clearInterval(timer); window.removeEventListener('resize', place); });
  }

  // ---- Signature dialog ----

  const TABS = ['Draw', 'Type', 'Image'];
  const openDialog = (viewerId) => document.getElementById(viewerId)?.querySelector('.e-dialog.e-popup-open .e-pv-signature-apperance')?.closest('.e-dialog');
  const visible = (el) => !!el && el.offsetParent !== null;
  const activeTab = (dialog) => TABS.find((t) => dialog.querySelector(`.e-tab-header .e-toolbar-item.${t}.e-active`)) ?? 'Draw';

  /**
   * While a signing view is open: "Save signature" starts checked on each tab of the dialog, the Type tab's name box
   * starts with the signed-in person's name, typing in it reaches the dialog (see ViewerInternals.cs), and a dialog
   * that has a typed or uploaded signature saved opens on that tab. Returns an id for detach.
   */
  function attach(viewerId, typedName, dotnet) {
    let openedFor = null;
    let touched = new WeakSet();
    const lastCheck = new WeakMap();
    let namedFor = null;
    let fontFor = null;
    let savedKind = null;

    const typed = (box) => dotnet.invokeMethodAsync('TypedTextChanged', box.value).catch(() => {});

    let tabIndex = 0;
    let busy = false;
    const tick = () => {
      if (busy) return;
      const dialog = openDialog(viewerId);
      if (!dialog) { openedFor = null; touched = new WeakSet(); namedFor = null; fontFor = null; tabIndex = 0; return; }
      // A move to another tab is reported to the dialog first (see ViewerInternals.SelectTab); the other defaults
      // follow on the next tick, once it has redrawn that tab.
      const index = TABS.indexOf(activeTab(dialog));
      if (openedFor === dialog && index !== tabIndex) {
        const previous = tabIndex;
        tabIndex = index;
        busy = true;
        dotnet.invokeMethodAsync('SignatureTabChanged', previous, index).catch(() => {}).finally(() => { busy = false; });
        return;
      }
      // Each box starts checked. The dialog is told first (ViewerInternals.SetSaveBox), because the CheckBox redraws
      // itself from the dialog's flag; then the box is clicked so the viewer's script sees it too. The Upload tab clears
      // its box again as it draws, so a box is re-checked until the person changes it themselves.
      for (const [tab, suffix] of ['', '1', '2'].entries()) {
        const box = document.getElementById(`${viewerId}_signatureCheckBox${suffix}`);
        if (!visible(box?.closest('.e-checkbox-wrapper')) || box.checked || touched.has(box)) continue;
        if (Date.now() - (lastCheck.get(box) ?? 0) < 1500) continue;
        lastCheck.set(box, Date.now());
        busy = true;
        dotnet.invokeMethodAsync('SaveBoxChanged', tab, true).catch(() => {}).finally(() => {
          busy = false;
          if (!box.checked) box.closest('label')?.click();
        });
        return;
      }
      const name = document.getElementById(`${viewerId}_e-pv-Signtext-box`);
      // The box's floating label only rises for text the TextBox itself set, so it would sit over the name.
      const label = visible(name) && document.getElementById(`label_${name.id}`);
      if (label) { label.classList.toggle('e-label-top', !!name.value); label.classList.toggle('e-label-bottom', !name.value); }
      if (visible(name) && namedFor !== name) {
        namedFor = name;
        if (!name.value && typedName) {
          name.value = typedName;
          name.dispatchEvent(new Event('input', { bubbles: true }));
          typed(name);
        }
      }
      // A saved typed signature comes back in the font it was made with, not the first one.
      const font = savedKind === 'Type' && signatureModule(viewerId)?.fontName;
      const previews = font && fontFor !== dialog ? [...dialog.querySelectorAll('.e-pv-font-sign')].filter(visible) : [];
      const match = previews.find((p) => getComputedStyle(p).fontFamily.replace(/["']/g, '') === font);
      if (match) {
        fontFor = dialog;
        previews.forEach((p) => p.classList.toggle('e-pv-selected-signature-font', p === match));
      }
      if (openedFor === dialog) return;
      openedFor = dialog;
      tabIndex = index;
      if (savedKind && savedKind !== 'Draw' && activeTab(dialog) !== savedKind) dialog.querySelector(`.e-tab-header .e-toolbar-item.${savedKind}`)?.click();
    };
    const timer = setInterval(tick, 200);

    const onInput = (event) => { if (event.isTrusted && event.target?.id === `${viewerId}_e-pv-Signtext-box`) typed(event.target); };
    // "Save signature" checked or cleared on a tab, by the person or by the default above.
    const onChange = (event) => {
      const match = /_signatureCheckBox(\d?)$/.exec(event.target?.id ?? '');
      if (!match || !event.target.id.startsWith(viewerId)) return;
      if (event.isTrusted) touched.add(event.target);
      dotnet.invokeMethodAsync('SaveBoxChanged', Number(match[1] || 0), event.target.checked).catch(() => {});
    };
    // Which tab the signature was made on, read as the person presses Create (the dialog is gone by the time the
    // viewer reports the signature).
    const onClick = (event) => {
      const create = event.target?.closest?.('.e-pv-createbtn');
      const dialog = create && openDialog(viewerId);
      if (dialog?.contains(create)) {
        const kind = activeTab(dialog);
        const suffix = ['', '1', '2'][TABS.indexOf(kind)];
        const keep = !!document.getElementById(`${viewerId}_signatureCheckBox${suffix}`)?.checked;
        const text = kind === 'Type' ? document.getElementById(`${viewerId}_e-pv-Signtext-box`)?.value ?? null : null;
        dotnet.invokeMethodAsync('SignatureCreating', kind, keep, text).catch(() => {});
      }
      // After one signature is added, the next signature field's first click records the field but leaves the dialog
      // closed (34.2.8), and the person has to click again. When that happens the click is repeated once for them.
      const field = event.isTrusted && event.target?.closest?.('.e-pdfviewer-signatureformfields');
      if (field && document.getElementById(viewerId)?.contains(field)) {
        setTimeout(() => { if (field.isConnected && !openDialog(viewerId)) pressField(field); }, 600);
      }
      // A tab change is reported at once, before anything can redraw the dialog on its old tab.
      if (event.target?.closest?.('.e-tab-header') && openDialog(viewerId)?.contains(event.target)) setTimeout(tick, 0);
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('click', onClick, true);
    const id = esignApp.register(() => {
      clearInterval(timer);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('click', onClick, true);
    });
    kinds.set(id, (kind) => { savedKind = kind; });
    return id;
  }
  /** The pointer sequence the viewer handles as a click on a signature field. */
  function pressField(field) {
    const r = field.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, view: window };
    field.dispatchEvent(new PointerEvent('pointerdown', { ...at, buttons: 1 }));
    field.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
    field.dispatchEvent(new PointerEvent('pointerup', at));
    field.dispatchEvent(new MouseEvent('mouseup', at));
    field.dispatchEvent(new MouseEvent('click', at));
  }

  const kinds = new Map();
  function setSavedKind(id, kind) { kinds.get(id)?.(kind); }
  function detach(id) { kinds.delete(id); esignApp.unwatch(id); }

  // The saved signature itself (drawn path, typed text, uploaded image and their flags) lives on the viewer's script
  // module, which every new viewer starts empty. These members hold it in 34.2.8; they are not public API.
  const SAVED_MEMBERS = [
    'isSaveSignature', 'isSignatureFieldsSaveSignature', 'saveSignatureString', 'saveImageString', 'signatureImageString',
    'isSaveTypeSignature', 'saveSignatureTypeString', 'textValue', 'fontName', 'isSaveUploadSignature', 'saveSignatureUploadString',
  ];
  const signatureModule = (viewerId) => window.sfBlazor?.getCompInstance?.(viewerId)?.viewerBase?.signatureModule;
  function captureSignature(viewerId) {
    const m = signatureModule(viewerId);
    if (!m) return null;
    const out = {};
    for (const k of SAVED_MEMBERS) if (k in m) out[k] = m[k];
    return JSON.stringify(out);
  }
  function restoreSignature(viewerId, json) {
    const m = signatureModule(viewerId);
    if (!m || !json) return;
    const saved = JSON.parse(json);
    for (const k of SAVED_MEMBERS) if (k in saved) m[k] = saved[k];
  }

  return { centreField, placeNextFlag, attach, setSavedKind, detach, captureSignature, restoreSignature };
})();
