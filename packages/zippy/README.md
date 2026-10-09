# @bear1210/zippy

Tauri 2 desktop tool with four modes:

- **Git** — multi-repo branch management + per-repo identity / SSH profiles (GitSwitch-compatible config at `~/.gitswitch/config.json`)
- **Inspector** — mobile app debug data (MMKV / SQLite / network / perf)
- **Tools** — adb / iOS Simulator shortcuts (devices, ports, capture, app, media, env, logs)
- **APK** — local APK / AAB playground (unpack, 16 KB check, signing, Manifest, resources, size / DEX / obfuscation analysis)

Full feature guide (EN / 中文): [docs Zippy page](https://tonychan-hub.github.io/kippy/guide/zippy).

## Prerequisites

- Node.js 20+
- Rust stable (`rustup`)
- System `git` on `PATH` (for Git mode)
- `adb` / Xcode (for Tools mode, optional until used)
- macOS (primary target)

## Develop

From repo root:

```bash
npm install
npm run zippy
```

Or from this package:

```bash
npm run dev -w @bear1210/zippy
```

## Build

```bash
npm run zippy:build
```

Release builds sign updater artifacts with `TAURI_SIGNING_PRIVATE_KEY` (and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). Generate a keypair once:

```bash
cd packages/zippy
npx tauri signer generate -w src-tauri/.updater-key --ci -p ""
```

Then:

1. Put the **printed public key** into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
2. In GitHub → **Settings → Secrets and variables → Actions → Repository secrets** (not Environment secrets):
   - `TAURI_SIGNING_PRIVATE_KEY` = contents of `.updater-key` (often one-line base64; must decode to a minisign secret starting with `untrusted comment:`)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = leave unset / empty if you used `-p ""`

CI must pass the **key string** via `TAURI_SIGNING_PRIVATE_KEY` (not a file path). A path belongs in `TAURI_SIGNING_PRIVATE_KEY_PATH` only. If signing is skipped, the Release still gets a `.dmg`, but **no `latest.json`** — in-app update then fails with `Could not fetch a valid release JSON from the remote`.

## Modes

### Git

| Area | Role |
| ---- | ---- |
| Repos | Add / select local git repositories |
| Branches / Commits / Remotes | View status and **switch branches** |
| Profiles | Manage identity / SSH and **apply to current repo** (local config only) |

No fetch / push / create / delete branch. Does not change global `~/.gitconfig`. Existing GitSwitch data in `~/.gitswitch` (or legacy `~/.gitbench`) is reused.

### Inspector

| Panel | Role |
| ----- | ---- |
| **Device** | Connect to `host:port` + app / OS info |
| **MMKV / KV** | Browse registered key–value stores |
| **SQLite** | List tables and preview rows |
| **Network** | Captured HTTP from `attachFetch` / `attachDio` |
| **Perf** | Lightweight samples from the probe |

### Tools

| Action | Role |
| ------ | ---- |
| Devices / AVDs | List Android + iOS Simulator targets; boot / shutdown |
| Ports | `adb forward` (probe) + `adb reverse` (Metro) |
| Capture | Screenshot + screen record |
| App | Install / uninstall / launch / restart / force-stop / clear data + package list |
| Media / URL | Import gallery media, open deeplinks, type text (Android) |
| Env | Permissions, GPS location, light/dark appearance |
| Logs | Stream `logcat` / `log stream` with Start / Stop |

### APK Playground

Drop or open a local `.apk` / `.aab` / `.xapk` / `.apkm` (no device / probe required). Walkthrough: [APK Playground usage](../../docs/zh/blog/zippy-apk-playground.md) (中文) / [EN](../../docs/blog/zippy-apk-playground.md).

| Tab | Role |
| --- | ---- |
| Overview | Package summary + quick metrics (obfuscation / shrink / DEX score / ZIP shrink) |
| Size | Category size share, DEX optimization, obfuscation %, shrink %, top entries |
| 16 KB | ELF `p_align` + ZIP STORED offset checks for `arm64-v8a` / `x86_64` |
| Signing | v1–v3.1 schemes and certificate fingerprints (AAB: JAR/v1 detection) |
| Manifest | Decoded `AndroidManifest.xml` (binary AXML or AAB protobuf), permissions, components |
| Resources / Files | Browse `assets` / `res/raw` / `lib` / `dex` / `META-INF`, preview text & images |
| Unpack | Extract the archive to a chosen folder |

## Connect to a mobile probe

1. **Flutter:** add `zippy_flutter` and call `await ZippyProbe.start()` in debug (scaffolds do this by default).
2. **React Native:** add `@bear1210/zippy-rn` and call `ZippyProbe.start()` in `__DEV__` (scaffolds also register MMKV / SQLite with app `openDb`).
3. Run the app on a device/emulator reachable from your Mac.
4. Open Zippy → **Inspector** → **Device** → enter host/port (default `9876`) → **Connect**.

| Target | Host |
| ------ | ---- |
| iOS Simulator / Android Emulator | `127.0.0.1` |
| Physical Android | LAN IP, or `adb forward tcp:9876 tcp:9876` then `127.0.0.1` |
| Physical iOS | LAN IP (USB alone does not expose the probe port) |

Use `adb forward` (host → device), not `reverse`. WebSocket path: `ws://host:9876/probe`.

See [`../zippy_flutter/README.md`](../zippy_flutter/README.md) and [`../zippy_rn/README.md`](../zippy_rn/README.md) for SDK details. Full guide: [docs/guide/zippy.md](../../docs/guide/zippy.md).

## Auto-update & docs download

Packaged macOS builds use `tauri-plugin-updater` with GitHub Releases (`zippy-v{version}` tags), `latest.json` (updater), and `download.json` (docs site download panel). Bump this package version and push to `main` to trigger [`.github/workflows/zippy-release.yml`](../../.github/workflows/zippy-release.yml).

**In-app flow (packaged builds only):**

1. On startup Zippy **checks** `…/releases/latest/download/latest.json` (no download).
2. A global banner offers **Download** when a newer version exists.
3. After download completes, **Restart & install** applies the update.

Dev (`tauri dev`) skips the startup check; manual Check still works but often fails without a public release. In-app update requires that Release to publish **updater signatures** + `latest.json` (`TAURI_SIGNING_PRIVATE_KEY`). Without them, the DMG still ships — users install from the [docs Zippy page](https://tonychan-hub.github.io/kippy/guide/zippy#download).

Keep `package.json` and `src-tauri/tauri.conf.json` versions aligned; CI syncs `tauri.conf.json` from `package.json` before each build.

After a release, users can download the `.dmg` from the [docs Zippy page](https://tonychan-hub.github.io/kippy/guide/zippy#download).

macOS builds use **ad-hoc** Apple code signing (`signingIdentity: "-"`) so Apple Silicon Gatekeeper does not show a false “damaged” dialog after download. First launch may still need **right-click → Open** (or System Settings → Privacy & Security → Open Anyway). Full Developer ID + notarization is not required for Phase 1. Updater signatures (minisign) are separate from Apple code signing.

If an older DMG still says “damaged”, clear quarantine then open:

```bash
xattr -cr ~/Downloads/Zippy_*.dmg
# after dragging to Applications:
xattr -cr /Applications/Zippy.app
codesign --force --deep --sign - /Applications/Zippy.app
```

## Version

This package is **private** (not published to npm). Bump the version to cut a GitHub Release:

```bash
npm version patch -w @bear1210/zippy
```
