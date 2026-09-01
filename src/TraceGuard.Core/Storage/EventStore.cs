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
            CREATE TABLE IF NOT EXISTS installation_sessions (
              id TEXT PRIMARY KEY,
              root_process TEXT NOT NULL,
              root_pid INTEGER NOT NULL,
              started_at TEXT NOT NULL,
              ended_at TEXT NULL,
              status TEXT NOT NULL,
              change_count INTEGER NOT NULL,
              important_count INTEGER NOT NULL,
              report_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_sessions_started ON installation_sessions(started_at DESC);
            CREATE TABLE IF NOT EXISTS rules (
              id TEXT PRIMARY KEY,
              process_pattern TEXT NOT NULL COLLATE NOCASE UNIQUE,
              auto_start_action TEXT NOT NULL,
              manual_start_action TEXT NOT NULL,
              notify INTEGER NOT NULL,
              block_auto_restart INTEGER NOT NULL,
              updated_at TEXT NOT NULL
            );
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

    public async Task<long> CountCategorySinceAsync(string category, DateTimeOffset since)
    {
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM events WHERE category = $category AND timestamp >= $since";
        command.Parameters.AddWithValue("$category", category);
        command.Parameters.AddWithValue("$since", since.ToString("O"));
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

    public async Task ClearReportsAsync()
    {
        await _gate.WaitAsync();
        try
        {
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM installation_sessions";
            await command.ExecuteNonQueryAsync();
        }
        finally { _gate.Release(); }
    }

    public async Task ResetAsync()
    {
        await _gate.WaitAsync();
        try
        {
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM events; DELETE FROM installation_sessions; DELETE FROM rules; VACUUM;";
            await command.ExecuteNonQueryAsync();
        }
        finally { _gate.Release(); }
    }

    public async Task<StorageInfo> GetStorageInfoAsync()
    {
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        static async Task<long> CountAsync(SqliteConnection connection, string table)
        {
            var command = connection.CreateCommand();
            command.CommandText = $"SELECT COUNT(*) FROM {table}";
            return Convert.ToInt64(await command.ExecuteScalarAsync());
        }
        var size = File.Exists(paths.DatabasePath) ? new FileInfo(paths.DatabasePath).Length : 0;
        return new StorageInfo(paths.DatabasePath, size, await CountAsync(connection, "events"), await CountAsync(connection, "installation_sessions"), await CountAsync(connection, "rules"));
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

    public async Task SaveSessionAsync(InstallationSession session)
    {
        await _gate.WaitAsync();
        try
        {
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO installation_sessions(id,root_process,root_pid,started_at,ended_at,status,change_count,important_count,report_json)
                VALUES($id,$process,$pid,$started,$ended,$status,$count,$important,$json)
                ON CONFLICT(id) DO UPDATE SET ended_at=$ended,status=$status,change_count=$count,important_count=$important,report_json=$json
                """;
            command.Parameters.AddWithValue("$id", session.Id);
            command.Parameters.AddWithValue("$process", session.RootProcess);
            command.Parameters.AddWithValue("$pid", session.RootPid);
            command.Parameters.AddWithValue("$started", session.StartedAt.ToString("O"));
            command.Parameters.AddWithValue("$ended", session.EndedAt?.ToString("O") ?? (object)DBNull.Value);
            command.Parameters.AddWithValue("$status", session.Status);
            command.Parameters.AddWithValue("$count", session.ChangeCount);
            command.Parameters.AddWithValue("$important", session.ImportantCount);
            command.Parameters.AddWithValue("$json", System.Text.Json.JsonSerializer.Serialize(session, JsonDefaults.Options));
            await command.ExecuteNonQueryAsync();
        }
        finally { _gate.Release(); }
    }

    public async Task<IReadOnlyList<InstallationSession>> GetSessionsAsync(int limit)
    {
        var result = new List<InstallationSession>();
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT report_json FROM installation_sessions ORDER BY started_at DESC LIMIT $limit";
        command.Parameters.AddWithValue("$limit", Math.Clamp(limit, 1, 500));
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var session = System.Text.Json.JsonSerializer.Deserialize<InstallationSession>(reader.GetString(0), JsonDefaults.Options);
            if (session is not null) result.Add(session);
        }
        return result;
    }

    public async Task<IReadOnlyList<TraceRule>> GetRulesAsync()
    {
        var result = new List<TraceRule>();
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id,process_pattern,auto_start_action,manual_start_action,notify,block_auto_restart,updated_at FROM rules ORDER BY process_pattern";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) result.Add(new TraceRule(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt32(4) != 0, reader.GetInt32(5) != 0, DateTimeOffset.Parse(reader.GetString(6))));
        return result;
    }

    public async Task<TraceRule> SaveRuleAsync(TraceRule rule)
    {
        await _gate.WaitAsync();
        try
        {
            var normalized = rule with { Id = string.IsNullOrWhiteSpace(rule.Id) ? Guid.NewGuid().ToString("N") : rule.Id, UpdatedAt = DateTimeOffset.UtcNow };
            await using var connection = new SqliteConnection(ConnectionString);
            await connection.OpenAsync();
            var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO rules(id,process_pattern,auto_start_action,manual_start_action,notify,block_auto_restart,updated_at)
                VALUES($id,$pattern,$auto,$manual,$notify,$restart,$updated)
                ON CONFLICT(process_pattern) DO UPDATE SET id=$id,auto_start_action=$auto,manual_start_action=$manual,notify=$notify,block_auto_restart=$restart,updated_at=$updated
                """;
            command.Parameters.AddWithValue("$id", normalized.Id);
            command.Parameters.AddWithValue("$pattern", normalized.ProcessPattern);
            command.Parameters.AddWithValue("$auto", normalized.AutoStartAction);
            command.Parameters.AddWithValue("$manual", normalized.ManualStartAction);
            command.Parameters.AddWithValue("$notify", normalized.Notify ? 1 : 0);
            command.Parameters.AddWithValue("$restart", normalized.BlockAutoRestart ? 1 : 0);
            command.Parameters.AddWithValue("$updated", normalized.UpdatedAt.ToString("O"));
            await command.ExecuteNonQueryAsync();
            return normalized;
        }
        finally { _gate.Release(); }
    }

    public async Task DeleteRuleAsync(string id)
    {
        await using var connection = new SqliteConnection(ConnectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM rules WHERE id=$id";
        command.Parameters.AddWithValue("$id", id);
        await command.ExecuteNonQueryAsync();
    }
}
