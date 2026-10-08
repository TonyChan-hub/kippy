# NativeKit：双端权限门面怎么设计

::: info
标签：NativeKit · 权限 · 架构  
相关文档：[NativeKit 概览](/zh/guide/native-kit/) · [Permission API](/zh/guide/native-kit/permission) · [Device API](/zh/guide/native-kit/device)
:::

AppSetup 的脚手架刻意「无业务逻辑」，但几乎每个真实 App 都要碰权限与设备信息。NativeKit 的目标不是再做一个巨型 SDK，而是提供**可按模块启用**的双端门面：业务只记一套 API，原生层各自映射。

## 统一 `kind`，而不是统一系统权限名

业务侧调用的是跨端标识，例如 `'camera'`、`'bluetooth'`、`'sms'`，而不是 `CAMERA` 或 `NSCameraUsageDescription`。

好处：

1. RN（TS）与 Flutter（Dart）共享同一套字符串协议（`@bear1210/native-kit-protocol`）
2. CLI / scaffold 可以按 recipe 注入 Manifest / Info.plist，而不把平台细节泄漏到业务代码
3. 文档可以用一张表讲清「用途 → iOS → Android」

状态机保持简单：`granted` / `denied` / `permanentlyDenied` / `restricted` / `limited` / `notDetermined`。平台不支持某能力时，我们复用 `restricted`，而不是再引入 `unsupported`，以免破坏 `ensure` 的分支习惯。

## 敏感能力必须「能用、敢标」

短信、全量应用列表等在 Android 上存在，但审核极严；iOS 往往根本没有对等 API。NativeKit 的做法是：

- 仍然提供 `sms` / `appList` 这类 kind，方便国内业务按需接入
- 在文档与 recipe 上明确标注 **Android-only · 强合规**
- iOS 上 `check` / `request` 直接返回 `restricted`
- 强调：**注入 Manifest ≠ 过审**

公开设备信息则拆成独立模块 `NativeKit.device.getInfo()`：只返回 brand / model / 系统版本 / 包名等，不混进权限 API，也不返回 IMEI、本机号。

## 实现上的双份原生源码

共享逻辑写在 `packages/native_kit`，再同步副本到 `native_kit_rn` / `native_kit_flutter`。桥接层只做薄封装（Promise / MethodChannel），真正的 kind 映射在 Kotlin / Swift 的 `PermissionManager`。

当前 `getLinkedModules` 仍硬编码已交付模块列表；按 `native-kit.config.json` 真正裁剪原生编译是后续工作，不影响门面形状。

## 小结

| 选择 | 原因 |
| ---- | ---- |
| 统一 kind + 平台映射表 | 业务心智成本最低 |
| 强合规 kind 保留但标清 | 不假装跨端能力对称 |
| device 独立模块 | 避免「读型号也像在申请权限」 |
| 不新增 unsupported | 兼容现有 ensure / UI 分支 |

若你正在脚手架里启用 NativeKit，从 [接入](/zh/guide/native-kit/install) 开始即可。
