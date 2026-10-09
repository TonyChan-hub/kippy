# 环境助手做了什么：全新 Mac / Mac mini 开箱即用

::: info
标签：Kippy · 环境 · macOS · Android · iOS  
相关文档：[配置 Android / iOS 环境](/zh/guide/env-setup) · [检查移动端环境](/zh/guide/check-env) · [什么是 Kippy？](/zh/guide/getting-started)
:::

新机器最耗时间的不是写第一行业务代码，而是把 **Node、JDK、Android SDK、Xcode 许可、模拟器、CocoaPods** 凑齐，还要处理国内镜像。Kippy 的「环境助手」就是三套 **全局、与项目无关** 的 macOS 命令：装 Android、装 iOS 周边、再检查一遍。

目标：**拆封一台 Mac 或 Mac mini，按本文顺序跑完，就能 `npm run android` / `npm run ios`。**

## 助手到底是什么

三条命令都挂在 `@bear1210/create-rn-template` 上（用 `npx -p` 临时拉包，不必先建工程）：

| 命令 | 职责 |
| ---- | ---- |
| `setup-rn-android-env` | 装 Homebrew / Node / Watchman / Temurin JDK 21 / Android cmdline-tools；接受许可；装 SDK 36、build-tools、NDK、模拟器；建默认 AVD |
| `setup-rn-ios-env` | **假定已有 Xcode.app**；`xcode-select`、接受许可、下载 iOS Simulator；装 git / node / watchman / CocoaPods / Ruby / Bundler |
| `check-mobile-env` | 只读体检：Common / Android / iOS / RN / Flutter，给出 ok / warn / missing |

刻意**不装 Android Studio**，Android 走 command-line tools。iOS 无法脚本安装 Xcode，必须先从 App Store 装好。

环境变量写进 `~/.zprofile`（`JAVA_HOME`、`ANDROID_HOME`、brew PATH），可重复执行：已存在的 Homebrew、AVD、包会跳过或覆盖安装。

## 全新机器：你要先自己做的两件事

脚本解决不了账号与硬件商店：

1. **登录 Apple ID**，从 App Store 安装 **Xcode**（体积大，先下）。装完打开一次，等附加组件跑完。
2. **网络**：国内 IP 会自动切 USTC Homebrew、npmmirror、RubyGems 中国源。**Android SDK 包仍走 Google（`dl.google.com`）**，卡住就换网络 / VPN 后重跑同一条命令。

其余默认按 **Apple Silicon**（`arm64-v8a` 系统镜像）。Intel Mac 需自行改脚本里的 `ANDROID_SYSTEM_IMAGE` 为 `x86_64`。

系统自带的 `python3` / `git` 不够用时，脚本会用 Homebrew 补齐 Node 20+、git、watchman。

## 开箱顺序（建议一次做完）

终端里执行即可；首次 Homebrew / SDK / Simulator 会较久，适合插电、别关盖。

### 0. 系统准备

- macOS 当前版本，磁盘至少预留 **40GB+**（Xcode + SDK + 模拟器）。
- 允许终端访问网络；Android 脚本里 `sdkmanager --licenses` 会用 `yes` 自动同意许可。
- iOS 步骤需要 **管理员密码**（`sudo xcode-select` / `xcodebuild -license`）。

### 1. 先装 Xcode（只这一步不能脚本化）

App Store → Xcode → 打开 → 同意许可。确认：

```bash
ls /Applications/Xcode.app
```

### 2. 装 Android 工具链（可不装 Studio）

```bash
npx -p @bear1210/create-rn-template setup-rn-android-env
```

它会依次：

1. 探测公网国家，选择镜像  
2. 没有 Homebrew 就安装，并 `eval brew shellenv` 写入 `~/.zprofile`  
3. `brew install git node watchman`，要求 Node ≥ 20  
4. `brew install --cask temurin@21`，设置 `JAVA_HOME`  
5. `android-commandlinetools`，链接到 `~/Library/Android/sdk`  
6. 接受 SDK 许可，安装：
   - `platform-tools`
   - `platforms;android-36`
   - `build-tools;36.0.0`
   - `ndk;27.1.12297006`
   - `emulator` + `cmdline-tools;latest`
   - `system-images;android-36;google_apis;arm64-v8a`
7. 没有则创建 AVD **`Pixel_API36`**（设备 `pixel_6`）

结束后 **开一个新终端**（或 `source ~/.zprofile`），再继续。

强制国内源：

```bash
RN_SETUP_MIRROR=cn npx -p @bear1210/create-rn-template setup-rn-android-env
```

### 3. 装 iOS 周边

```bash
npx -p @bear1210/create-rn-template setup-rn-ios-env
```

会：指向 `/Applications/Xcode.app`、接受 Xcode 许可、`xcodebuild -runFirstLaunch`、`xcodebuild -downloadPlatform iOS`（可能很久，失败可重跑），再装 CocoaPods / brew Ruby / Bundler。

### 4. 体检

```bash
npx -p @bear1210/create-rn-template check-mobile-env
```

关注 **missing**。`watchman`、AVD、Flutter 多为 warn。只要做 RN、不装 Flutter，不必 `--strict-flutter`。

机器可读：

```bash
npx -p @bear1210/create-rn-template check-mobile-env --json
```

### 5. 再开工程

```bash
npx @bear1210/create-rn-template MyNewApp --package=com.example.mynewapp
cd MyNewApp
npm start
# 另一个终端：
emulator -avd Pixel_API36 &
adb wait-for-device
npm run android
```

iOS：

```bash
cd ios && RCT_NEW_ARCH_ENABLED=0 pod install && cd ..
npm run ios
```

Flutter 需自行把 Flutter SDK 放进 `PATH` 后再 `npx @bear1210/create-flutter-template …`。助手**不安装 Flutter**。

## 装完机器上会有什么

| 类别 | 落点 |
| ---- | ---- |
| Homebrew | Apple Silicon：`/opt/homebrew` |
| Node / Watchman / git | brew |
| JDK 21 | Temurin cask；`JAVA_HOME` via `java_home -v 21` |
| Android SDK | `~/Library/Android/sdk` |
| 默认模拟器 | `Pixel_API36` |
| PATH / 环境变量 | `~/.zprofile` |
| CocoaPods / Ruby | brew；gem PATH 同样写入 zprofile |

与业务仓库无关：换目录、新 clone 的 RN 工程共用同一套 SDK。

## 和「装 Android Studio」的差别

| | 环境助手 | Android Studio |
| --- | --- | --- |
| SDK / JDK / 模拟器 | 命令行一次对齐 RN 0.81 模板版本 | GUI，版本容易和模板不一致 |
| IDE | 不装 | 要装 |
| 国内镜像 | Homebrew / npm / gem 自动 | 仍要自己配 |
| iOS | 另条命令 + 必须已有 Xcode | 不管 iOS |

日常调试还可以再装 [Zippy](/zh/guide/zippy)（adb / 模拟器快捷操作），那是桌面工具，不是工具链安装器。

## 常见卡点

| 现象 | 处理 |
| ---- | ---- |
| `setup-rn-ios-env` 报找不到 Xcode.app | 先装完 Xcode 再跑 |
| SDK 下载卡住 | 国内访问 Google 不稳定；换网后**重跑同一命令** |
| Intel Mac 模拟器起不来 | 脚本默认 `arm64-v8a`，改 `ANDROID_SYSTEM_IMAGE` 为 x86_64 |
| 新开终端仍没有 `adb` | `source ~/.zprofile`，确认 brew 与 `ANDROID_HOME` 已写入 |
| `check-mobile-env` 退出码 1 | 有 required missing；看分区后对症跑 android / ios setup |
| 需要 sudo 密码 | 仅 iOS 的 xcode-select / license；Android 脚本一般不 sudo |

## 小结

全新 Mac / Mac mini 的最短路径：

```text
App Store 安装 Xcode
        │
        ├─ setup-rn-android-env   → JDK + SDK 36 + Pixel_API36
        ├─ setup-rn-ios-env       → 许可、Simulator、CocoaPods
        └─ check-mobile-env       → 没有 missing
                │
                └─ create-rn-template / create-flutter-template
```

助手做的是**全局工具链**，不是项目脚手架。开箱后脚手架命令才能真正「一条命令开工」。
