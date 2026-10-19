using Microsoft.JSInterop;

namespace ESigningPortal.Shared;

/// <summary>Saves a signed copy held in .NET memory under the given name (reference adapters/download.ts).</summary>
public static class Downloads
{
    public static async Task SaveAsync(IJSRuntime js, byte[] pdf, string fileName)
    {
        using var stream = new MemoryStream(pdf, writable: false);
        using var streamRef = new DotNetStreamReference(stream);
        await js.InvokeVoidAsync("esignApp.downloadStream", fileName, streamRef);
    }
}
