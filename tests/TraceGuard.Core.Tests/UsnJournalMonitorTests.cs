using System.Buffers.Binary;
using System.Text;
using TraceGuard.Core.Monitoring;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class UsnJournalMonitorTests
{
    [Fact]
    public void ParsesVersionTwoRecordWithoutTouchingARealJournal()
    {
        const string name = "Updater.exe";
        var nameBytes = Encoding.Unicode.GetBytes(name);
        var recordLength = 60 + nameBytes.Length;
        var buffer = new byte[8 + recordLength];
        BinaryPrimitives.WriteInt64LittleEndian(buffer.AsSpan(0, 8), 8010);
        var record = buffer.AsSpan(8);
        BinaryPrimitives.WriteUInt32LittleEndian(record.Slice(0, 4), (uint)recordLength);
        BinaryPrimitives.WriteUInt16LittleEndian(record.Slice(4, 2), 2);
        BinaryPrimitives.WriteUInt64LittleEndian(record.Slice(8, 8), 42);
        BinaryPrimitives.WriteUInt64LittleEndian(record.Slice(16, 8), 7);
        BinaryPrimitives.WriteInt64LittleEndian(record.Slice(24, 8), 8000);
        BinaryPrimitives.WriteUInt32LittleEndian(record.Slice(40, 4), 0x00000100);
        BinaryPrimitives.WriteUInt16LittleEndian(record.Slice(56, 2), (ushort)nameBytes.Length);
        BinaryPrimitives.WriteUInt16LittleEndian(record.Slice(58, 2), 60);
        nameBytes.CopyTo(record.Slice(60));

        var parsed = UsnJournalMonitor.ParseRecords(buffer);

        var item = Assert.Single(parsed);
        Assert.Equal((ulong)42, item.FileReferenceNumber);
        Assert.Equal((ulong)7, item.ParentFileReferenceNumber);
        Assert.Equal(8000, item.Usn);
        Assert.Equal(name, item.FileName);
        Assert.Equal("CREATE", UsnJournalMonitor.ClassifyAction(item.Reason));
    }

    [Theory]
    [InlineData(0x00000200u, "DELETE")]
    [InlineData(0x00001000u, "RENAME")]
    [InlineData(0x00002000u, "RENAME")]
    [InlineData(0x00000100u, "CREATE")]
    [InlineData(0x00000002u, "MODIFY")]
    public void MapsUsnReasonsToTraceGuardActions(uint reason, string expected) =>
        Assert.Equal(expected, UsnJournalMonitor.ClassifyAction(reason));

    [Fact]
    public void IgnoresCloseOnlyRecord() =>
        Assert.Null(UsnJournalMonitor.ClassifyAction(0x80000000));

    [Theory]
    [InlineData(@"\\?\C:\Users\Alice\file.txt", @"C:\Users\Alice\file.txt")]
    [InlineData(@"\\?\UNC\server\share\file.txt", @"\\server\share\file.txt")]
    public void NormalizesExtendedWindowsPaths(string input, string expected) =>
        Assert.Equal(expected, UsnJournalMonitor.NormalizeExtendedPath(input));
}
