# Zippy inspector

Zippy is a **Tauri 2** desktop app with four top-level modes: **Git** (multi-repo + SSH profiles), **Inspector** (mobile debug data), **Tools** (adb / iOS Simulator shortcuts), and **APK** (local package playground). It ships via **GitHub Releases**, not npm.

Why it exists—manual logs → Logger → Zippy, plus Flipper / Reactotron / IDE comparisons: [Why Zippy exists](/blog/why-zippy).

<ZippyDownload locale="en" />

## Modes

### Git

Multi-repo workspace with per-repo identity / SSH profiles. Config is shared with GitSwitch at `~/.gitswitch/config.json` (legacy `~/.gitbench` still works). Only **local** git config is written — global `~/.gitconfig` is untouched. Requires system `git` on `PATH`.

| Area | What you can do |
| ---- | --------------- |
| Repos | Add / select / remove local repositories |
| Branches | List local / remote-tracking branches, filter, **switch branch** |
| Commits / Remotes | Browse recent commits and configured remotes |
| Profiles | Create / edit / delete identity profiles (`user.name` / `user.email` / SSH key), import known SSH keys, **apply to the current repo** |

Not included: fetch, push, create/delete branch, or changing global git config.

### Inspector

Connect to a mobile debug probe and browse in-app data.

| Panel | Data |
| ----- | ---- |
| **Device** | Connect to `host:port`, app / OS info |
| **MMKV / KV** | Registered key–value stores |
| **SQLite** | Registered databases — tables and row previews |
| **Network** | Captured HTTP (RN `attachFetch` / Flutter `attachDio`) |
| **Perf** | Lightweight performance samples from the probe |

Probe WebSocket path is always `/probe` (`ws://host:9876/probe`). Default port: **9876**.

### Tools

Whitelist wrappers around local `adb` and `xcrun simctl` (not an arbitrary shell). Pick a device, then run shortcuts.

| Area | What you can do |
| ---- | --------------- |
| Devices | List Android devices / AVDs and iOS Simulators; boot / shutdown |
| Ports | `adb forward` for the Zippy probe (default `9876`); `adb reverse` for Metro (default `8081`) |
| Capture | Screenshot, save PNG, screen record / stop |
| App | Install / uninstall / launch / restart / force-stop / clear data; list packages |
| Media / URL | Import gallery media, open deeplink / URL, type text (Android) |
| Env | Grant / revoke permissions, set GPS location, light / dark appearance |
| Logs | Stream `logcat` / `log stream` with Start / Stop and a filter |

| Action | Android | iOS Simulator |
| ------ | ------- | ------------- |
| List devices / AVDs | `adb devices -l`, `emulator -list-avds` | `simctl list devices available` |
| Boot / Shutdown | Start AVD / `adb reboot -p` | `simctl boot` / `shutdown` |
| Probe forward | `adb forward tcp:PORT tcp:PORT` (default `9876`) | N/A — use `127.0.0.1` |
| Metro reverse | `adb reverse tcp:PORT tcp:PORT` (default `8081`) | N/A |
| Screenshot / Record | `screencap` / `screenrecord` | `simctl io screenshot` / `recordVideo` |
| Install / Uninstall / Launch / Restart / Force stop | `adb install` / `uninstall` / `monkey` / `am force-stop` | `simctl install` / `uninstall` / `launch` / `terminate` |
| Clear data | `pm clear` | — (reinstall) |
| List packages | `pm list packages -3` | `simctl listapps` |
| Import media | `adb push` + media scan | `simctl addmedia` |
| Open URL | `am start -a VIEW -d` | `simctl openurl` |
| Type text | `input text` | — (Android only) |
| Permissions | `pm grant` / `revoke` | `simctl privacy grant` / `revoke` |
| Location | `adb emu geo fix` (emulator) | `simctl location set` |
| Appearance | `cmd uimode night` | `simctl ui appearance` |
| Logs | `adb logcat` (Start / Stop) | `simctl spawn … log stream` |

Requires Android platform-tools (`adb`, or `ANDROID_HOME`) and/or Xcode (`xcrun`). Packaged Zippy resolves common Homebrew / SDK paths when GUI `PATH` is incomplete.

Typical USB Android flow: **Tools → Forward** → **Inspector → Connect** to `127.0.0.1:9876`. For Metro on device, use **Reverse** (default `8081`).

### APK Playground {#apk-playground}

Offline analysis for local Android packages — no probe or device required. Drag-and-drop or open `.apk` / `.aab` / `.xapk` / `.apkm`.

Step-by-step usage and a pre-release checklist: [Using Zippy’s APK Playground](/blog/zippy-apk-playground).

| Tab | What you get |
| --- | ------------ |
| **Overview** | Package / version / SDK / ABI summary, plus quick metrics for obfuscation %, shrink %, DEX optimization score, and ZIP shrink |
| **Size** | Size share by category (DEX, native, `res`, assets, `resources.arsc`, Manifest, META-INF, other); install vs download size; top entries by size |
| **Size → DEX** | Per-DEX class / method / field / string counts; debug-info presence; optimization score (stripped debug + minify signals) |
| **Size → Obfuscation / Shrink** | Class-name obfuscation % (ProGuard/R8-style short names); ZIP shrink %; code shrink hint %; combined shrink % |
| **16 KB** | 16 KB page-size compatibility: ELF `PT_LOAD p_align ≥ 16384` and ZIP STORED data-offset alignment for `arm64-v8a` / `x86_64` |
| **Signing** | Signing schemes (v1 / v2 / v3 / v3.1 …) and certificate subject / fingerprints. AAB mainly surfaces JAR / v1 from `META-INF` |
| **Manifest** | Human-readable Manifest (APK binary AXML or AAB protobuf `XmlNode`), permissions, activities / services / receivers / providers |
| **Resources / Files** | Browse `assets`, `res/raw`, other `res`, `lib`, `dex`, `META-INF`; preview text and images. Binary Manifest entries are decoded (not shown as mojibake) |
| **Unpack** | Extract the whole archive to a chosen directory |

Notes:

- AAB modules (e.g. `base`, feature splits) appear in Overview.
- Obfuscation / shrink figures are **heuristic estimates** from DEX descriptors and ZIP compression — not a substitute for mapping files or Play Console size reports.
- 16 KB checks focus on 64-bit ABIs; apps with no native libs are treated as compatible.

## Prerequisites

- Node.js 20+
- Rust stable (`rustup`)
- System `git` (Git mode)
- `adb` / Xcode (Tools mode, optional until used)
- macOS (primary target)
- No extra Android SDK tools required for APK mode (analysis is pure Rust)

## Develop {#develop}

```bash
npm install
npm run zippy
```

## Build

```bash
npm run zippy:build
```

## Connect a probe

New apps from `@bear1210/create-rn-template` / `@bear1210/create-flutter-template` already wire Zippy in **debug** builds. Open Zippy → **Inspector** → **Device** → host/port → **Connect**.

### Host to use

| Target | Host in Zippy |
| ------ | ------------- |
| iOS Simulator / Android Emulator | `127.0.0.1` (often works; Android may need port mapping) |
| Physical Android | Device LAN IP, **or** `adb forward tcp:9876 tcp:9876` then `127.0.0.1` |
| Physical iOS | Device LAN IP (USB alone does not expose the probe port) |

Zippy runs on the **Mac** and must reach the probe on the **device**. For USB Android that means `adb forward` (host → device), **not** `adb reverse`.

```bash
adb forward tcp:9876 tcp:9876
# then connect Zippy Inspector to 127.0.0.1:9876
# or use Zippy → Tools → Forward
```

### React Native (`@bear1210/zippy-rn`)

```bash
npm install @bear1210/zippy-rn react-native-tcp-socket buffer
# peers for MMKV / SQLite panels (already in Kippy RN template):
# react-native-mmkv react-native-quick-sqlite
```

```tsx
import { open } from 'react-native-quick-sqlite';
import { ZippyProbe } from '@bear1210/zippy-rn';
import { readMmkvSnapshot } from '@/services/mmkvStorage'; // or your own reader

if (__DEV__) {
  ZippyProbe.registerMmkvStore('default', () => readMmkvSnapshot('default'));
  // Pass openDb so Metro resolves quick-sqlite from the app (not from zippy-rn):
  ZippyProbe.registerSqliteDatabase('app.db', 'app.db', () =>
    open({ name: 'app.db' }),
  );

  void ZippyProbe.start({
    appInfo: { name: 'MyApp', version: '0.0.1' },
  });
}

// Optional — wrap shared fetch for the Network panel:
const fetchWithZippy = ZippyProbe.attachFetch(fetch);
```

`ZippyProbe.start()` is a no-op outside `__DEV__` unless you pass `enabled: true`.

See [`packages/zippy_rn/README.md`](https://github.com/TonyChan-hub/kippy/tree/main/packages/zippy_rn).

### Flutter (`zippy_flutter` zip / path)

```yaml
dependencies:
  zippy_flutter:
    path: packages/zippy_flutter
```

```dart
await ZippyProbe.start(); // no-op outside debug unless ZIPPY_PROBE=true
ZippyProbe.attachDio(dio);

// Optional — only if auto-discovery misses a DB under documents:
ZippyProbe.registerSqliteDatabase('app.db', dbPath);
ZippyProbe.registerMmkvStore('session', () => {'token': '…'});
```

Pack with `bash packages/zippy_flutter/scripts/pack.sh`, or let `create-flutter-template` unpack its vendor zip. See [`packages/zippy_flutter/README.md`](https://github.com/TonyChan-hub/kippy/tree/main/packages/zippy_flutter).

## Releases

Bump `@bear1210/zippy` and push to `main` to trigger the Zippy release workflow. Packaged builds publish a `.dmg` plus `download.json` / `latest.json` to GitHub Releases; the docs site also mirrors the `.dmg` onto GitHub Pages so the download button above prefers that mirror when GitHub Releases CDN is unreachable.

### In-app updates

Packaged Zippy reads `https://github.com/TonyChan-hub/kippy/releases/latest/download/latest.json` via `tauri-plugin-updater`. Startup **checks only**; the banner under the mode bar lets you **Download**, then **Restart & install**. Dev mode does not auto-check. Updates need a Release that published updater signatures + `latest.json`; otherwise install the DMG from the download section above.

Current macOS runners produce an **Apple Silicon (aarch64)** installer (M1–M4). If GitHub download fails, use the primary docs button, or build locally with `npm run zippy:build`.

### DMG says “damaged”?

That is usually Gatekeeper rejecting an incomplete signature (the file itself is often fine). From **0.0.3** onward CI seals a full ad-hoc signature. For older builds:

```bash
xattr -cr ~/Downloads/Zippy_*.dmg
# after dragging to Applications:
xattr -cr /Applications/Zippy.app
codesign --force --deep --sign - /Applications/Zippy.app
open /Applications/Zippy.app
```

You may still need **Open Anyway** under System Settings → Privacy & Security on first launch.
