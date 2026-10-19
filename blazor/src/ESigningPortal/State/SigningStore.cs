// The tab's signing session (reference app/SigningStore.tsx): the validated catalogue plus an in-memory record of
// the documents signed here. Nothing is written to browser storage; a reload or Reset returns to the baseline and
// forgets a saved signature (app-plan.md, "Profiles").
using System.Net.Http;
using ESigningPortal.Domain;

namespace ESigningPortal.State;

public sealed class SigningStore(HttpClient http, IClock clock)
{
    private readonly Dictionary<string, SessionEntry> session = [];

    public CatalogueResult Load { get; private set; } = new(null, ["The catalogue has not loaded."]);
    public Catalogue? Catalogue => Load.Catalogue;
    public IReadOnlyDictionary<string, SessionEntry> Session => session;
    /// <summary>Fixed for the tab, as the reference's useState(() => clock.now()).</summary>
    public DateTime Today { get; } = clock.Now.LocalDateTime;
    public int SignedCount => session.Count;

    /// <summary>The signature saved in the signature dialog, offered again on later fields and documents.</summary>
    public SavedSignature SavedSignature { get; } = new();

    public event Action? Changed;

    public async Task LoadAsync()
    {
        try { Load = CatalogueParser.Parse(await http.GetStringAsync("data/documents.json")); }
        catch (HttpRequestException e) { Load = new(null, [$"The catalogue could not be read: {e.Message}"]); }
    }

    /// <summary>Records a finished document; the bytes are the flattened, watermarked signed PDF.</summary>
    public void CompleteDocument(SigningDocument doc, byte[] signedPdf)
    {
        if (Rules.StatusOf(doc, session) == DocumentStatus.Completed) return;
        session[doc.Id] = new SessionEntry(clock.Now, signedPdf, Rules.SignedFileName(doc.Title));
        Changed?.Invoke();
    }

    public void Reset()
    {
        session.Clear();
        SavedSignature.Forget();
        Changed?.Invoke();
    }
}
