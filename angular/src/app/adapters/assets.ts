// URLs of files under public/. The port is source-only and runs from its own root, so there is no base path
// (factory/standards/platform-migration.md); the React reference resolved /e-signing-portal/react here.
export const assetUrl = (path: string): string => '/' + path.replace(/^\//, '');

/** Absolute form of assetUrl: the PDF Viewer's engine worker needs a full URL for resourceUrl. */
export const absoluteAssetUrl = (path: string): string => window.location.origin + assetUrl(path);
