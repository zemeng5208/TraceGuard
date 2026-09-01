using System.Runtime.InteropServices;

namespace TraceGuard.Core.Platform;

public static class PowerStatus
{
    public static bool IsOnBattery()
    {
        try { return GetSystemPowerStatus(out var status) && status.ACLineStatus == 0; }
        catch { return false; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeStatus
    {
        public byte ACLineStatus;
        public byte BatteryFlag;
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;
        public uint BatteryLifeTime;
        public uint BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll")]
    private static extern bool GetSystemPowerStatus(out NativeStatus status);
}
