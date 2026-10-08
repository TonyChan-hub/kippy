# 包一览

| 包 | 发布方式 | 作用 |
| -- | -------- | ---- |
| [`@bear1210/create-rn-template`](https://www.npmjs.com/package/@bear1210/create-rn-template) | npm | RN 脚手架 CLI + 环境配置 / 检查命令 |
| [`@bear1210/create-flutter-template`](https://www.npmjs.com/package/@bear1210/create-flutter-template) | npm | Flutter 脚手架 CLI（内嵌 `zippy_flutter` vendor zip） |
| [`@bear1210/zippy`](/zh/guide/zippy) | GitHub Releases | Tauri 桌面工具 — Git / Inspector / Tools（[下载](/zh/guide/zippy#download)） |
| `@bear1210/zippy-probe-protocol` | npm | 共享 JSON probe 协议 |
| [`@bear1210/zippy-rn`](https://www.npmjs.com/package/@bear1210/zippy-rn) | npm | React Native 调试 probe SDK（[README](https://github.com/TonyChan-hub/kippy/tree/main/packages/zippy_rn)） |
| `zippy_flutter` | zip / path | Flutter 调试 probe SDK（[README](https://github.com/TonyChan-hub/kippy/tree/main/packages/zippy_flutter)） |
| [`@bear1210/native-kit-protocol`](https://github.com/TonyChan-hub/kippy/tree/main/packages/native-kit-protocol) | npm | NativeKit **（Beta）** 模块 ID / 权限 kind / recipe |
| [`@bear1210/native-kit-rn`](https://github.com/TonyChan-hub/kippy/tree/main/packages/native_kit_rn) | npm | NativeKit **（Beta）** RN 门面 + 桥（[指南](/zh/guide/native-kit/)） |
| `native_kit_flutter` | zip / path | NativeKit **（Beta）** Flutter 门面 + plugin |
| [`@bear1210/native-kit`](https://github.com/TonyChan-hub/kippy/tree/main/packages/native-kit-cli) | npm | NativeKit **（Beta）** `add` / `remove` / `list` CLI |

根目录 `package.json` 为 private，仅用于编排 workspaces。发版请在对应包上 bump 版本，不要改根包版本。

## 仓库结构

```text
packages/
  create-rn-template/       # RN CLI + 模板 + 环境脚本
  create-flutter-template/  # Flutter CLI + 无业务模板 + vendor zip
  zippy/                    # Tauri 桌面调试器
  zippy-probe-protocol/     # 共享 probe 协议
  zippy_rn/                 # RN probe SDK（npm）
  zippy_flutter/            # Flutter probe SDK（zip / path）
  native-kit-protocol/      # NativeKit 共享常量
  native_kit/               # Kotlin / Swift 模块源码
  native_kit_rn/            # RN NativeKit SDK（npm）
  native_kit_flutter/       # Flutter NativeKit SDK（zip / path）
  native-kit-cli/           # native-kit add/remove CLI
```

## 本地开发

```bash
git clone https://github.com/TonyChan-hub/kippy.git
cd kippy
npm install

npm run check-mobile-env
npm run create-rn-template -- MyNewApp --package=com.example.mynewapp --skip-install
npm run create-flutter-template -- myFlutterApp --org=com.example --skip-install
```
