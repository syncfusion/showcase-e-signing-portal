// Domain types (contracts/data-contract.md). No Blazor or Syncfusion types in this folder.
using System.Text.Json.Serialization;

namespace ESigningPortal.Domain;

public sealed record Profile(string Id, string FullName, string FirstName, string Email, string Role, string Company);

/// <summary>Field position in PDF points from the page's top-left corner.</summary>
public sealed record FieldBounds(double X, double Y, double Width, double Height);

public enum FieldType { Signature, Text }

public sealed record FieldDefinition(string Name, string Label, FieldType Type, int Page, FieldBounds Bounds, bool Required);

public sealed record Sender(string Name, string Organisation);

public enum DocumentStatus { Ready, Completed }

public sealed record SigningDocument(
    string Id,
    string Title,
    Sender Sender,
    int ReceivedDaysAgo,
    int? DueInDays,
    int PageCount,
    string File,
    DocumentStatus BaselineStatus,
    int? SignedDaysAgo,
    IReadOnlyList<FieldDefinition> Fields);

public sealed record Catalogue(int SchemaVersion, int FixtureVersion, Profile Profile, IReadOnlyList<SigningDocument> Documents);

/// <summary>One signed document held for this tab only: when, the flattened signed PDF, and its download name.</summary>
public sealed record SessionEntry(DateTimeOffset SignedAt, byte[] SignedPdf, string FileName);

public enum Badge { Ready, DueSoon, Completed }
