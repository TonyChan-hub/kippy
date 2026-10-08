# Device API

模块：`device`（Beta）。统一门面：`NativeKit.device.*`。

返回**公开、非敏感**的设备与应用字段。这**不是**权限 API — 无系统弹窗，也无需 Manifest / Info.plist 运行时声明。

已安装应用列表请用 [`permission` → `appList`](./permission)（Android-only，强合规）。IMEI / 本机号码 / 序列号 — **不提供**（现代系统上不可用或受限制）。

## 方法

| 方法 | 签名 | 行为 |
| ---- | ---- | ---- |
| `getInfo` | `() → Promise<DeviceInfo>` | 返回公开字段快照 |

## `DeviceInfo` 字段

| 字段 | 含义 |
| ---- | ---- |
| `brand` | 品牌（iOS 为 `Apple`） |
| `model` | 机型 / machine 标识 |
| `systemName` | `"Android"` 或 `"iOS"` |
| `systemVersion` | 系统版本字符串 |
| `appVersion` | 对外版本号（`versionName` / `CFBundleShortVersionString`） |
| `buildNumber` | 构建号 |
| `bundleId` | 应用包名 / Bundle ID |
| `isEmulator` | 是否运行在模拟器 |

## React Native

```ts
import { NativeKit } from '@bear1210/native-kit-rn';

const info = await NativeKit.device.getInfo();
console.log(info.brand, info.model, info.systemVersion);
```

## Flutter

```dart
import 'package:native_kit_flutter/native_kit_flutter.dart';

final info = await NativeKit.device.getInfo();
print('${info.brand} ${info.model} ${info.systemVersion}');
```

## 启用

```bash
npx @bear1210/native-kit add device
# 或与 permission 一起
npx @bear1210/native-kit add permission,device
```

见 [接入](./install)。
