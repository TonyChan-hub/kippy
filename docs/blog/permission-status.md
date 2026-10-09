# Android & iOS permissions: what each status means

::: info
Tags: NativeKit · Permissions · Android · iOS  
Related: [Permission API](/guide/native-kit/permission) · [Platform declarations](/guide/native-kit/platform) · [Quick scaffold: three media permissions](/blog/quick-scaffold-media)
:::

The hard part of permissions is rarely “show the system dialog.” It is **what your product should do after the dialog**. Raw platform results are named differently and are not symmetric across Android and iOS. NativeKit normalizes them into six `status` values so app code can branch once.

This post focuses on one topic: **what each status means, how it maps on both platforms, and how UI should react.**

## The six statuses

| Status | One-liner | Can the system prompt again? | Typical next step |
| ------ | --------- | ---------------------------- | ----------------- |
| `notDetermined` | Never asked | Yes | `request` / `ensure` |
| `granted` | Fully allowed | Not needed | Use the capability |
| `limited` | Partially allowed | Depends | Treat as usable in most flows; Settings if you need full access |
| `denied` | Denied, but may ask again | Maybe | `request`, or explain then retry |
| `permanentlyDenied` | Locked out of the system sheet | No | `openSettings()` |
| `restricted` | OS / MDM block, **or** no capability on this platform | No | Degrade; do not keep requesting |

Unless the product truly needs *full* library / contacts access, treat **`granted` and `limited` as success**. That matches modern privacy UX on both platforms.

## State machine for product code

```text
                    check()
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
 notDetermined     granted       limited ──► usable (most cases)
        │             ▲
        │             │
        ▼             │
     request() ───────┘
        │
        ├── granted / limited
        ├── denied ──────────────► may request again (or explain first)
        ├── permanentlyDenied ───► openSettings()
        └── restricted ──────────► degrade / hide entry
```

`ensure(kind)` means:

1. `check` first
2. `request` only when status is `denied` or `notDetermined`
3. For `permanentlyDenied` / `restricted` / already `granted`·`limited` → **no dialog**, return as-is

So `ensure` does not mean “guaranteed grant.” It means “ask again only while asking is still possible.”

## Status by status

### `notDetermined` — not asked yet

The user has never seen the system permission UI (or the equivalent undecided state).

| Platform | Typical source |
| -------- | -------------- |
| iOS | `AVAuthorizationStatus.notDetermined`, `PHAuthorizationStatus.notDetermined`, ATT `notDetermined`, … |
| Android | Runtime permission not granted; often the first-time path where a request can still show a sheet |

**Product tip:** Show your own purpose copy, then `request`. Avoid stacking system dialogs on first paint.

### `granted` — allowed

Full access (or enough access for that `kind`).

| Platform | Typical source |
| -------- | -------------- |
| iOS | `.authorized` / `.authorizedAlways` / ATT `.authorized`, … |
| Android | `PackageManager.PERMISSION_GRANTED` |

**Product tip:** Call the camera, location, or library APIs directly.

### `limited` — partial access

Central to modern privacy models — **especially iOS**; Android 14+ selected media is in the same family.

Examples:

- iOS “Selected Photos” → `limited`
- Newer iOS limited contacts → `limited`
- iOS calendar write-only → mapped to `limited` in NativeKit
- Android 14+ partial media grants in a `photoLimited` flow → treat like `limited`

**Product tip:**

| Need | How to treat `limited` |
| ---- | ---------------------- |
| User picks a subset, then you read it | **Success** (`photoLimited`) |
| Must scan the whole library | **Not enough** (`photoRead`); send user to Settings for full access |
| Ordinary capture / use | Usually success |

### `denied` — refused, but maybe not forever

The user tapped Don’t Allow, but the OS has **not** necessarily locked you into Settings-only.

| Platform | Nuance |
| -------- | ------ |
| iOS | After the first denial, many APIs will not show the sheet again — behavior is close to permanent; NativeKit leans toward `permanentlyDenied` when possible, but you may still see `denied` on some paths |
| Android | After a soft denial, `shouldShowRequestPermissionRationale == true` means another `request` can show the sheet — the cleanest `denied` case |

**Product tip:** Explain why you need the permission, then offer “Continue” → `request`. Do not silently loop `request`.

### `permanentlyDenied` — Settings only

The standard permission sheet will not appear again.

| Platform | Common signal |
| -------- | ------------- |
| iOS | Already denied; further requests are no-ops; or toggled off in Settings |
| Android | “Don’t ask again,” or disabled in Settings. Often: not granted and `shouldShowRequestPermissionRationale == false` after a prior ask |

**Product tip:** Your own dialog → “Open Settings” → `openSettings()`. Do **not** expect `request` to resurrect the system sheet.

### `restricted` — blocked or unsupported

Two different realities share one status:

1. **OS / parental controls / MDM** forbid the capability
2. **This platform has no equivalent API** (NativeKit cross-platform convention)

| Example | Result |
| ------- | ------ |
| `sms` / `appList` on iOS | `restricted` |
| `reminders` on Android | `restricted` |
| Camera disabled by MDM | `restricted` |

**Product tip:** Hide the feature or show “Unavailable on this device.” Do not send users to Settings (often useless), and do not spam `request`.

::: tip Why not a separate `unsupported`?
Call sites already branch on “cannot use this capability.” A seventh status forces every screen to handle another case. Keep `restricted` for “unusable here,” and document Android-only / iOS-focused kinds in the API tables.
:::

## Android vs iOS: easy mix-ups

| Intent | Android | iOS | NativeKit status |
| ------ | ------- | --- | ---------------- |
| Never asked | Not granted, can still prompt | `notDetermined` | `notDetermined` (or still-requestable `denied`) |
| Denied once | Often can prompt again (rationale) | Many permissions never re-prompt | `denied` → quickly becomes / acts like `permanentlyDenied` |
| “Don’t ask again” | Explicit | No checkbox; similar permanent effect | `permanentlyDenied` |
| Partial photos | API 34+ selected media | Selected Photos | `limited` |
| No platform API | Kind maps to `granted` or `restricted` | Same | See kind table — **not** a user denial |

Do not force Android’s “ask again” mental model onto iOS, and do not treat “unsupported on this OS” as “the user tapped Deny.”

## Suggested UI branching

```ts
async function onNeedCamera() {
  const status = await NativeKit.permission.ensure('camera');

  switch (status) {
    case 'granted':
    case 'limited': // camera is rarely limited; harmless to handle
      return openCamera();

    case 'denied':
      return showExplainSheet({
        onRetry: () => NativeKit.permission.request('camera'),
      });

    case 'permanentlyDenied':
      return showGoSettings({
        onConfirm: () => NativeKit.permission.openSettings(),
      });

    case 'restricted':
      return showUnavailable('Camera is not available on this device');

    case 'notDetermined':
      return NativeKit.permission.request('camera');
  }
}
```

Photos need the right `kind`:

```ts
// Subset is enough
const s = await NativeKit.permission.ensure('photoLimited');
if (s === 'granted' || s === 'limited') { /* OK */ }

// Full library required
const full = await NativeKit.permission.ensure('photoRead');
if (full === 'granted') { /* OK */ }
if (full === 'limited' || full === 'permanentlyDenied') {
  await NativeKit.permission.openSettings();
}
```

## How this ties to `check` / `request` / `ensure`

| Method | Changes system state? | When to use |
| ------ | --------------------- | ----------- |
| `check` | No | Prefetch UI copy / button state |
| `request` | May show a sheet | After an explicit user action |
| `ensure` | Only if still askable | Default for most feature entry points |
| `openSettings` | Leaves the app | `permanentlyDenied`, or upgrade `limited` → full |

**Explain in the app; decide in the system.** Status tells you which step you are on — it does not promise a grant.

## Takeaways

| Status | Remember |
| ------ | -------- |
| `notDetermined` | Not asked yet |
| `granted` | Good to go |
| `limited` | Partial; product decides if enough |
| `denied` | Refused; maybe ask again |
| `permanentlyDenied` | Stop prompting; open Settings |
| `restricted` | Asking will not help (blocked or unsupported) |

Master these six values and most dual-end permission branches collapse into one `switch`. Kind mapping and photo-library choice: [Permission API](/guide/native-kit/permission).
