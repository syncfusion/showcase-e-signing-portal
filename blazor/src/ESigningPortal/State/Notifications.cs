namespace ESigningPortal.State;

/// <summary>Pages ask for a toast here; the shell's Notifier shows it (reference useNotify()).</summary>
public sealed class Notifications
{
    internal Func<string, string, string, Task>? Show { get; set; }

    /// <summary>Kind is success, warning, danger or info.</summary>
    public Task NotifyAsync(string title, string content, string kind) => Show?.Invoke(title, content, kind) ?? Task.CompletedTask;
}
