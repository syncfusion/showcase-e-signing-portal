namespace ESigningPortal.State;

/// <summary>The signature the person chose to save in the signature dialog, kept for the rest of the tab's signing
/// session (reference app/savedSignature.ts). Like the signing session it lives only in memory: a reload, a new tab or
/// Reset demo forgets it, so the person draws, types or uploads it once more.</summary>
/// <remarks>The viewer keeps a saved signature on its own script module and dialog, and every document opens a new
/// viewer that starts with both empty; Pages/Sign/DocumentViewer.razor hands this one to each new viewer.</remarks>
public sealed class SavedSignature
{
    /// <summary>Draw, Type or Image: the dialog tab the signature was made on, so the dialog opens there.</summary>
    public string? Kind { get; private set; }
    /// <summary>The typed name, for a Type signature.</summary>
    public string? TypedText { get; private set; }
    /// <summary>The viewer script module's saved-signature members, as JSON (wwwroot/js/viewer.js).</summary>
    internal string? ModuleState { get; private set; }

    public bool HasValue => Kind is not null && ModuleState is not null;

    internal void Remember(string kind, string? typedText, string moduleState)
    {
        Kind = kind;
        TypedText = typedText;
        ModuleState = moduleState;
    }

    public void Forget()
    {
        Kind = null;
        TypedText = null;
        ModuleState = null;
    }
}
