// The PDF Viewer's signature dialog (Syncfusion.Blazor.SfPdfViewer.Internal.SignatureDialog, held by
// PdfViewerBase.SignatureDialog) listens for its Tab's Selecting event, its CheckBoxes' ValueChange and its name box's
// input. In Syncfusion.Blazor.SfPdfViewer 34.2.8 none of these notices reaches it, so on its own the dialog keeps
// treating Draw as the current tab, never learns that "Save signature" was checked, and never shows the Type tab's font
// previews. wwwroot/js/viewer.js watches the dialog and hands each change to the dialog's own handler or flag here.
//
// These members are internal, not public API: a later version may rename them. Each step then does nothing, and the
// dialog behaves as it does on its own.
using System.Reflection;
using Microsoft.AspNetCore.Components;
using SelectingEventArgs = Syncfusion.Blazor.Navigations.SelectingEventArgs;
using Syncfusion.Blazor.SfPdfViewer;

namespace ESigningPortal.Pages.Sign;

internal static class ViewerInternals
{
    private const BindingFlags Any = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    /// <summary>The dialog's "Save signature" flag for each tab, in tab order (Draw, Type, Upload).</summary>
    private static readonly string[] SaveFlags = ["IsChecked", "IsSignatureTypeBoxChecked", "IsSignatureUploadBoxChecked"];

    private static object? Dialog(SfPdfViewer2? viewer) =>
        viewer is null ? null : typeof(PdfViewerBase).GetProperty("SignatureDialog", Any)?.GetValue(viewer);

    /// <summary>The person moved to another tab: the dialog's own handler records it and draws that tab.</summary>
    public static void SelectTab(SfPdfViewer2? viewer, int previousIndex, int index) =>
        Invoke(viewer, "HandleSelectEvent", new SelectingEventArgs { PreviousIndex = previousIndex, SelectingIndex = index, SelectedIndex = index, IsInteracted = true });

    /// <summary>The tab the signature is made on, set again as Create is pressed in case the tab notice came late.</summary>
    public static void SetSignatureType(SfPdfViewer2? viewer, string kind)
    {
        if (Dialog(viewer) is { } dialog) Write(dialog, "SignatureType", kind);
    }

    /// <summary>"Save signature" was checked or cleared on one tab (0 Draw, 1 Type, 2 Upload).</summary>
    public static void SetSaveBox(SfPdfViewer2? viewer, int tab, bool isChecked)
    {
        if (Dialog(viewer) is { } dialog && tab >= 0 && tab < SaveFlags.Length) Write(dialog, SaveFlags[tab], isChecked);
    }

    /// <summary>The name in the Type tab changed: the dialog's own handler shows the font previews and enables Create.</summary>
    public static void UpdateTypedText(SfPdfViewer2? viewer, string text) => Invoke(viewer, "UpdateSignatureText", new ChangeEventArgs { Value = text });

    /// <summary>A signature saved on an earlier document: the dialog offers it again on the tab it was made on.</summary>
    public static void RestoreSaved(SfPdfViewer2? viewer, string kind, string? typedText)
    {
        if (Dialog(viewer) is not { } dialog) return;
        switch (kind)
        {
            case "Type":
                Write(dialog, "IsSignatureTypeBoxChecked", true);
                Write(dialog, "SignatureFont", typedText ?? "");
                Write(dialog, "SignatureTextValue", typedText ?? "");
                Write(dialog, "isSaveTextSignature", true);
                break;
            case "Image":
                Write(dialog, "IsSignatureUploadBoxChecked", true);
                break;
            default:
                Write(dialog, "IsChecked", true);
                Write(dialog, "IsDrawSignatureAdded", true);
                break;
        }
    }

    private static void Invoke(SfPdfViewer2? viewer, string method, object argument)
    {
        var dialog = Dialog(viewer);
        var handler = dialog?.GetType().GetMethod(method, Any, [argument.GetType()]);
        if (dialog is null || handler is null) return;
        try
        {
            // The dialog re-renders only while its "canvas refreshed" flag is set, which it clears once a tab has drawn.
            Write(dialog, "isSignatureCanvasRefreshed", true);
            handler.Invoke(dialog, [argument]);
            typeof(ComponentBase).GetMethod("StateHasChanged", Any)?.Invoke(dialog, null);
        }
        catch (TargetInvocationException e) { Console.WriteLine($"Signature dialog not updated ({method}): {e.InnerException?.Message}"); }
    }

    private static void Write(object target, string name, object? value)
    {
        var type = target.GetType();
        if (type.GetProperty(name, Any) is { CanWrite: true } p) p.SetValue(target, value);
        else type.GetField(name, Any)?.SetValue(target, value);
    }
}
