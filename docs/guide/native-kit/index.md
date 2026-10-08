# NativeKit (Beta)

::: warning Experimental / Beta
NativeKit is **still experimental**. API shapes, module IDs, recipes, and packaging may change without a stable compatibility promise. Use only on opt-in / non-critical paths until it graduates out of beta.
:::

NativeKit is a **uni-style** facade for common dual-end native capabilities. Apps call a stable JS/Dart API (`NativeKit.permission.*`, `NativeKit.device.*`); Kotlin / Swift implementations are linked **only for modules you enable**.

| Status | Module | APIs |
| ------ | ------ | ---- |
| Beta | `permission` | `check` / `request` / `ensure` / `openSettings` |
| Beta | `device` | `getInfo` (public fields; not a permission) |
| Roadmap | `camera`, `media` | — |

## Docs map

| Page | Contents |
| ---- | -------- |
| [Install](./install) | Scaffold / later opt-in, config, deps & rebuild |
| [Permission API](./permission) | Methods, statuses, kinds (incl. Android-only / strong compliance tags), errors |
| [Device API](./device) | Public device / app info (no runtime permission) |
| [Platform declarations](./platform) | Info.plist / AndroidManifest recipe keys |

## vs Zippy Tools

| Layer | Role |
| ----- | ---- |
| **NativeKit** | In-app runtime: ask the user for camera, mic, photos, location, notifications, contacts, calendar, ATT, bluetooth, … |
| **[Zippy Tools](../zippy#tools)** | Debug-time `adb` / `simctl` grant & revoke — does **not** go through NativeKit |

Do not mix the two APIs.

## Packages

| Package | Publish | Role |
| ------- | ------- | ---- |
| `@bear1210/native-kit-protocol` | npm | Module IDs, kinds, statuses, recipes |
| `native_kit` | path | Kotlin / Swift module sources |
| `@bear1210/native-kit-rn` | npm | RN facade + native bridge |
| `native_kit_flutter` | zip / path | Flutter facade + plugin |
| `@bear1210/native-kit` | npm | `add` / `remove` / `list` CLI |

## Roadmap

Future modules (not shipped): `camera` (capture helpers), `media` (gallery save / pick). The facade will grow as `NativeKit.<module>.*` without breaking `permission` / `device`.
