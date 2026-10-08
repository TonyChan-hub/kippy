# Quick scaffold: RN + Flutter with three media permissions

::: info
Tags: Kippy · NativeKit · Scaffold · Permissions  
Related: [Create RN](/guide/create-rn) · [Create Flutter](/guide/create-flutter) · [Install NativeKit](/guide/native-kit/install) · [Permission API](/guide/native-kit/permission)
:::

Most product apps only need a narrow media slice: **take a photo**, **save an image**, **pick one photo from the library**. This post shows how to get there with Kippy scaffolds + NativeKit — without wiring Manifest / Info.plist by hand, and without asking for full album access.

## Goal

| Capability | NativeKit `kind` | Why this kind |
| ---------- | ---------------- | ------------- |
| Camera | `camera` | Capture photo / video |
| Save / download to gallery | `photoAdd` | Write-only; no library read |
| Read album (one / a few) | `photoLimited` | User-selected subset; treat `limited` as success |

Avoid `photoRead` unless you truly need to scan the whole library — stores and users prefer the limited path.

## 1. Scaffold with the media preset

`--preset=media` enables the NativeKit `permission` module and injects media-related iOS / Android declarations.

```bash
# React Native (name must be a JS identifier)
npx @bear1210/create-rn-template MediaDemo --package=com.example.mediademo --preset=media
cd MediaDemo
npm start

# Flutter
npx @bear1210/create-flutter-template media_demo --org=com.example --preset=media
cd media_demo
flutter run
```

Equivalent without the preset:

```bash
npx @bear1210/create-rn-template MediaDemo --modules=permission
npx @bear1210/create-flutter-template media_demo --modules=permission
```

After create, the project root should contain:

```json
{
  "modules": ["permission"]
}
```

If you already have an app:

```bash
npx @bear1210/native-kit add permission
# RN: npm install && cd ios && pod install
# Flutter: flutter pub get && cd ios && pod install
```

Then rebuild the native app.

## 2. Call only the three kinds

NativeKit does not ship capture / picker UI yet (those sit in your product or a future `camera` / `media` module). What it does ship is a stable permission facade — ask before you open the camera, save, or pick.

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
  // photoLimited: "limited" means the user allowed a subset — still usable
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

// Before camera screen
if (await ensureCamera()) {
  // open your camera / image_picker / etc.
}

// Before saving a downloaded image
if (await ensureSaveToGallery()) {
  // write via MediaStore / PHPhotoLibrary add-only / your save helper
}

// Before opening a single-image picker
if (await ensurePickOnePhoto()) {
  // present system picker; only the selected asset(s) are readable
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

## 3. Product rules that keep the surface small

1. **Ask at the moment of use** — camera on the capture screen, `photoAdd` before save, `photoLimited` before the picker. Do not batch-request all three on first launch.
2. **Treat `limited` as OK for pick-one** — that is the intended success path for “read only what the user selected”.
3. **Do not call `photoRead`** in this recipe — full library access is a different product decision and a harder review story.
4. **Rationale UI is yours** — NativeKit never shows explanatory copy; put a short in-app sheet before `ensure` / `request`.
5. **Trim unused Manifest entries if needed** — the permission recipe may inject more keys than this three-kind story. Remove SMS / package-query / other unused declarations before store submission. See [Platform declarations](/guide/native-kit/platform).

## 4. What you get vs what you still own

| Layer | Kippy / NativeKit | Your app |
| ----- | -------------------- | -------- |
| Scaffold | RN / Flutter layout, infra, tooling | Business screens |
| Declarations | Info.plist / Manifest keys via recipe | Final copy & store forms |
| Runtime | `check` / `request` / `ensure` / `openSettings` | Camera UI, download, gallery picker |
| Kind mapping | One id → iOS + Android APIs | Branch on status only |

## Takeaways

- Create with `--preset=media` (or `--modules=permission`) on both RN and Flutter.
- Wire product flows to **`camera` · `photoAdd` · `photoLimited`** only.
- Prefer limited library access when the user only needs to pick one photo.

Next steps: [Permission API](/guide/native-kit/permission) · deeper design notes in [NativeKit permission facade](./native-kit-permissions).
