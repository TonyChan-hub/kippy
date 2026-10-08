# Install NativeKit

Default scaffolds do **not** enable NativeKit (backward compatible). Opt in at create time or later.

::: tip
NativeKit is [Beta](./) — prefer opt-in / non-critical paths.
:::

## 1. Enable the module

### At scaffold

```bash
# React Native
npx @bear1210/create-rn-template MyNewApp --modules=permission
npx @bear1210/create-rn-template MyNewApp --modules=permission,device
npx @bear1210/create-rn-template MyNewApp --preset=media

# Flutter
npx @bear1210/create-flutter-template myApp --modules=permission
npx @bear1210/create-flutter-template myApp --modules=permission,device
npx @bear1210/create-flutter-template myApp --preset=media
```

`--preset=media` enables `permission` and injects [platform declarations](./platform). Shipped modules today: `permission`, `device`.

### Existing app

```bash
npx @bear1210/native-kit add permission
npx @bear1210/native-kit add device
npx @bear1210/native-kit add permission,device
npx @bear1210/native-kit remove permission
npx @bear1210/native-kit list
```

## 2. Install native deps & rebuild

| Platform | After `add` |
| -------- | ----------- |
| React Native | `npm install` / `yarn`, then `cd ios && pod install`, rebuild |
| Flutter | `flutter pub get`, `cd ios && pod install`, rebuild |

## 3. Config

Project root `native-kit.config.json`:

```json
{
  "modules": ["permission", "device"]
}
```

Only listed modules are compiled into the app. Calling a module that is not linked throws `MODULE_NOT_LINKED` with a fix hint — never a silent no-op.

## 4. Call the facade

```ts
// React Native
import { NativeKit } from '@bear1210/native-kit-rn';
await NativeKit.permission.ensure('camera');
const info = await NativeKit.device.getInfo();
```

```dart
// Flutter
import 'package:native_kit_flutter/native_kit_flutter.dart';
await NativeKit.permission.ensure(PermissionKind.camera);
final info = await NativeKit.device.getInfo();
```

No rationale UI inside the kit — build that in your product layer before `request` / `ensure`.

Full API: [Permission API](./permission), [Device API](./device).
