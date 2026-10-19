// Pure signing rules and selectors (contracts/data-contract.md, "Queries and commands"), ported from the
// reference's domain/rules.ts with the same test vectors (tests/ESigningPortal.Tests/RulesTests.cs).
using System.Text.RegularExpressions;

namespace ESigningPortal.Domain;

/// <summary>Current field values by field name; empty or missing means not filled.</summary>
public static partial class Rules
{
    public const int DueSoonDays = 2;

    public static DateTime AddDays(DateTime today, int days) => today.Date.AddDays(days);

    public sealed record ResolvedDates(DateTime Received, DateTime? Due, DateTime? BaselineSigned);

    /// <summary>The catalogue stores day offsets; dates are worked out from today so the list never looks stale.</summary>
    public static ResolvedDates ResolveDates(SigningDocument doc, DateTime today) => new(
        AddDays(today, -doc.ReceivedDaysAgo),
        doc.DueInDays is int due ? AddDays(today, due) : null,
        doc.SignedDaysAgo is int signed ? AddDays(today, -signed) : null);

    public static DocumentStatus StatusOf(SigningDocument doc, IReadOnlyDictionary<string, SessionEntry> session) =>
        doc.BaselineStatus == DocumentStatus.Completed || session.ContainsKey(doc.Id) ? DocumentStatus.Completed : DocumentStatus.Ready;

    public static Badge BadgeOf(SigningDocument doc, IReadOnlyDictionary<string, SessionEntry> session)
    {
        if (StatusOf(doc, session) == DocumentStatus.Completed) return Badge.Completed;
        return doc.DueInDays is int due && due <= DueSoonDays ? Badge.DueSoon : Badge.Ready;
    }

    /// <summary>When a completed document was signed: this session's time, else the baseline's.</summary>
    public static DateTime? SignedAt(SigningDocument doc, IReadOnlyDictionary<string, SessionEntry> session, DateTime today) =>
        session.TryGetValue(doc.Id, out var entry) ? entry.SignedAt.LocalDateTime : ResolveDates(doc, today).BaselineSigned;

    public static (IReadOnlyList<SigningDocument> Ready, IReadOnlyList<SigningDocument> Completed) GroupByStatus(
        IEnumerable<SigningDocument> documents, IReadOnlyDictionary<string, SessionEntry> session, DateTime today)
    {
        var list = documents.ToList();
        var ready = list.Where(d => StatusOf(d, session) == DocumentStatus.Ready)
            .OrderBy(d => d.DueInDays ?? int.MaxValue)
            .ThenBy(d => d.Title, StringComparer.Create(System.Globalization.CultureInfo.GetCultureInfo("en-US"), false))
            .ToList();
        var completed = list.Where(d => StatusOf(d, session) == DocumentStatus.Completed)
            .OrderByDescending(d => SignedAt(d, session, today) ?? DateTime.MinValue)
            .ToList();
        return (ready, completed);
    }

    public static bool HasValue(IReadOnlyDictionary<string, string> values, string name) =>
        values.TryGetValue(name, out var v) && !string.IsNullOrWhiteSpace(v);

    /// <summary>Page order, then top to bottom, then left to right.</summary>
    public static IReadOnlyList<FieldDefinition> InReadingOrder(IEnumerable<FieldDefinition> fields) =>
        fields.OrderBy(f => f.Page).ThenBy(f => f.Bounds.Y).ThenBy(f => f.Bounds.X).ToList();

    public static int RemainingRequired(IEnumerable<FieldDefinition> fields, IReadOnlyDictionary<string, string> values) =>
        fields.Count(f => f.Required && !HasValue(values, f.Name));

    public static bool CanFinish(IEnumerable<FieldDefinition> fields, IReadOnlyDictionary<string, string> values) =>
        RemainingRequired(fields, values) == 0;

    /// <summary>The next required field with no value, after <paramref name="afterName"/> in reading order and wrapping; null when none.</summary>
    public static FieldDefinition? NextUnsignedField(IEnumerable<FieldDefinition> fields, IReadOnlyDictionary<string, string> values, string? afterName = null) =>
        NextWhere(fields, afterName, f => f.Required && !HasValue(values, f.Name));

    /// <summary>The next field with no value, required or optional, after <paramref name="afterName"/> in reading order
    /// and wrapping; null when none. This is what the Next button over the document visits.</summary>
    public static FieldDefinition? NextOpenField(IEnumerable<FieldDefinition> fields, IReadOnlyDictionary<string, string> values, string? afterName = null) =>
        NextWhere(fields, afterName, f => !HasValue(values, f.Name));

    private static FieldDefinition? NextWhere(IEnumerable<FieldDefinition> fields, string? afterName, Func<FieldDefinition, bool> open)
    {
        var ordered = InReadingOrder(fields);
        if (ordered.Count == 0) return null;
        // As the reference: an unknown name starts from the beginning (findIndex -1 + 1).
        var start = afterName is null ? 0 : IndexOf(ordered, afterName) + 1;
        for (var i = 0; i < ordered.Count; i++)
        {
            var field = ordered[(start + i) % ordered.Count];
            if (open(field)) return field;
        }
        return null;
    }

    private static int IndexOf(IReadOnlyList<FieldDefinition> ordered, string name)
    {
        for (var i = 0; i < ordered.Count; i++) if (ordered[i].Name == name) return i;
        return -1;
    }

    public static string SignedFileName(string title)
    {
        var cleaned = UnsafeFileChars().Replace(title, " ").Trim();
        return $"{(cleaned.Length == 0 ? "document" : cleaned)} - signed.pdf";
    }

    public static string StillRequiredMessage(int count) =>
        count == 1 ? "1 signature is still required" : $"{count} signatures are still required";

    [GeneratedRegex(@"[\/:*?""<>|]+")]
    private static partial Regex UnsafeFileChars();
}
