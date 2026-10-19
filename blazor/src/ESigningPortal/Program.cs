using System.Globalization;
using ESigningPortal;
using ESigningPortal.Domain;
using ESigningPortal.State;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Syncfusion.Blazor;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// License: the key comes from SyncfusionLicenseKey in the untracked wwwroot/appsettings.Development.json (copy
// appsettings.Development.example.json). A WebAssembly app's files are downloadable, so anyone who opens a deployed
// copy can read the key: see the README before deploying.
var licenseKey = builder.Configuration["SyncfusionLicenseKey"];
if (!string.IsNullOrWhiteSpace(licenseKey)) Syncfusion.Licensing.SyncfusionLicenseProvider.RegisterLicense(licenseKey);

// en-US formats everywhere, as the reference's Intl en-US; dates stay in the viewer's local time zone.
var culture = new CultureInfo("en-US");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
// The PDF Viewer keeps rendered pages in a memory cache (getting-started.md, Blazor WebAssembly).
builder.Services.AddMemoryCache();
builder.Services.AddSyncfusionBlazor();

// Composition root: the clock and the tab's signing session (memory only; a reload returns to the baseline).
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<SigningStore>();
builder.Services.AddScoped<ThemeService>();
builder.Services.AddScoped<Notifications>();
builder.Services.AddScoped<PdfFinalizer>();

var host = builder.Build();
// The catalogue is read and validated once, before the first page renders.
await host.Services.GetRequiredService<SigningStore>().LoadAsync();
await host.RunAsync();
