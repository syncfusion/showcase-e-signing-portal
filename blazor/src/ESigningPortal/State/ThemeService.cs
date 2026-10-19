// Mirrors the reference ui/theme.tsx: exactly light and dark, kept for this tab's session only (sessionStorage), so
// a refresh keeps it and a new session starts from the system setting. wwwroot/js/app.js swaps the Syncfusion
// stylesheet, because Blazor ships the light and dark themes as separate files.
using Microsoft.JSInterop;

namespace ESigningPortal.State;

public enum AppTheme { Light, Dark }

public sealed class ThemeService(IJSRuntime js)
{
    public AppTheme Theme { get; private set; } = AppTheme.Light;
    public event Action? Changed;

    /// <summary>Reads the theme the inline script in index.html applied before first paint.</summary>
    public void Initialize()
    {
        // Synchronous (WebAssembly in-process interop), so the first render already uses the right theme.
        Theme = ((IJSInProcessRuntime)js).Invoke<string>("esignApp.currentTheme") == "dark" ? AppTheme.Dark : AppTheme.Light;
    }

    public async Task ToggleAsync()
    {
        Theme = Theme == AppTheme.Dark ? AppTheme.Light : AppTheme.Dark;
        Changed?.Invoke();
        await js.InvokeVoidAsync("esignApp.applyTheme", Theme == AppTheme.Dark ? "dark" : "light");
    }
}
