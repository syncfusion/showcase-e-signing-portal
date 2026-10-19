// The JSON source (wwwroot/data/documents.json): validated once at startup, then read into the domain types.
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ESigningPortal.Domain;

public sealed record CatalogueResult(Catalogue? Catalogue, IReadOnlyList<string> Errors)
{
    public bool Ok => Catalogue is not null;
}

public static class CatalogueParser
{
    public static CatalogueResult Parse(string json)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(json); }
        catch (JsonException e) { return new(null, [$"The catalogue is not valid JSON: {e.Message}"]); }
        var errors = CatalogueValidator.Validate(root);
        return errors.Count > 0 ? new(null, errors) : new(Read(root!.AsObject()), []);
    }

    private static Catalogue Read(JsonObject c)
    {
        var p = c["profile"]!.AsObject();
        var profile = new Profile(S(p, "id"), S(p, "fullName"), S(p, "firstName"), S(p, "email"), S(p, "role"), S(p, "company"));
        var docs = c["documents"]!.AsArray().Select(n =>
        {
            var d = n!.AsObject();
            var s = d["sender"]!.AsObject();
            var fields = d["fields"]!.AsArray().Select(fn =>
            {
                var f = fn!.AsObject();
                var b = f["bounds"]!.AsObject();
                return new FieldDefinition(S(f, "name"), S(f, "label"), S(f, "type") == "signature" ? FieldType.Signature : FieldType.Text,
                    f["page"]!.GetValue<int>(),
                    new FieldBounds(b["X"]!.GetValue<double>(), b["Y"]!.GetValue<double>(), b["Width"]!.GetValue<double>(), b["Height"]!.GetValue<double>()),
                    f["required"]!.GetValue<bool>());
            }).ToList();
            return new SigningDocument(S(d, "id"), S(d, "title"), new Sender(S(s, "name"), S(s, "organisation")),
                d["receivedDaysAgo"]!.GetValue<int>(), d["dueInDays"]?.GetValue<int>(), d["pageCount"]!.GetValue<int>(), S(d, "file"),
                S(d, "baselineStatus") == "completed" ? DocumentStatus.Completed : DocumentStatus.Ready,
                d["signedDaysAgo"]?.GetValue<int>(), fields);
        }).ToList();
        return new Catalogue(c["schemaVersion"]!.GetValue<int>(), c["fixtureVersion"]!.GetValue<int>(), profile, docs);
    }

    private static string S(JsonObject o, string key) => o[key]!.GetValue<string>();
}
