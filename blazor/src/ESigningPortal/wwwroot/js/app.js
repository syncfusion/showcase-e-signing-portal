// Browser helpers the Blazor components call through JS interop: theme stylesheet swap, media queries, downloads,
// focus and the PDF Viewer DOM touches the viewer has no API for. Business logic stays in C#.
window.esignApp = (() => {
  const THEME_KEY = 'e-signing-portal-theme';
  // Syncfusion's Blazor theme ships light and dark as two files, so the link's href is swapped; the app tokens
  // follow data-theme on <html>. The new sheet loads before the old one is dropped (no flash).
  const THEME_HREF = { light: '_content/Syncfusion.Blazor.Themes/tailwind3.css', dark: '_content/Syncfusion.Blazor.Themes/tailwind3-dark.css' };
  function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('e-dark-mode', theme === 'dark');
    try { sessionStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable: the choice lasts until a refresh */ }
    const old = document.getElementById('sf-theme');
    const href = THEME_HREF[theme];
    if (!old || old.getAttribute('href') === href) return Promise.resolve();
    return new Promise((resolve) => {
      const next = old.cloneNode();
      next.removeAttribute('id');
      next.setAttribute('href', href);
      const done = () => { old.remove(); next.id = 'sf-theme'; resolve(); };
      next.addEventListener('load', done, { once: true });
      next.addEventListener('error', done, { once: true });
      old.after(next);
    });
  }
  /** Resolves once the Syncfusion theme stylesheet has loaded (the shell has no layout before that). */
  function themeReady() {
    const link = document.getElementById('sf-theme');
    if (!link || link.sheet) return Promise.resolve();
    return new Promise((resolve) => { link.addEventListener('load', resolve, { once: true }); link.addEventListener('error', resolve, { once: true }); });
  }
  /** Removes the startup screen after the next paint, so what it covered has laid out first. */
  function removeBoot() {
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('app-boot')?.remove()));
  }

  // Media queries: the component is told now and on every change.
  const watchers = new Map();
  let nextWatch = 1;
  function watchMedia(query, dotnet, method) {
    const media = window.matchMedia(query);
    let last = media.matches;
    const notify = () => { if (media.matches === last) return; last = media.matches; dotnet.invokeMethodAsync(method, media.matches); };
    media.addEventListener('change', notify);
    window.addEventListener('resize', notify);
    const id = nextWatch++;
    watchers.set(id, () => { media.removeEventListener('change', notify); window.removeEventListener('resize', notify); });
    return { id, matches: media.matches };
  }
  function matches(query) { return window.matchMedia(query).matches; }
  function unwatch(id) { watchers.get(id)?.(); watchers.delete(id); }
  /** Keeps a cleanup for later unwatch(id). */
  function register(cleanup) { const id = nextWatch++; watchers.set(id, cleanup); return id; }

  function setTitle(title) { document.title = title; }

  // Downloads. A signed copy is held in .NET memory; the browser gets it as a blob URL that is released after the click.
  function clickDownload(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function downloadStream(fileName, streamRef) {
    const buffer = await streamRef.arrayBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
    clickDownload(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function downloadUrl(url, fileName) { clickDownload(url, fileName); }

  // The reference formats the signing time with Intl en-US and the short time-zone name; the same formatter is used here.
  const DATE_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  function formatDateTime(iso) { return DATE_TIME.format(new Date(iso)); }

  return { formatDateTime, currentTheme, applyTheme, themeReady, removeBoot, watchMedia, matches, unwatch, register, setTitle, downloadStream, downloadUrl };
})();

// Web fonts load on first use; the signature dialog draws typed signatures on a canvas, which needs them loaded already
// (as the reference's main.tsx).
if ('fonts' in document) {
  for (const family of ['Dancing Script', 'Sacramento', 'Pacifico', 'Caveat']) document.fonts.load(`32px "${family}"`).catch(() => undefined);
}
