// Expected-value vectors V1 to V11 and the invalid examples from contracts/data-contract.md, the same vectors as the
// reference's src/domain/domain.test.ts, run against the shipped wwwroot/data/documents.json.
using System.Text.Json.Nodes;
using ESigningPortal.Domain;

namespace ESigningPortal.Tests;

public class RulesTests
{
    private static readonly string Json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "documents.json"));
    private static readonly Catalogue Catalogue = CatalogueParser.Parse(Json).Catalogue!;
    private static readonly DateTime Today = new(2026, 10, 9, 15, 30, 0, DateTimeKind.Local);
    private static readonly Dictionary<string, SessionEntry> None = [];
    private static readonly Dictionary<string, SessionEntry> SignedOffer = new()
    {
        ["employment-offer-letter"] = new SessionEntry(new DateTimeOffset(Today), [], "x.pdf"),
    };

    private static SigningDocument Doc(string id) => Catalogue.Documents.Single(d => d.Id == id);
    private static SigningDocument Offer => Doc("employment-offer-letter");
    private static SigningDocument Nda => Doc("confidentiality-agreement");
    private static Dictionary<string, string> V(params (string Name, string Value)[] values) => values.ToDictionary(v => v.Name, v => v.Value);

    [Fact]
    public void Fixture_is_valid() => Assert.Empty(CatalogueValidator.Validate(JsonNode.Parse(Json)));

    [Fact]
    public void V1_baseline_three_ready_by_due_date_one_completed()
    {
        var (ready, completed) = Rules.GroupByStatus(Catalogue.Documents, None, Today);
        Assert.Equal(["confidentiality-agreement", "employment-offer-letter", "handbook-acknowledgment"], ready.Select(d => d.Id));
        Assert.Equal(["direct-deposit-authorization"], completed.Select(d => d.Id));
    }

    [Fact]
    public void V2_badges()
    {
        Assert.Equal(Badge.DueSoon, Rules.BadgeOf(Nda, None));
        Assert.Equal(Badge.Ready, Rules.BadgeOf(Offer, None));
        Assert.Equal(Badge.Ready, Rules.BadgeOf(Doc("handbook-acknowledgment"), None));
        Assert.Equal(Badge.Completed, Rules.BadgeOf(Doc("direct-deposit-authorization"), None));
    }

    [Fact]
    public void V3_offer_letter_nothing_filled()
    {
        Assert.Equal(1, Rules.RemainingRequired(Offer.Fields, V()));
        Assert.False(Rules.CanFinish(Offer.Fields, V()));
        Assert.Equal("employee_signature", Rules.NextUnsignedField(Offer.Fields, V())?.Name);
    }

    [Fact]
    public void V4_only_the_optional_field_filled()
    {
        var v = V(("preferred_name", "Pete"));
        Assert.Equal(1, Rules.RemainingRequired(Offer.Fields, v));
        Assert.False(Rules.CanFinish(Offer.Fields, v));
    }

    [Fact]
    public void V5_signature_only()
    {
        var v = V(("employee_signature", "data"));
        Assert.Equal(0, Rules.RemainingRequired(Offer.Fields, v));
        Assert.True(Rules.CanFinish(Offer.Fields, v));
        Assert.Null(Rules.NextUnsignedField(Offer.Fields, v));
    }

    [Fact]
    public void V6_nda_first_signature_only()
    {
        var v = V(("acknowledgment_signature", "data"));
        Assert.Equal(1, Rules.RemainingRequired(Nda.Fields, v));
        var next = Rules.NextUnsignedField(Nda.Fields, v);
        Assert.Equal("employee_signature", next?.Name);
        Assert.Equal(2, next?.Page);
    }

    [Fact]
    public void V7_after_completing_the_offer_letter()
    {
        var (ready, completed) = Rules.GroupByStatus(Catalogue.Documents, SignedOffer, Today);
        Assert.Equal(2, ready.Count);
        Assert.Equal(["employment-offer-letter", "direct-deposit-authorization"], completed.Select(d => d.Id));
        Assert.Equal(Badge.Completed, Rules.BadgeOf(Offer, SignedOffer));
    }

    [Fact]
    public void V8_reset_equals_the_baseline()
    {
        var a = Rules.GroupByStatus(Catalogue.Documents, None, Today);
        var b = Rules.GroupByStatus(Catalogue.Documents, new Dictionary<string, SessionEntry>(), Today);
        Assert.Equal(a.Ready.Select(d => d.Id), b.Ready.Select(d => d.Id));
        Assert.Equal(a.Completed.Select(d => d.Id), b.Completed.Select(d => d.Id));
        Assert.Equal(3, a.Ready.Count);
    }

    [Fact]
    public void V9_whitespace_text_counts_as_empty()
    {
        Assert.False(Rules.CanFinish(Offer.Fields, V(("preferred_name", "   "))));
        Assert.True(Rules.CanFinish(Offer.Fields, V(("preferred_name", "   "), ("employee_signature", "data"))));
    }

    [Fact]
    public void V10_next_order_on_the_offer_letter_visits_optional_and_required_fields()
    {
        Assert.Equal("preferred_name", Rules.NextOpenField(Offer.Fields, V())?.Name);
        Assert.Equal("employee_signature", Rules.NextOpenField(Offer.Fields, V(), "preferred_name")?.Name);
        Assert.Equal("preferred_name", Rules.NextOpenField(Offer.Fields, V(("employee_signature", "data")), "employee_signature")?.Name);
    }

    [Fact]
    public void V11_next_with_everything_filled() =>
        Assert.Null(Rules.NextOpenField(Offer.Fields, V(("preferred_name", "Pete"), ("employee_signature", "data"))));

    [Fact]
    public void Next_wraps_after_the_given_field()
    {
        Assert.Equal("acknowledgment_signature", Rules.NextUnsignedField(Nda.Fields, V(), "employee_signature")?.Name);
        Assert.Equal("employee_signature", Rules.NextUnsignedField(Nda.Fields, V(), "acknowledgment_signature")?.Name);
    }

    [Fact]
    public void Dates_come_from_day_offsets()
    {
        var d = Rules.ResolveDates(Offer, Today);
        Assert.Equal((10, 7), (d.Received.Month, d.Received.Day));
        Assert.Equal((10, 14), (d.Due!.Value.Month, d.Due.Value.Day));
        Assert.Null(Rules.ResolveDates(Doc("direct-deposit-authorization"), Today).Due);
    }

    [Fact]
    public void Messages_and_file_names()
    {
        Assert.Equal("1 signature is still required", Rules.StillRequiredMessage(1));
        Assert.Equal("2 signatures are still required", Rules.StillRequiredMessage(2));
        Assert.Equal("Employment Offer Letter - signed.pdf", Rules.SignedFileName("Employment Offer Letter"));
    }

    // Invalid catalogues are rejected.
    private static IReadOnlyList<string> Bad(Action<JsonObject> change)
    {
        var c = JsonNode.Parse(Json)!.AsObject();
        change(c);
        return CatalogueValidator.Validate(c);
    }

    private static JsonObject DocAt(JsonObject c, int i) => c["documents"]![i]!.AsObject();

    [Fact] public void SchemaVersion_2() => Assert.NotEmpty(Bad(c => c["schemaVersion"] = 2));
    [Fact] public void Duplicate_id() => Assert.NotEmpty(Bad(c => DocAt(c, 1)["id"] = DocAt(c, 0)["id"]!.GetValue<string>()));
    [Fact] public void Ready_document_with_no_required_signature() => Assert.NotEmpty(Bad(c => { foreach (var f in DocAt(c, 0)["fields"]!.AsArray()) f!["required"] = false; }));
    [Fact] public void Field_page_beyond_pageCount() => Assert.NotEmpty(Bad(c => DocAt(c, 0)["fields"]![0]!["page"] = 9));
    [Fact] public void Zero_width() => Assert.NotEmpty(Bad(c => DocAt(c, 0)["fields"]![0]!["bounds"]!["Width"] = 0));
    [Fact] public void Completed_with_no_signedDaysAgo() => Assert.NotEmpty(Bad(c => DocAt(c, 3)["signedDaysAgo"] = null));
    [Fact] public void Not_an_object() => Assert.NotEmpty(CatalogueValidator.Validate(null));
    [Fact] public void Not_json() => Assert.False(CatalogueParser.Parse("{").Ok);
}
