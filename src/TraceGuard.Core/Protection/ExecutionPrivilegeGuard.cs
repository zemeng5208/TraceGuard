using System.Runtime.InteropServices;
using System.Security.Principal;

namespace TraceGuard.Core.Protection;

/// <summary>
/// TraceGuard is intentionally an as-invoker application. If it is launched
/// with a full elevated token or a high/system integrity token anyway, the Core
/// fails closed instead of consuming the additional authority.
/// </summary>
public static class ExecutionPrivilegeGuard
{
    internal const uint HighIntegrityRid = 0x00003000;
    private static readonly Lazy<bool> Blocked = new(Detect, LazyThreadSafetyMode.ExecutionAndPublication);

    public static bool IsBlocked => Blocked.Value;

    internal static bool ShouldBlock(bool isWindows, bool probeSucceeded, bool isElevated, uint integrityRid) =>
        isWindows && (!probeSucceeded || isElevated || integrityRid >= HighIntegrityRid);

    private static bool Detect()
    {
        if (!OperatingSystem.IsWindows()) return false;
        try
        {
            using var identity = WindowsIdentity.GetCurrent(TokenAccessLevels.Query);
            var token = identity.AccessToken.DangerousGetHandle();
            if (!TryReadElevation(token, out var elevated) || !TryReadIntegrity(token, out var integrityRid))
                return true;
            return ShouldBlock(true, true, elevated, integrityRid);
        }
        catch (SystemException)
        {
            return true;
        }
    }

    private static bool TryReadElevation(IntPtr token, out bool elevated)
    {
        elevated = false;
        if (!GetTokenInformation(token, TokenInformationClass.TokenElevation, out TokenElevation value,
                Marshal.SizeOf<TokenElevation>(), out _)) return false;
        elevated = value.TokenIsElevated != 0;
        return true;
    }

    private static bool TryReadIntegrity(IntPtr token, out uint integrityRid)
    {
        integrityRid = 0;
        GetTokenInformation(token, TokenInformationClass.TokenIntegrityLevel, IntPtr.Zero, 0, out var length);
        if (length <= 0) return false;
        var buffer = Marshal.AllocHGlobal(length);
        try
        {
            if (!GetTokenInformation(token, TokenInformationClass.TokenIntegrityLevel, buffer, length, out _)) return false;
            var sid = Marshal.ReadIntPtr(buffer);
            if (sid == IntPtr.Zero || !IsValidSid(sid)) return false;
            var countPointer = GetSidSubAuthorityCount(sid);
            if (countPointer == IntPtr.Zero) return false;
            var count = Marshal.ReadByte(countPointer);
            if (count == 0) return false;
            var ridPointer = GetSidSubAuthority(sid, (uint)(count - 1));
            if (ridPointer == IntPtr.Zero) return false;
            integrityRid = unchecked((uint)Marshal.ReadInt32(ridPointer));
            return true;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private enum TokenInformationClass
    {
        TokenElevation = 20,
        TokenIntegrityLevel = 25,
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct TokenElevation { public int TokenIsElevated; }

    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(IntPtr tokenHandle, TokenInformationClass tokenInformationClass,
        out TokenElevation tokenInformation, int tokenInformationLength, out int returnLength);

    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(IntPtr tokenHandle, TokenInformationClass tokenInformationClass,
        IntPtr tokenInformation, int tokenInformationLength, out int returnLength);

    [DllImport("advapi32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsValidSid(IntPtr sid);

    [DllImport("advapi32.dll")]
    private static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);

    [DllImport("advapi32.dll")]
    private static extern IntPtr GetSidSubAuthority(IntPtr sid, uint subAuthority);
}
