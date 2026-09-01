using Microsoft.Data.Sqlite;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Storage;

public sealed class EventStore(AppPaths paths)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private string ConnectionString => new SqliteConnectionStringBuilder { DataSource = paths.DatabasePath, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();

    public async Task InitializeAsync()
    {
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp TEXT NOT NULL,
              category TEXT NOT NULL,
              action TEXT NOT NULL,
              easy_message TEXT NOT NULL,
              easy_message_zh TEXT NOT NULL,
              detail TEXT NOT NULL,
              process_name TEXT NULL,
              pid INTEGER NULL,
              severity TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_events_timestamp ON events(timestamp DESC);
            CREATE INDEX IF NOT EXISTS ix_events_category ON events(category);
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<TraceEvent> AddAsync(TraceEvent item)
    {
        await _gate.WaitAsync();
        try
        {
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO events(timestamp, category, action, easy_message, easy_message_zh, detail, process_name, pid, severity)
                VALUES($timestamp, $category, $action, $easy, $easyZh, $detail, $process, $pid, $severity);
                SELECT last_insert_rowid();
                """;
            command.Parameters.AddWithValue("$timestamp", item.Timestamp.ToString("O"));
            command.Parameters.AddWithValue("$category", item.Category);
            command.Parameters.AddWithValue("$action", item.Action);
            command.Parameters.AddWithValue("$easy", item.EasyMessage);
            command.Parameters.AddWithValue("$easyZh", item.EasyMessageZh);
            command.Parameters.AddWithValue("$detail", item.Detail);
            command.Parameters.AddWithValue("$process", (object?)item.ProcessName ?? DBNull.Value);
            command.Parameters.AddWithValue("$pid", (object?)item.Pid ?? DBNull.Value);
            command.Parameters.AddWithValue("$severity", item.Severity);
            var id = Convert.ToInt64(await command.ExecuteScalarAsync());
            return item with { Id = id };
        }
        finally { _gate.Release(); }
    }

    public async Task<IReadOnlyList<TraceEvent>> GetRecentAsync(int limit)
    {
        var result = new List<TraceEvent>();
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id,timestamp,category,action,easy_message,easy_message_zh,detail,process_name,pid,severity FROM events ORDER BY id DESC LIMIT $limit";
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 5000));
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) result.Add(new TraceEvent(
            reader.GetInt64(0), DateTimeOffset.Parse(reader.GetString(1)), reader.GetString(2), reader.GetString(3),
            reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetInt32(8), reader.GetString(9)));
        return result;
    }

    public async Task<long> CountCategoryAsync(string category)
    {
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM events WHERE category = $category";
        command.Parameters.AddWithValue("$category", category);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async Task ClearAsync()
    {
        await _gate.WaitAsync();
        try
        {
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM events";
            await command.ExecuteNonQueryAsync();
        }
        finally { _gate.Release(); }
    }

    public async Task ApplyRetentionAsync(int days)
    {
        if (days <= 0) return;
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM events WHERE timestamp < $cutoff";
        command.Parameters.AddWithValue("$cutoff", DateTimeOffset.UtcNow.AddDays(-days).ToString("O"));
        await command.ExecuteNonQueryAsync();
    }
}
