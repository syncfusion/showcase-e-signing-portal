// en-US display formatting (the reference's ui/format.ts); dates are the visitor's local calendar dates. The signing
// time with its time-zone name comes from the browser's Intl formatter (esignApp.formatDateTime), as in the reference.
using System.Globalization;

namespace ESigningPortal.Shared;

public static class Format
{
    private static readonly CultureInfo EnUs = CultureInfo.GetCultureInfo("en-US");

    public static string Date(DateTime d) => d.ToString("MMM d, yyyy", EnUs);

    public static string Pages(int n) => $"{n} {(n == 1 ? "page" : "pages")}";

    public static string Initials(string name) =>
        string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(p => p[0])).ToUpperInvariant();
}
