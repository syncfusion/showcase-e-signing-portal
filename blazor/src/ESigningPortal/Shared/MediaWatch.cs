namespace ESigningPortal.Shared;

/// <summary>Result of esignApp.watchMedia: the watch id (for unwatch) and whether the query matches now.</summary>
public sealed record MediaWatch(int Id, bool Matches);
