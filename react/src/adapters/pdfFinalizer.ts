// Turns the viewer's saved copy into the final signed PDF (app-plan.md, "Signing pipeline"): the watermark is
// stamped on every page, then form fields and signatures are flattened into page content, so the result is
// read-only everywhere. The watermark is part of the signed copy only; it is never shown while signing.
import { PdfBitmap, PdfDocument } from '@syncfusion/ej2-pdf';
import type { PdfPage } from '@syncfusion/ej2-pdf';
import { assetUrl } from './basePath';

// Size, opacity and corner follow the SignFlow reference project; the bottom offset clears the page footer.
export const WATERMARK = { path: 'branding/syncfusion-watermark.jpg', widthPt: 112, opacity: 0.16, rightPt: 24, bottomPt: 60 } as const;

export interface FinalizedPdf { pdf: Blob; watermarked: boolean }
export interface PdfFinalizer { finalize(saved: Blob): Promise<FinalizedPdf> }

let watermarkBytes: Promise<Uint8Array> | null = null;
function loadWatermark(): Promise<Uint8Array> {
  watermarkBytes ??= fetch(assetUrl(WATERMARK.path)).then(async (response) => {
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`Watermark image not available (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  });
  // A failed load is not kept, so the next signing tries again.
  watermarkBytes.catch(() => { watermarkBytes = null; });
  return watermarkBytes;
}

/** Stamps the watermark at the bottom right of one page. */
export function drawWatermark(page: PdfPage, image: PdfBitmap): void {
  const height = image.height * (WATERMARK.widthPt / image.width);
  const g = page.graphics;
  const state = g.save();
  g.setTransparency(WATERMARK.opacity);
  g.drawImage(image, { x: page.size.width - WATERMARK.widthPt - WATERMARK.rightPt, y: page.size.height - height - WATERMARK.bottomPt, width: WATERMARK.widthPt, height });
  g.restore(state);
}

export const signedCopyFinalizer: PdfFinalizer = {
  async finalize(saved) {
    const [bytes, mark] = await Promise.all([
      saved.arrayBuffer().then((b) => new Uint8Array(b)),
      loadWatermark().catch((error) => { console.warn('Signed copy produced without its watermark', error); return null; }),
    ]);
    const doc = new PdfDocument(bytes);
    try {
      let watermarked = false;
      if (mark) {
        const image = new PdfBitmap(mark);
        for (let i = 0; i < doc.pageCount; i++) drawWatermark(doc.getPage(i), image);
        watermarked = true;
      }
      doc.flatten = true;
      const out = doc.save();
      // Copy into a plain ArrayBuffer: save() is typed over ArrayBufferLike, which Blob does not accept.
      const buffer = new ArrayBuffer(out.byteLength);
      new Uint8Array(buffer).set(out);
      return { pdf: new Blob([buffer], { type: 'application/pdf' }), watermarked };
    } finally {
      doc.destroy();
    }
  },
};
