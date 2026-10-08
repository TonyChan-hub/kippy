# Permission API

模块：`permission`（Beta）。统一门面：`NativeKit.permission.*`。

接入步骤见 [接入](./install)；Manifest / Info.plist 见 [平台声明](./platform)。公开设备信息（非权限）见 [Device API](./device)。

## 方法

| 方法 | 签名 | 行为 |
| ---- | ---- | ---- |
| `check` | `(kind) → Promise<Status>` | 只读，不弹系统框 |
| `request` | `(kind) → Promise<Status>` | 未决定时请求；已决定则直接返回当前状态 |
| `ensure` | `(kind) → Promise<Status>` | 先 `check`，状态为 `denied` / `notDetermined` 时再 `request` |
| `openSettings` | `() → Promise<void>` | 打开本应用的系统设置页 |

`ensure` 在 `permanentlyDenied` / `restricted` 时**不会**再次弹窗 — 应由业务 UI 调用 `openSettings()`。

## 状态（status）

| Status | 含义 |
| ------ | ---- |
| `granted` | 已允许 |
| `denied` | 已拒绝，仍可能再次申请（部分平台首次拒绝也会是此状态） |
| `permanentlyDenied` | 已永久拒绝，需引导去系统设置 |
| `restricted` | 系统 / MDM 限制，**或**本平台不支持该能力 |
| `limited` | 部分权限（iOS 有限相册、有限通讯录、仅写日历等） |
| `notDetermined` | 尚未询问 |

除非需要完整权限，否则可将 `granted` 与 `limited` 都视为「可用」。

## 权限类型（kind）

`kind` 是 **跨端统一的权限标识**：告诉 `check` / `request` / `ensure`「要查 / 申请哪一类能力」。

业务侧只传一个 kind（如 `'camera'`），NativeKit 在原生层映射到 iOS / Android 各自的系统 API 与 Manifest / Info.plist 声明。你不必在 JS/Dart 里写平台权限名（如 `CAMERA`、`NSCameraUsageDescription`）。

### 标注说明

| 标注 | 含义 |
| ---- | ---- |
| （空） | 跨端运行时权限 |
| Android-only | iOS 返回 `restricted` |
| 偏 iOS | Android 无对等或恒定结果（见说明） |
| 强合规 | 商店敏感权限；注入 recipe ≠ 过审 |
| 非运行时弹窗 | `request` 不会弹出标准权限框 |

::: warning 强合规
`sms`、`appList` 为 **Android 特有**，且受 Google Play 与多数应用商店严格限制。CLI 注入声明**不等于**审核通过。上架前须写清业务用途并完成商店申报。
:::

### 用途（业务语义）

| Kind | 用途 | 标注 |
| ---- | ---- | ---- |
| `camera` | 拍照 / 录像 | |
| `microphone` | 录音 / 通话 | |
| `photoRead` | 完整读取相册 | |
| `photoLimited` | 仅访问用户勾选的那部分相册 | |
| `photoAdd` | 仅保存到相册（不读库） | 非运行时弹窗（Android） |
| `locationWhenInUse` | 前台使用期间定位 | |
| `locationAlways` | 后台持续定位（需先有使用期间权限） | |
| `notification` | 本地 / 远程推送 | |
| `contacts` | 读取通讯录 | |
| `calendar` | 读取日历 | |
| `tracking` | 广告标识 / ATT | 非运行时弹窗（Android → `granted`） |
| `bluetooth` | 附近蓝牙设备 | |
| `speechRecognition` | 语音转文字 | Android 映射麦克风 |
| `motion` | 运动 / 活动识别 | |
| `reminders` | 提醒事项 | 偏 iOS（Android → `restricted`） |
| `audioRead` | 读取本地音频 / 媒体库 | |
| `biometrics` | 指纹 / Face ID 可用且已录入 | 非运行时弹窗（`request` ≈ `check`） |
| `localNetwork` | 局域网 / Bonjour 发现 | 偏 iOS（Android → `granted`） |
| `sms` | 读取短信 | Android-only · 强合规 |
| `appList` | 查询已安装应用 | Android-only · 强合规 · 非运行时弹窗 |

传入未知 kind 会得到 `INVALID_KIND`。常量列表定义在 `@bear1210/native-kit-protocol`（RN 也导出 `PermissionKind` 类型；Flutter 为 `PermissionKind` 枚举）。

### 平台映射

| Kind | iOS | Android | 说明 |
| ---- | --- | ------- | ---- |
| `camera` | `AVCaptureDevice`（视频） | `CAMERA` | |
| `microphone` | `AVCaptureDevice`（音频） | `RECORD_AUDIO` | |
| `photoRead` | 完整相册 | 完整 `READ_MEDIA_IMAGES` + `READ_MEDIA_VIDEO`（API 33+）；更早：`READ_EXTERNAL_STORAGE` | 直接申请完整读取。若用户只选了部分 → `limited`（需去设置升级） |
| `photoLimited` | 有限 / 已选相册 | 首次弹窗相同；API 34+ 部分授权 → `READ_MEDIA_VISUAL_USER_SELECTED` | 先授权图片范围；再次 `request` 可扩大选择（iOS limited picker / Android 14+ selected） |
| `photoAdd` | 仅写入相册 | *（无运行时弹窗）* | Android MediaStore 写入通常无需授权 |
| `locationWhenInUse` | 使用期间 | `ACCESS_FINE` + `ACCESS_COARSE` | |
| `locationAlways` | 始终 | 先前台，再 `ACCESS_BACKGROUND_LOCATION`（API 29+） | 现代 Android 为两步申请 |
| `notification` | `UNUserNotificationCenter` | API 33+：`POST_NOTIFICATIONS`，否则视为已授权 | iOS `check` 为异步真实查询 |
| `contacts` | `CNContactStore` | `READ_CONTACTS` | iOS 18 可能返回 `limited` |
| `calendar` | `EKEventStore`（iOS 17+ 完整访问） | `READ_CALENDAR` | iOS 仅写映射为 `limited` |
| `tracking` | App Tracking Transparency | *（无对等运行时权限 → `granted`）* | 需 `NSUserTrackingUsageDescription` |
| `bluetooth` | `CBCentralManager` + `NSBluetoothAlwaysUsageDescription` | API 31+：`BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`；更早：定位 | 单一 kind 一次申请 scan+connect |
| `speechRecognition` | `SFSpeechRecognizer` | `RECORD_AUDIO`（与麦克风相同） | iOS 通常还需麦克风用途文案 |
| `motion` | Motion & Fitness / `NSMotionUsageDescription` | `ACTIVITY_RECOGNITION`（API 29+），否则 granted | |
| `reminders` | `EKEventStore` 提醒事项 | **`restricted`** | Android 无对等 |
| `audioRead` | `MPMediaLibrary` | `READ_MEDIA_AUDIO`（API 33+）/ 存储 | |
| `biometrics` | `LAContext` + Face ID 用途说明 | `BiometricManager.canAuthenticate` | 能力探测，无标准权限弹窗 |
| `localNetwork` | 本地网络用途 + Bonjour | **`granted`** | iOS 无精确预检，首次使用前可能一直是 `notDetermined` |
| `sms` | **`restricted`** | `READ_SMS` | 强合规 |
| `appList` | **`restricted`** | 安装时 `QUERY_ALL_PACKAGES` | `request` 不弹窗；未授予 → `permanentlyDenied` |

### 读相册 — 选对 kind

| 需求 | Kind | 何时算成功 |
| ---- | ---- | ---------- |
| 直接扫 / 读完整相册 | `photoRead` | 仅 `granted`（`limited` 表示只选了部分，要完整访问需去系统设置） |
| 先让用户勾选图片范围，再读这些资源 | `photoLimited` | `granted` **或** `limited`（再次 `request` 可改选 / 扩大范围） |

两者首次系统弹窗相同；区别在于你如何对待 `limited`，以及后续 `request` 会不会重新打开选图 UI。

## 错误码

| Code | 场景 |
| ---- | ---- |
| `MODULE_NOT_LINKED` | 模块未写入配置 / 未链接 |
| `INVALID_KIND` | 缺少或未知 kind（桥接层） |
| `NATIVE_UNAVAILABLE` | 申请时无 Activity / Context |
| `REQUEST_IN_PROGRESS` | 已有请求进行中（Flutter） |

## React Native

包：[`@bear1210/native-kit-rn`](https://github.com/TonyChan-hub/kippy/tree/main/packages/native_kit_rn)。

```ts
import { NativeKit } from '@bear1210/native-kit-rn';
import type { PermissionKind, PermissionStatus } from '@bear1210/native-kit-rn';

async function ensureUsable(kind: PermissionKind): Promise<boolean> {
  const status: PermissionStatus = await NativeKit.permission.ensure(kind);
  if (status === 'permanentlyDenied' || status === 'restricted') {
    await NativeKit.permission.openSettings();
    return false;
  }
  return status === 'granted' || status === 'limited';
}

// 示例
await ensureUsable('camera');
await ensureUsable('bluetooth');
await ensureUsable('speechRecognition');
await ensureUsable('audioRead');
await NativeKit.permission.ensure('biometrics'); // 能力探测
// Android-only / 强合规 — 业务与商店策略把关后再用
await NativeKit.permission.ensure('sms');
await NativeKit.permission.ensure('appList');

// 只读查询（不弹窗）
const current = await NativeKit.permission.check('notification');
```

## Flutter

包：`native_kit_flutter`（path / vendor zip，与 `zippy_flutter` 相同模式）。

```dart
import 'package:native_kit_flutter/native_kit_flutter.dart';

Future<bool> ensureUsable(PermissionKind kind) async {
  final status = await NativeKit.permission.ensure(kind);
  if (status == PermissionStatus.permanentlyDenied ||
      status == PermissionStatus.restricted) {
    await NativeKit.permission.openSettings();
    return false;
  }
  return status == PermissionStatus.granted ||
      status == PermissionStatus.limited;
}

// 示例
await ensureUsable(PermissionKind.camera);
await ensureUsable(PermissionKind.bluetooth);
await ensureUsable(PermissionKind.speechRecognition);
await ensureUsable(PermissionKind.audioRead);
await NativeKit.permission.ensure(PermissionKind.biometrics);
await NativeKit.permission.ensure(PermissionKind.sms);
await NativeKit.permission.ensure(PermissionKind.appList);

final current =
    await NativeKit.permission.check(PermissionKind.notification);
```
