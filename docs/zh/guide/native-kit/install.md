# 接入 NativeKit

默认脚手架**不会**启用 NativeKit（保持向后兼容）。可在创建时或事后按需接入。

::: tip
NativeKit 处于 [Beta](./) — 仅建议在可选路径试用。
:::

## 1. 启用模块

### 创建时接入

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

`--preset=media` 会启用 `permission`，并注入 [平台声明](./platform)。当前已交付模块：`permission`、`device`。

### 已有项目

```bash
npx @bear1210/native-kit add permission
npx @bear1210/native-kit add device
npx @bear1210/native-kit add permission,device
npx @bear1210/native-kit remove permission
npx @bear1210/native-kit list
```

## 2. 安装原生依赖并重新编译

| 平台 | `add` 之后 |
| ---- | ---------- |
| React Native | `npm install` / `yarn`，再 `cd ios && pod install`，重新编译 |
| Flutter | `flutter pub get`，`cd ios && pod install`，重新编译 |

## 3. 配置

项目根目录 `native-kit.config.json`：

```json
{
  "modules": ["permission", "device"]
}
```

只有列表中的模块会编译进 App。调用未链接的模块会抛出 `MODULE_NOT_LINKED` 并提示修复命令，不会静默失败。

## 4. 调用门面

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

Kit 内不提供 rationale UI，引导文案放在业务层，再调用 `request` / `ensure`。

完整 API 见 [Permission API](./permission)、[Device API](./device)。
