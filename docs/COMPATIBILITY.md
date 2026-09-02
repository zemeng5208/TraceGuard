# TraceGuard compatibility / 兼容性

This document separates the operating systems TraceGuard **targets** from environments the current build has **actually verified**. A target is not a claim that every hardware, Windows edition, policy, filesystem, or security-product combination has been tested.

本文明确区分 TraceGuard 的**目标支持环境**与当前构建已经**实际验证的环境**。目标支持不代表已经覆盖所有硬件、Windows 版本、组策略、文件系统或安全软件组合。

## Target support / 目标支持

| Environment | Status | Notes |
| --- | --- | --- |
| Windows 11 x64 | Targeted / 目标支持 | Full consumer-hardware matrix is in progress. / 消费级实机矩阵仍在验证。 |
| Windows 10 22H2 x64 | Best-effort target / 尽力支持 | Depends on the bundled Electron and .NET 8 runtimes continuing to support the platform. / 依赖所捆绑 Electron 与 .NET 8 运行时继续支持该平台。 |
| Windows on ARM64 | Not packaged / 暂无安装包 | The current release produces x64 artifacts only. x64 emulation is not part of the verified matrix. / 当前仅生成 x64 成品，ARM64 上的 x64 模拟尚未验证。 |
| Windows 8.1 and earlier | Unsupported / 不支持 | Windows 7 compatibility was intentionally removed from scope. / Windows 7 兼容性已明确移出范围。 |
| Windows Server | Not a product target / 非产品目标 | CI runner coverage must not be interpreted as Windows Server product support. / CI 运行器覆盖不代表对 Windows Server 的产品支持。 |

The .NET core targets `net8.0-windows10.0.19041.0`, and release artifacts currently target `win-x64`. Packaging is per-user and declares `asInvoker`; compatibility work must not add elevation as a workaround.

.NET Core 的目标框架为 `net8.0-windows10.0.19041.0`，发布架构当前为 `win-x64`。安装采用当前用户范围并声明 `asInvoker`；不得把提权作为兼容性补救方案。

## Verified automatically / 已完成的自动化验证

On GitHub's current `windows-latest` hosted runner, CI verifies all of the following as the runner's ordinary user:

- .NET tests and self-contained `win-x64` Core publication.
- Renderer type checking and production build.
- Core startup plus settings, overview, collector-health, pause/resume, SQLite, real process, and real service IPC responses.
- Launch of the packaged Electron application with the bundled Core.
- Direct launch and clean exit of the final Portable wrapper.
- Silent per-user NSIS install, installed-app launch, and uninstall.
- Exact artifact names, PE headers, minimum sizes, synchronized version metadata, and SHA-256 generation.
- Capture of a real packaged Dashboard screenshot for visual review.

在 GitHub 当前的 `windows-latest` 托管运行器上，CI 已使用普通用户身份验证：.NET 测试与自包含 Core 发布、Renderer 类型检查与生产构建、真实 Core IPC、完整 Electron 成品启动、Portable 包装器直接启动与退出、NSIS 当前用户安装/启动/卸载、版本及 PE/体积/SHA-256 校验，以及真实打包 Dashboard 截图采集。

This is strong packaging and runtime evidence, but it is not a substitute for consumer Windows 10 and Windows 11 hardware tests. The exact hosted runner image can change over time, so this document does not label it as a particular consumer Windows release.

上述结果能证明打包与基础运行链路，但不能替代 Windows 10/11 消费级实机测试。GitHub 托管运行器镜像会随时间变化，因此这里不把它写成某个固定消费版 Windows。

## Consumer-hardware matrix / 消费级实机矩阵

| Test area | Windows 10 22H2 x64 | Windows 11 x64 |
| --- | --- | --- |
| Setup install, first launch, uninstall | Pending / 待验证 | Pending / 待验证 |
| Portable launch and clean exit | Pending / 待验证 | Pending / 待验证 |
| Dark/light/System theme and DPI scaling | Pending / 待验证 | Pending / 待验证 |
| Multi-monitor widget/bubble positioning | Pending / 待验证 | Pending / 待验证 |
| Process, service, startup, registry, and file observation | Pending / 待验证 | Pending / 待验证 |
| NTFS USN readable and denied/fallback paths | Pending / 待验证 | Pending / 待验证 |
| Eligible and ineligible ETW paths | Pending / 待验证 | Pending / 待验证 |
| Sleep/resume, battery mode, and long-running stability | Pending / 待验证 | Pending / 待验证 |

Results should only move to “Verified” when the corresponding build, Windows version, architecture, test path, and outcome have been recorded. Failures caused by current-user permission boundaries must remain visible as reduced/unavailable capability, not be bypassed.

只有记录了对应构建、Windows 版本、架构、测试路径和结果后，才能把项目标记为“已验证”。因当前用户权限边界导致的失败必须如实显示为能力降级或不可用，不得绕过。

## Capability-dependent behavior / 依赖环境的能力

- **USN Journal:** TraceGuard tails only an already-existing NTFS journal that the current token can read. It never creates or modifies a journal. Other volumes fall back independently to `FileSystemWatcher`.
- **ETW attribution:** Exact-path PID/process attribution is optional and starts only when the current token already belongs to `Performance Log Users`. TraceGuard never changes group membership or starts the NT Kernel Logger.
- **Protected/elevated objects:** Some processes, services, and machine-level settings are observable but not controllable in Zero-Privilege Mode. This is an expected compatibility result, not an installation failure.
- **Visual effects:** Mica/Acrylic availability depends on the Windows version and compositor. Unsupported effects must degrade safely without preventing launch or reducing text readability.

- **USN Journal：**只读取当前令牌已有权限访问的现有 NTFS 日志；不会创建或修改日志。其它卷分别回退到 `FileSystemWatcher`。
- **ETW 归属：**仅当当前令牌原本属于 `Performance Log Users` 时启用可选的精确路径 PID/进程归属；不会修改用户组，也不会启动 NT Kernel Logger。
- **受保护/高权限对象：**部分进程、服务和机器级设置在零提权模式下只能观察，不能控制。这是预期兼容结果，不是安装失败。
- **视觉效果：**Mica/Acrylic 取决于 Windows 版本及合成器；不支持时必须安全降级，且不能影响启动与文字可读性。

## Reporting a compatibility result / 提交兼容性结果

Include the TraceGuard version and artifact type, Windows edition/version/build, x64 hardware summary, display scaling, whether the account is standard or administrator, the collector-health states shown in Settings, and reproducible steps. Do not include file contents, browser secrets, cookies, or unrelated personal data.

请包含 TraceGuard 版本与成品类型、Windows 版本/版本号、x64 硬件摘要、显示缩放、账户类型、Settings 中显示的采集器状态及可复现步骤。不要提交文件正文、浏览器机密、Cookie 或无关个人数据。
