# E-Signing Portal (Blazor)

A Blazor WebAssembly port of the React E-Signing Portal showcase. One signed-in sample person, Peter Hale, sees the documents waiting for his signature, reviews one in the Syncfusion PDF Viewer, signs it (draw, type or upload in the viewer's signature dialog), passes the required-field check and lands on a confirmation screen where the signed, read-only PDF can be reviewed or downloaded. It runs entirely in the browser on JSON data: there is no server, database or sign-in.

Three screens, as in the React app:

- **My Documents** (`/documents`): ready-to-sign documents first, ordered by due date, then completed ones.
- **Sign Document** (`/sign/{id}`): the PDF Viewer with the document's fields, a **Next** flag that walks through each field, the list of fields (a side panel, or a dialog below 1024px) and **Finish Signing**. A completed document opens here read-only.
- **Signing Complete** (`/complete/{id}`): Review Documents, Download Documents, Back to My Documents.

`/healthz` is a plain status page outside the shell.

## Requirements

- .NET SDK 10 (`dotnet --version` shows 10.0.100 or later; `global.json` allows newer feature bands).
- The .NET WebAssembly build tools: `dotnet workload install wasm-tools`. The PDF Viewer renders pages with SkiaSharp, which is linked into the WebAssembly runtime at build time.
- A Syncfusion license key for version 34.x. Without one the app runs with a trial notice.

## Set up the license key

Copy the example file and put your key in it:

```sh
cp src/ESigningPortal/wwwroot/appsettings.Development.example.json src/ESigningPortal/wwwroot/appsettings.Development.json
```

```json
{ "SyncfusionLicenseKey": "your-syncfusion-license-key" }
```

`appsettings.Development.json` is ignored by git, and `Program.cs` registers the key at startup. It is read only in the Development environment, which is what `dotnet run` uses. A WebAssembly app's files are downloaded by the browser, so anyone who opens a deployed copy could read a key placed in its settings.

## Run

```sh
cd frontend/blazor
dotnet run --project src/ESigningPortal
```

Open http://localhost:5180. The first build takes a few minutes (the WebAssembly runtime is relinked with SkiaSharp); the first load downloads the .NET runtime and later loads come from the browser cache.

## Test

```sh
dotnet test
```

`tests/ESigningPortal.Tests` runs the React app's expected-value vectors (V1 to V11 and the invalid-catalogue cases from `contracts/data-contract.md`) against the C# rules and the shipped `documents.json`.

## Data and documents

- `wwwroot/data/documents.json`: the profile and the four documents, with each field's page and position in PDF points. Dates are day offsets from today, so the list never looks stale.
- `wwwroot/documents/*.pdf`: the four sample PDFs.
- `wwwroot/branding/syncfusion-watermark.jpg`: the watermark stamped on the signed copy.

These are byte-for-byte copies of the React app's files.

## Where changes are kept

Signing stays in the browser tab, in memory. A reload, a new tab or **Reset demo** returns every document to its original state and forgets the saved signature. Only the light/dark choice is kept, in `sessionStorage`, so a refresh keeps it and a new session starts from the system setting.

## How signing works

- The fields come from `documents.json` and are added to the PDF when it opens (`Pages/Sign/DocumentViewer.razor`).
- "Save signature" starts checked on the Draw, Type and Upload tabs. A saved signature is offered again on the next field and on the next document in the same tab, on the tab it was made with.
- The Type tab starts with Peter's name and offers four open-licence handwriting fonts (Dancing Script, Sacramento, Pacifico, Caveat, SIL OFL 1.1, `wwwroot/fonts`). They are also handed to the viewer so a typed signature keeps its font in the signed PDF.
- **Finish Signing** checks the required fields, then the viewer saves the document, and `State/PdfFinalizer.cs` stamps the watermark on every page and flattens fields and signatures with Syncfusion PDF, so the signed copy is read-only.

## Known differences from the React app

The Blazor PDF Viewer (`Syncfusion.Blazor.SfPdfViewer` 34.2.8) is a different control from the JavaScript one, and its signature dialog does not receive its own tab, check box and name-box events in this version. `Pages/Sign/ViewerInternals.cs` and `wwwroot/js/viewer.js` hand those changes to the dialog through its internal members, and carry the saved signature to each new document. Those members are not public API: after a Syncfusion upgrade, check the Type tab, "Save signature" and the saved signature on a second document. Other notes:

- The viewer's `EnableDownload` must stay on: with it off, `GetDocumentAsync` returns no document. The viewer toolbar shows only page navigation and zoom, so its own Download button is not offered.
- After one signature, a click on the next signature field would leave the dialog closed; `viewer.js` repeats the click once.
- At phone width the viewer's zoom box sits a few pixels past the toolbar's right edge.
- The React app's `pagevisit.js` page-visit script and its hosting files (`server.mjs`, `web.config`) are not part of this port, which is source only.

## Project layout

| Folder | Contents |
| --- | --- |
| `src/ESigningPortal/Domain` | Types, the signing rules and the catalogue validator, ported from `src/domain` |
| `src/ESigningPortal/State` | The tab's signing session, saved signature, theme, notifications and the signed-copy finalizer |
| `src/ESigningPortal/Layout`, `Shared` | The shell (AppBar, Reset demo, theme, profile) and shared components |
| `src/ESigningPortal/Pages` | My Documents, Sign Document (with the viewer), Signing Complete and `/healthz` |
| `src/ESigningPortal/wwwroot` | Page host, styles and design tokens, scripts, data, documents, fonts and branding |
| `tests/ESigningPortal.Tests` | xUnit tests for the rules and the catalogue |

## Syncfusion components

PDF Viewer (`SfPdfViewer2`, with its signature dialog), AppBar, Button, Dialog, Toast and Card styling, from the `Syncfusion.Blazor.*` 34.2.8 packages with the Tailwind 3 light and dark themes, and Syncfusion PDF (`Syncfusion.Pdf.Net.Core`, brought in by the viewer) for the watermark and flattening.
