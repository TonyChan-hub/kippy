# NativeKit: designing a dual-end permission facade

::: info
Tags: NativeKit · Permissions · Architecture  
Related: [NativeKit overview](/guide/native-kit/) · [Permission API](/guide/native-kit/permission) · [Device API](/guide/native-kit/device)
:::

AppSetup scaffolds stay business-free, but real apps almost always need permissions and device info. NativeKit is not another mega-SDK — it is an **opt-in, modular facade**: one JS/Dart API surface, platform-specific mapping underneath.

## Unify `kind`, not system permission names

Call sites use cross-platform ids such as `'camera'`, `'bluetooth'`, or `'sms'` — never `CAMERA` or `NSCameraUsageDescription`.

That buys you:

1. One wire protocol for RN (TS) and Flutter (Dart) via `@bear1210/native-kit-protocol`
2. CLI / scaffold recipes that inject Manifest / Info.plist without leaking platform names into product code
3. Docs that can explain purpose → iOS → Android in a single table

The status set stays small: `granted` / `denied` / `permanentlyDenied` / `restricted` / `limited` / `notDetermined`. When a platform cannot support a capability, we reuse `restricted` instead of inventing `unsupported`, so `ensure` branching stays familiar.

## Sensitive capabilities must be usable *and* labeled

SMS and full package queries exist on Android but are review-sensitive; iOS often has no equivalent. NativeKit:

- Still exposes kinds like `sms` / `appList` for products that truly need them
- Labels them **Android-only · strong compliance** in docs and recipes
- Returns `restricted` on iOS for `check` / `request`
- Stresses that **Manifest injection ≠ store approval**

Public device fields live in a separate module, `NativeKit.device.getInfo()`: brand / model / OS / bundle id only — no IMEI or phone number, and not framed as a permission.

## Dual native copies by design

Canonical logic lives in `packages/native_kit`, then is copied into `native_kit_rn` / `native_kit_flutter`. Bridges stay thin (Promise / MethodChannel); kind mapping sits in Kotlin / Swift `PermissionManager`.

`getLinkedModules` is still a hardcoded shipped list today; true compile-time stripping from `native-kit.config.json` is future work and does not change the facade shape.

## Takeaways

| Choice | Why |
| ------ | --- |
| Unified kind + mapping tables | Lowest cognitive load for apps |
| Keep sensitive kinds, label hard | Do not fake cross-platform symmetry |
| Separate `device` module | Reading model ≠ requesting a permission |
| No `unsupported` status | Keep existing ensure / UI branches |

To enable NativeKit in a scaffold, start at [Install](/guide/native-kit/install).
