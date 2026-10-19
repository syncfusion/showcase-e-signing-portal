// Lucide 1.47.0 icons (the reference's lucide-react version) as inline SVG: the same 24x24 stroke paths,
// aria-hidden when decorative. Only the icons the app uses are listed.
namespace ESigningPortal.Shared;

public static class LucideIcons
{
    public static readonly IReadOnlyDictionary<string, string> Paths = new Dictionary<string, string>
    {
        ["FilePenLine"] = @"<path d=""M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z"" /><path d=""M14.487 7.858A1 1 0 0 1 14 7V2"" /><path d=""M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516"" /><path d=""M8 18h1"" />",
        ["Files"] = @"<path d=""M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"" /><path d=""M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z"" /><path d=""M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1"" />",
        ["Moon"] = @"<path d=""M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"" />",
        ["RotateCcw"] = @"<path d=""M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"" /><path d=""M3 3v5h5"" />",
        ["Sun"] = @"<circle cx=""12"" cy=""12"" r=""4"" /><path d=""M12 2v2"" /><path d=""M12 20v2"" /><path d=""m4.93 4.93 1.41 1.41"" /><path d=""m17.66 17.66 1.41 1.41"" /><path d=""M2 12h2"" /><path d=""M20 12h2"" /><path d=""m6.34 17.66-1.41 1.41"" /><path d=""m19.07 4.93-1.41 1.41"" />",
        ["AlertTriangle"] = @"<path d=""m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"" /><path d=""M12 9v4"" /><path d=""M12 17h.01"" />",
        ["Inbox"] = @"<polyline points=""22 12 16 12 14 15 10 15 8 12 2 12"" /><path d=""M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"" />",
        ["CheckCircle2"] = @"<path d=""M21.801 10A10 10 0 1 1 17 3.335"" /><path d=""m9 11 3 3L22 4"" />",
        ["Clock"] = @"<circle cx=""12"" cy=""12"" r=""10"" /><path d=""M12 6v6l4 2"" />",
        ["PenLine"] = @"<path d=""M13 21h8"" /><path d=""M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"" />",
        ["Download"] = @"<path d=""M12 15V3"" /><path d=""M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"" /><path d=""m7 10 5 5 5-5"" />",
        ["Eye"] = @"<path d=""M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"" /><circle cx=""12"" cy=""12"" r=""3"" />",
        ["FileText"] = @"<path d=""M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"" /><path d=""M14 2v5a1 1 0 0 0 1 1h5"" /><path d=""M10 9H8"" /><path d=""M16 13H8"" /><path d=""M16 17H8"" />",
        ["CircleCheck"] = @"<circle cx=""12"" cy=""12"" r=""10"" /><path d=""m16 9-5.5 5.5L8 12"" />",
        ["ArrowLeft"] = @"<path d=""m12 19-7-7 7-7"" /><path d=""M19 12H5"" />",
        ["ArrowRight"] = @"<path d=""M5 12h14"" /><path d=""m12 5 7 7-7 7"" />",
        ["Check"] = @"<path d=""M20 6 9 17l-5-5"" />",
        ["ListChecks"] = @"<path d=""M13 5h8"" /><path d=""M13 12h8"" /><path d=""M13 19h8"" /><path d=""m3 17 2 2 4-4"" /><path d=""m3 7 2 2 4-4"" />",
    };
}
