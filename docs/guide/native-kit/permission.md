# Permission API

Module: `permission` (Beta). Facade: `NativeKit.permission.*`.

Setup: [Install](./install). Manifest / Info.plist: [Platform declarations](./platform). Public device fields (no permission): [Device API](./device).

## Methods

| Method | Signature | Behavior |
| ------ | --------- | -------- |
| `check` | `(kind) → Promise<Status>` | Read-only; never shows a system dialog |
| `request` | `(kind) → Promise<Status>` | Prompts if undetermined; returns current status if already decided |
| `ensure` | `(kind) → Promise<Status>` | `check`, then `request` when status is `denied` or `notDetermined` |
| `openSettings` | `() → Promise<void>` | Opens the app’s system settings page |

`ensure` does **not** re-prompt when status is `permanentlyDenied` or `restricted` — call `openSettings()` from your UI instead.

## Statuses

| Status | Meaning |
| ------ | ------- |
| `granted` | Allowed |
| `denied` | Denied; may ask again (or first denial on some platforms) |
| `permanentlyDenied` | Denied; send user to Settings |
| `restricted` | OS / MDM blocked, **or** capability unsupported on this platform |
| `limited` | Partial access (iOS photo library, contacts limited, calendar write-only) |
| `notDetermined` | Not asked yet |

Treat both `granted` and `limited` as “usable” unless you need full access.

Longer walkthrough (platform mapping, UI branching, `ensure` semantics): [Android & iOS permissions: what each status means](/blog/permission-status).

## Kinds

`kind` is the **cross-platform permission id**: it tells `check` / `request` / `ensure` *which capability* to inspect or ask for.

You pass one kind (e.g. `'camera'`); NativeKit maps it on the native side to the right iOS / Android APIs and Manifest / Info.plist entries. JS/Dart code does not use platform permission names (`CAMERA`, `NSCameraUsageDescription`, etc.).

### Tags

| Tag | Meaning |
| --- | ------- |
| *(empty)* | Cross-platform runtime permission |
| Android-only | iOS returns `restricted` |
| iOS-focused | Weak or no Android runtime equivalent (see Notes) |
| Strong compliance | Store-sensitive; recipe inject ≠ approval |
| No runtime dialog | `request` does not show a standard permission sheet |

::: warning Strong compliance
`sms` and `appList` are **Android-only** and heavily restricted by Google Play and many regional stores. Declaring them via the CLI recipe does **not** mean your app will pass review. Provide a clear in-product purpose and complete store declarations before shipping.
:::

### Purpose

| Kind | Purpose | Tags |
| ---- | ------- | ---- |
| `camera` | Capture photo / video | |
| `microphone` | Record audio / calls | |
| `photoRead` | Full read of the photo library | |
| `photoLimited` | Access a user-selected subset of the library | |
| `photoAdd` | Save to the library only (no read) | No runtime dialog (Android) |
| `locationWhenInUse` | Foreground / while-in-use location | |
| `locationAlways` | Background location (after when-in-use) | |
| `notification` | Local / remote push | |
| `contacts` | Read contacts | |
| `calendar` | Read calendar | |
| `tracking` | Ad / IDFA tracking (ATT) | No runtime dialog (Android → `granted`) |
| `bluetooth` | Nearby Bluetooth devices | |
| `speechRecognition` | Speech-to-text | Android maps to mic |
| `motion` | Activity / motion fitness | |
| `reminders` | Read / manage reminders | iOS-focused (Android → `restricted`) |
| `audioRead` | Read local audio / media library | |
| `biometrics` | Fingerprint / Face ID available & enrolled | No runtime dialog (`request` ≈ `check`) |
| `localNetwork` | Local network / Bonjour discovery | iOS-focused (Android → `granted`) |
| `sms` | Read SMS | Android-only · Strong compliance |
| `appList` | Query installed packages | Android-only · Strong compliance · No runtime dialog |

An unknown kind yields `INVALID_KIND`. The canonical list lives in `@bear1210/native-kit-protocol` (RN also exports the `PermissionKind` type; Flutter uses the `PermissionKind` enum).

### Platform mapping

| Kind | iOS | Android | Notes |
| ---- | --- | ------- | ----- |
| `camera` | `AVCaptureDevice` (.video) | `CAMERA` | |
| `microphone` | `AVCaptureDevice` (.audio) | `RECORD_AUDIO` | |
| `photoRead` | Full Photo Library | Full `READ_MEDIA_IMAGES` + `READ_MEDIA_VIDEO` (API 33+), else `READ_EXTERNAL_STORAGE` | Direct full read. If user only selected a range → `limited` (upgrade via Settings) |
| `photoLimited` | Selected / limited library | Same first dialog; API 34+ partial → `READ_MEDIA_VISUAL_USER_SELECTED` | Authorize an image range first. Re-`request` expands selection (iOS limited picker / Android 14+ selected) |
| `photoAdd` | Photo Library add-only | *(no runtime prompt)* | Android MediaStore insert typically needs no grant |
| `locationWhenInUse` | When-In-Use | `ACCESS_FINE` + `ACCESS_COARSE` | |
| `locationAlways` | Always | Foreground first, then `ACCESS_BACKGROUND_LOCATION` (API 29+) | Two-step on modern Android |
| `notification` | `UNUserNotificationCenter` | `POST_NOTIFICATIONS` (API 33+), else granted | iOS `check` is async (real settings) |
| `contacts` | `CNContactStore` | `READ_CONTACTS` | iOS 18 may return `limited` |
| `calendar` | `EKEventStore` (full access on iOS 17+) | `READ_CALENDAR` | iOS write-only maps to `limited` |
| `tracking` | App Tracking Transparency | *(no runtime equivalent → `granted`)* | Requires `NSUserTrackingUsageDescription` |
| `bluetooth` | `CBCentralManager` + `NSBluetoothAlwaysUsageDescription` | API 31+: `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`; older: location | Single kind requests scan+connect together |
| `speechRecognition` | `SFSpeechRecognizer` | `RECORD_AUDIO` (same as mic) | Often also needs microphone usage copy on iOS |
| `motion` | Motion & Fitness / `NSMotionUsageDescription` | `ACTIVITY_RECOGNITION` (API 29+), else granted | |
| `reminders` | `EKEventStore` reminders | **`restricted`** | No Android equivalent |
| `audioRead` | `MPMediaLibrary` / Apple Music usage | `READ_MEDIA_AUDIO` (API 33+) / storage | |
| `biometrics` | `LAContext` + Face ID usage | `BiometricManager.canAuthenticate` | Capability probe; no standard permission sheet |
| `localNetwork` | Local Network usage + Bonjour | **`granted`** | iOS has no precise preflight; may stay `notDetermined` until first use |
| `sms` | **`restricted`** | `READ_SMS` | Strong compliance |
| `appList` | **`restricted`** | Install-time `QUERY_ALL_PACKAGES` | `request` does not show a dialog; denied → `permanentlyDenied` |

### Photo library — pick the right kind

| Need | Kind | Success when |
| ---- | ---- | ------------ |
| Scan / read the whole library | `photoRead` | `granted` only (`limited` means user selected a subset — send them to Settings for full access) |
| User picks a subset first, then you read those assets | `photoLimited` | `granted` **or** `limited` (re-`request` to change / expand the selection) |

Both share the same first system dialog; the kind only changes how you treat `limited` and whether a later `request` re-opens the selection UI.

## Errors

| Code | When |
| ---- | ---- |
| `MODULE_NOT_LINKED` | Module not in `native-kit.config.json` / not linked |
| `INVALID_KIND` | Missing / unknown kind (bridge) |
| `NATIVE_UNAVAILABLE` | No activity / context for a request |
| `REQUEST_IN_PROGRESS` | Another request is already pending (Flutter) |

## React Native

Package: [`@bear1210/native-kit-rn`](https://github.com/TonyChan-hub/kippy/tree/main/packages/native_kit_rn).

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

// Examples
await ensureUsable('camera');
await ensureUsable('bluetooth');
await ensureUsable('speechRecognition');
await ensureUsable('audioRead');
await NativeKit.permission.ensure('biometrics'); // capability probe
// Android-only / strong compliance — gate behind product + store policy
await NativeKit.permission.ensure('sms');
await NativeKit.permission.ensure('appList');

// Read-only probe (no dialog)
const current = await NativeKit.permission.check('notification');
```

## Flutter

Package: `native_kit_flutter` (path / vendor zip, same pattern as `zippy_flutter`).

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

// Examples
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
