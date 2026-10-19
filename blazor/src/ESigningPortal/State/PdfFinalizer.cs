// Turns the viewer's saved copy into the final signed PDF (app-plan.md, "Signing pipeline"; reference
// adapters/pdfFinalizer.ts): the watermark is stamped on every page, then form fields and signatures are flattened into
// page content, so the result is read-only everywhere. The watermark is part of the signed copy only; it is never
// shown while signing. Uses Syncfusion.Pdf.Net.Core, which the PDF Viewer package already brings in.
using Syncfusion.Drawing;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Graphics;
using Syncfusion.Pdf.Parsing;

namespace ESigningPortal.State;

public sealed record FinalizedPdf(byte[] Pdf, bool Watermarked);

public sealed class PdfFinalizer(HttpClient http)
{
    // Size, opacity and corner as the reference (SignFlow reference project); the bottom offset clears the page footer.
    public const string WatermarkPath = "branding/syncfusion-watermark.jpg";
    private const float WidthPt = 112, Opacity = 0.16f, RightPt = 24, BottomPt = 60;

    private byte[]? watermark;

    public async Task<FinalizedPdf> FinalizeAsync(byte[] saved)
    {
        var mark = await LoadWatermarkAsync();
        using var input = new MemoryStream(saved);
        using var doc = new PdfLoadedDocument(input);
        var watermarked = false;
        if (mark is not null)
        {
            using var imageStream = new MemoryStream(mark);
            var image = new PdfBitmap(imageStream);
            foreach (PdfPageBase page in doc.Pages) DrawWatermark(page, image);
            watermarked = true;
        }
        if (doc.Form is not null) doc.Form.Flatten = true;
        doc.FlattenAnnotations();
        using var output = new MemoryStream();
        doc.Save(output);
        doc.Close(true);
        return new FinalizedPdf(output.ToArray(), watermarked);
    }

    /// <summary>Stamps the watermark at the bottom right of one page.</summary>
    private static void DrawWatermark(PdfPageBase page, PdfImage image)
    {
        var height = image.Height * (WidthPt / image.Width);
        var size = page.Size;
        var g = page.Graphics;
        var state = g.Save();
        g.SetTransparency(Opacity);
        g.DrawImage(image, new RectangleF(size.Width - WidthPt - RightPt, size.Height - height - BottomPt, WidthPt, height));
        g.Restore(state);
    }

    /// <summary>A failed load is not kept, so the next signing tries again.</summary>
    private async Task<byte[]?> LoadWatermarkAsync()
    {
        if (watermark is not null) return watermark;
        try
        {
            using var response = await http.GetAsync(WatermarkPath);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentType?.MediaType?.StartsWith("image/") != true)
                throw new InvalidOperationException($"Watermark image not available ({(int)response.StatusCode})");
            return watermark = await response.Content.ReadAsByteArrayAsync();
        }
        catch (Exception e)
        {
            Console.WriteLine($"Signed copy produced without its watermark: {e.Message}");
            return null;
        }
    }
}
