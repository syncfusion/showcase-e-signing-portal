// Validates the catalogue at load (contracts/data-contract.md, "Schema and scenarios"), ported from the
// reference's domain/validate.ts. It reads the raw JSON so a malformed file reports every problem, not the first.
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ESigningPortal.Domain;

public static partial class CatalogueValidator
{
    private const double PageWidth = 595;
    private const double PageHeight = 842;

    public static IReadOnlyList<string> Validate(JsonNode? input)
    {
        var errors = new List<string>();
        if (input is not JsonObject c) return ["The catalogue is not an object."];
        if (Int(c["schemaVersion"]) != 1) errors.Add($"schemaVersion must be 1 (found {Show(c["schemaVersion"])}).");
        if (Int(c["fixtureVersion"]) is not int fv || fv < 1) errors.Add("fixtureVersion must be an integer of 1 or more.");

        if (c["profile"] is not JsonObject p || Text(p["id"]) is not string pid || !Kebab().IsMatch(pid)
            || Text(p["fullName"]) is null || Text(p["firstName"]) is null || Text(p["role"]) is null || Text(p["company"]) is null)
            errors.Add("profile is incomplete.");
        else if (Text(p["email"]) is not string email || !email.EndsWith("@example.com", StringComparison.Ordinal))
            errors.Add("profile.email must be a fictional example.com address.");

        if (c["documents"] is not JsonArray docs || docs.Count < 1 || docs.Count > 12)
        {
            errors.Add("documents must hold 1 to 12 entries.");
            return errors;
        }
        var ids = new HashSet<string>();
        foreach (var node in docs)
        {
            var d = node as JsonObject;
            var where = $"Document \"{Text(d?["id"]) ?? "?"}\"";
            if (d is null || Text(d["id"]) is not string id || !Kebab().IsMatch(id)) { errors.Add($"{where}: id must be kebab-case."); continue; }
            if (!ids.Add(id)) errors.Add($"{where}: duplicate id.");
            if (Text(d["title"]) is null) errors.Add($"{where}: title is required.");
            if (d["sender"] is not JsonObject s || Text(s["name"]) is null || Text(s["organisation"]) is null) errors.Add($"{where}: sender is incomplete.");
            if (Int(d["receivedDaysAgo"]) is not int rda || rda < 0 || rda > 60) errors.Add($"{where}: receivedDaysAgo must be 0 to 60.");
            var pageCount = Int(d["pageCount"]);
            if (pageCount is not int pc || pc < 1) errors.Add($"{where}: pageCount must be 1 or more.");
            if (Text(d["file"]) is not string file || !file.StartsWith("documents/", StringComparison.Ordinal) || !file.EndsWith(".pdf", StringComparison.Ordinal))
                errors.Add($"{where}: file must be a PDF under documents/.");
            if (d["fields"] is not JsonArray fields) { errors.Add($"{where}: fields must be a list."); continue; }

            var status = Text(d["baselineStatus"]);
            if (status == "completed")
            {
                if (Int(d["signedDaysAgo"]) is null) errors.Add($"{where}: a completed document needs signedDaysAgo.");
                if (d["dueInDays"] is not null) errors.Add($"{where}: a completed document has no due date.");
                if (fields.Count > 0) errors.Add($"{where}: a completed document has no fields.");
            }
            else if (status == "ready")
            {
                if (Int(d["dueInDays"]) is not int due || due < -30 || due > 60) errors.Add($"{where}: dueInDays must be -30 to 60.");
                if (d["signedDaysAgo"] is not null) errors.Add($"{where}: a ready document has no signedDaysAgo.");
                if (!fields.Any(f => f is JsonObject o && Text(o["type"]) == "signature" && Bool(o["required"]) == true))
                    errors.Add($"{where}: a ready document needs at least one required signature.");
            }
            else errors.Add($"{where}: baselineStatus must be ready or completed.");

            var names = new HashSet<string>();
            foreach (var fieldNode in fields)
            {
                var f = fieldNode as JsonObject;
                var at = $"{where} field \"{Text(f?["name"]) ?? "?"}\"";
                if (f is null || Text(f["name"]) is not string name || Text(f["label"]) is null) { errors.Add($"{at}: name and label are required."); continue; }
                if (!names.Add(name)) errors.Add($"{at}: duplicate name.");
                var type = Text(f["type"]);
                if (type != "signature" && type != "text") errors.Add($"{at}: type must be signature or text.");
                if (Bool(f["required"]) is null) errors.Add($"{at}: required must be true or false.");
                if (Int(f["page"]) is not int page || page < 1 || page > (pageCount ?? 0)) errors.Add($"{at}: page must be 1 to {Show(d["pageCount"])}.");
                var b = f["bounds"] as JsonObject;
                double? x = Num(b?["X"]), y = Num(b?["Y"]), w = Num(b?["Width"]), h = Num(b?["Height"]);
                if (b is null || !(w > 0) || !(h > 0) || !(x >= 0) || !(y >= 0) || x + w > PageWidth || y + h > PageHeight)
                    errors.Add($"{at}: bounds must be positive and inside the page.");
            }
        }
        return errors;
    }

    private static string? Text(JsonNode? n) =>
        n is JsonValue v && v.GetValueKind() == JsonValueKind.String && v.GetValue<string>() is { } s && !string.IsNullOrWhiteSpace(s) ? s : null;

    private static int? Int(JsonNode? n)
    {
        if (n is not JsonValue v || v.GetValueKind() != JsonValueKind.Number) return null;
        var d = v.Deserialize<double>();
        return d == Math.Floor(d) && d is >= int.MinValue and <= int.MaxValue ? (int)d : null;
    }

    private static double? Num(JsonNode? n) => n is JsonValue v && v.GetValueKind() == JsonValueKind.Number ? v.Deserialize<double>() : null;

    private static bool? Bool(JsonNode? n) => n is JsonValue v && v.GetValueKind() is JsonValueKind.True or JsonValueKind.False ? v.GetValue<bool>() : null;

    private static string Show(JsonNode? n) => n?.ToJsonString() ?? "undefined";

    [GeneratedRegex("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")]
    private static partial Regex Kebab();
}
