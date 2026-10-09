# What the env helper does: a brand-new Mac / Mac mini, ready to run

::: info
Tags: Kippy · Environment · macOS · Android · iOS  
Related: [Setup Android / iOS env](/guide/env-setup) · [Check mobile environment](/guide/check-env) · [What is Kippy?](/guide/getting-started)
:::

The slow part of a new machine is not the first product line—it is lining up **Node, JDK, Android SDK, Xcode licenses, simulators, and CocoaPods**, plus mirrors in mainland China. Kippy’s env helper is three **global, project-free** macOS commands: install Android, install iOS extras, then diagnose.

Goal: **unbox a Mac or Mac mini, follow this order, then `npm run android` / `npm run ios`.**

## What the helper actually is

All three commands live on `@bear1210/create-rn-template` (use `npx -p` so you do not need an app yet):

| Command | Job |
| ------- | --- |
| `setup-rn-android-env` | Homebrew / Node / Watchman / Temurin JDK 21 / Android cmdline-tools; accept licenses; SDK 36, build-tools, NDK, emulator; default AVD |
| `setup-rn-ios-env` | **Requires Xcode.app already**; `xcode-select`, accept license, download iOS Simulator; git / node / watchman / CocoaPods / Ruby / Bundler |
| `check-mobile-env` | Read-only report: Common / Android / iOS / RN / Flutter as ok / warn / missing |

It **does not install Android Studio**—Android uses command-line tools. Xcode cannot be scripted from the App Store; install it first.

Env vars are appended to `~/.zprofile` (`JAVA_HOME`, `ANDROID_HOME`, brew PATH). Re-runs are safe: existing brew, AVDs, and packages are skipped or reinstalled.

## Two things only you can do

1. **Sign in with an Apple ID** and install **Xcode** from the App Store (start this first—it is huge). Open it once so extra components finish.
2. **Network:** a mainland-China IP auto-selects USTC Homebrew, npmmirror, and RubyGems China. **Android SDK packages still come from Google (`dl.google.com`)**. If that hangs, change network/VPN and re-run the same command.

Defaults assume **Apple Silicon** (`arm64-v8a` system image). On Intel, change `ANDROID_SYSTEM_IMAGE` in the script to `x86_64`.

## Unbox sequence (do it once)

Keep the machine plugged in; Homebrew, SDK, and Simulator downloads take a while.

### 0. System

- Current macOS; **40GB+** free (Xcode + SDK + simulators).
- Terminal may need network permission. The Android script pipes `yes` into `sdkmanager --licenses`.
- iOS setup needs an **admin password** (`sudo xcode-select` / `xcodebuild -license`).

### 1. Install Xcode (the only non-scripted step)

App Store → Xcode → open → accept the license. Confirm:

```bash
ls /Applications/Xcode.app
```

### 2. Android toolchain (no Studio)

```bash
npx -p @bear1210/create-rn-template setup-rn-android-env
```

It will:

1. Detect public-IP country and pick mirrors  
2. Install Homebrew if missing and persist `brew shellenv` in `~/.zprofile`  
3. `brew install git node watchman` (Node ≥ 20)  
4. `brew install --cask temurin@21` and set `JAVA_HOME`  
5. Install `android-commandlinetools` and link into `~/Library/Android/sdk`  
6. Accept licenses and install:
   - `platform-tools`
   - `platforms;android-36`
   - `build-tools;36.0.0`
   - `ndk;27.1.12297006`
   - `emulator` + `cmdline-tools;latest`
   - `system-images;android-36;google_apis;arm64-v8a`
7. Create AVD **`Pixel_API36`** (device `pixel_6`) if needed

Then **open a new terminal** (or `source ~/.zprofile`).

Force China mirrors:

```bash
RN_SETUP_MIRROR=cn npx -p @bear1210/create-rn-template setup-rn-android-env
```

### 3. iOS extras

```bash
npx -p @bear1210/create-rn-template setup-rn-ios-env
```

Points `xcode-select` at `/Applications/Xcode.app`, accepts the Xcode license, runs `-runFirstLaunch`, downloads the iOS platform (long; safe to retry), then CocoaPods / brew Ruby / Bundler.

### 4. Diagnose

```bash
npx -p @bear1210/create-rn-template check-mobile-env
```

Fix **missing**. Watchman, AVDs, and Flutter are usually warnings. Skip `--strict-flutter` unless you require Flutter.

```bash
npx -p @bear1210/create-rn-template check-mobile-env --json
```

### 5. Create an app

```bash
npx @bear1210/create-rn-template MyNewApp --package=com.example.mynewapp
cd MyNewApp
npm start
# other terminal:
emulator -avd Pixel_API36 &
adb wait-for-device
npm run android
```

iOS:

```bash
cd ios && RCT_NEW_ARCH_ENABLED=0 pod install && cd ..
npm run ios
```

Put the Flutter SDK on `PATH` yourself before `create-flutter-template`. The helper **does not install Flutter**.

## What lands on disk

| Piece | Where |
| ----- | ----- |
| Homebrew | Apple Silicon: `/opt/homebrew` |
| Node / Watchman / git | brew |
| JDK 21 | Temurin cask; `JAVA_HOME` via `java_home -v 21` |
| Android SDK | `~/Library/Android/sdk` |
| Default AVD | `Pixel_API36` |
| PATH / env | `~/.zprofile` |
| CocoaPods / Ruby | brew; gem PATH in zprofile |

This is machine-global. New clones share the same SDK.

## vs Android Studio

| | Env helper | Android Studio |
| --- | --- | --- |
| SDK / JDK / emulator | CLI pinned to the RN 0.81 template | GUI; versions drift |
| IDE | None | Installed |
| Mirrors | Homebrew / npm / gem auto | You configure |
| iOS | Separate command + Xcode required | Not iOS |

[Zippy](/guide/zippy) can later drive adb / emulators; it is a desktop inspector, not a toolchain installer.

## Pitfalls

| Symptom | What to do |
| ------- | ---------- |
| iOS setup: no Xcode.app | Install Xcode first |
| SDK download hangs | Google is flaky from CN; retry the same command on another network |
| Intel emulator fails | Script defaults to `arm64-v8a`; switch `ANDROID_SYSTEM_IMAGE` to x86_64 |
| New shell has no `adb` | `source ~/.zprofile` |
| `check-mobile-env` exit 1 | Required missing; run the matching android / ios setup |
| sudo password | iOS xcode-select / license only; Android setup usually no sudo |

## Takeaway

Shortest path on a new Mac / Mac mini:

```text
Install Xcode from the App Store
        │
        ├─ setup-rn-android-env   → JDK + SDK 36 + Pixel_API36
        ├─ setup-rn-ios-env       → license, Simulator, CocoaPods
        └─ check-mobile-env       → no missing
                │
                └─ create-rn-template / create-flutter-template
```

The helper is the **global toolchain**. After that, scaffold commands can actually start a project in one shot.
