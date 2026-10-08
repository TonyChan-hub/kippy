# Device API

Module: `device` (Beta). Facade: `NativeKit.device.*`.

Returns **public, non-sensitive** device and app fields. This is **not** a permission API — there is no system dialog and no Manifest / Info.plist runtime declaration.

For installed app lists, use [`permission` → `appList`](./permission) (Android-only, strong compliance). For IMEI / phone number / serial — **not provided** (unavailable or restricted on modern OS versions).

## Methods

| Method | Signature | Behavior |
| ------ | --------- | -------- |
| `getInfo` | `() → Promise<DeviceInfo>` | Snapshot of public fields |

## `DeviceInfo` fields

| Field | Meaning |
| ----- | ------- |
| `brand` | Manufacturer brand (`Apple` on iOS) |
| `model` | Device model / machine identifier |
| `systemName` | `"Android"` or `"iOS"` |
| `systemVersion` | OS version string |
| `appVersion` | Marketing version (`versionName` / `CFBundleShortVersionString`) |
| `buildNumber` | Build number |
| `bundleId` | Application id / bundle identifier |
| `isEmulator` | Running on emulator / simulator |

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

## Enable

```bash
npx @bear1210/native-kit add device
# or together with permission
npx @bear1210/native-kit add permission,device
```

See [Install](./install).
