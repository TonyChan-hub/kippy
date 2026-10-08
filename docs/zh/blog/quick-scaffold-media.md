# 快速搭建：RN + Flutter，只用三种媒体权限

::: info
标签：AppSetup · NativeKit · 脚手架 · 权限  
相关文档：[创建 RN](/zh/guide/create-rn) · [创建 Flutter](/zh/guide/create-flutter) · [接入 NativeKit](/zh/guide/native-kit/install) · [Permission API](/zh/guide/native-kit/permission)
:::

多数业务其实只需要一小段媒体能力：**拍照**、**把图片存进相册**、**从相册选一张（只读所选）**。本文用 AppSetup 脚手架 + NativeKit，走最短路径落地这两端，不必手写 Manifest / Info.plist，也不申请「读完整相册」。

## 目标

| 能力 | NativeKit `kind` | 为什么选它 |
| ---- | ---------------- | ---------- |
| 相机 | `camera` | 拍照 / 录像 |
| 下载 / 保存到相册 | `photoAdd` | 只写不读 |
| 读相册（一张 / 少量） | `photoLimited` | 用户勾选子集；`limited` 也算可用 |

除非真的要扫整库，否则不要用 `photoRead`——审核与用户感知都更友好。

## 1. 用 media 预设一键脚手架

`--preset=media` 会启用 NativeKit 的 `permission` 模块，并注入媒体相关的 iOS / Android 声明。

```bash
# React Native（项目名须是合法 JS 标识符）
npx @bear1210/create-rn-template MediaDemo --package=com.example.mediademo --preset=media
cd MediaDemo
npm start

# Flutter
npx @bear1210/create-flutter-template media_demo --org=com.example --preset=media
cd media_demo
flutter run
```

不用预设时等价于：

```bash
npx @bear1210/create-rn-template MediaDemo --modules=permission
npx @bear1210/create-flutter-template media_demo --modules=permission
```

创建完成后，项目根目录应有：

```json
{
  "modules": ["permission"]
}
```

已有项目事后接入：

```bash
npx @bear1210/native-kit add permission
# RN：npm install && cd ios && pod install
# Flutter：flutter pub get && cd ios && pod install
```

然后重新编译原生工程。

## 2. 业务里只申请这三个 kind

NativeKit 目前不带拍照 / 选图 UI（那是业务层，或后续 `camera` / `media` 模块）。它提供的是稳定的权限门面——开相机、保存、选图之前先问清楚。

### React Native

```ts
import { NativeKit } from '@bear1210/native-kit-rn';
import type { PermissionKind, PermissionStatus } from '@bear1210/native-kit-rn';

async function ensureUsable(kind: PermissionKind): Promise<boolean> {
  const status: PermissionStatus = await NativeKit.permission.ensure(kind);
  if (status === 'permanentlyDenied' || status === 'restricted') {
    await NativeKit.permission.openSettings();
    return false;
  }
  // photoLimited：limited 表示用户只授权了所选范围，仍可继续用
  return status === 'granted' || status === 'limited';
}

export async function ensureCamera() {
  return ensureUsable('camera');
}

export async function ensureSaveToGallery() {
  return ensureUsable('photoAdd');
}

export async function ensurePickOnePhoto() {
  return ensureUsable('photoLimited');
}

// 进入拍照页之前
if (await ensureCamera()) {
  // 打开你的相机 / image_picker 等
}

// 下载图片保存到相册之前
if (await ensureSaveToGallery()) {
  // MediaStore / PHPhotoLibrary 仅添加 / 自有保存逻辑
}

// 打开「选一张」之前
if (await ensurePickOnePhoto()) {
  // 系统选图；只能读用户勾选的资源
}
```

### Flutter

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

Future<bool> ensureCamera() => ensureUsable(PermissionKind.camera);

Future<bool> ensureSaveToGallery() =>
    ensureUsable(PermissionKind.photoAdd);

Future<bool> ensurePickOnePhoto() =>
    ensureUsable(PermissionKind.photoLimited);
```

## 3. 把权限面收小的产品约定

1. **用时再申请**——拍照页再要相机，保存前再要 `photoAdd`，打开选图前再要 `photoLimited`。不要在首启一次弹三个。
2. **选一张时把 `limited` 当成功**——「只读用户所选」本来就是这条路径。
3. **本配方不要调用 `photoRead`**——完整读库是另一类产品决策，审核也更重。
4. **说明文案归业务**——NativeKit 不弹 rationale；在 `ensure` / `request` 前自己做一层引导。
5. **按需删多余 Manifest**——permission recipe 可能注入比这三种更多的声明。上架前去掉短信 / 查包等用不到的项。见 [平台声明](/zh/guide/native-kit/platform)。

## 4. 框架负责什么，业务负责什么

| 层级 | AppSetup / NativeKit | 你的 App |
| ---- | -------------------- | -------- |
| 脚手架 | RN / Flutter 工程骨架与基建 | 业务页面 |
| 声明 | Info.plist / Manifest recipe | 最终文案与商店表单 |
| 运行时 | `check` / `request` / `ensure` / `openSettings` | 相机 UI、下载、选图 |
| Kind 映射 | 一个 id → 双端系统 API | 只按 status 分支 |

## 小结

- 两端创建时加上 `--preset=media`（或 `--modules=permission`）。
- 业务只接 **`camera` · `photoAdd` · `photoLimited`**。
- 「只读一张」优先走 limited 相册授权，而不是完整读库。

下一步：[Permission API](/zh/guide/native-kit/permission) · 设计取舍见 [NativeKit：双端权限门面](./native-kit-permissions)。
