---
layout: home
title: Kippy
hero:
  name: Kippy
  text: 少写样板，直接开工
  tagline: 一条命令生成无业务逻辑的 React Native / Flutter 脚手架，并在 macOS 上配置 Android / iOS 工具链。
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 下载 Zippy
      link: /zh/guide/zippy#download
    - theme: alt
      text: GitHub
      link: https://github.com/TonyChan-hub/kippy
features:
  - title: React Native 脚手架
    details: npx @bear1210/create-rn-template — RN 0.81、TypeScript、日志、i18n、SQLite、MMKV、husky 与 Cursor 规则。
    link: /zh/guide/create-rn
    linkText: 创建 RN 项目
  - title: Flutter 脚手架
    details: 分层 lib/ 结构，内置 Dio、GoRouter、Provider、sqflite 日志、ScreenUtil、ARB 国际化，不含业务域。
    link: /zh/guide/create-flutter
    linkText: 创建 Flutter 项目
  - title: 环境助手
    details: macOS 上 setup-rn-android-env / setup-rn-ios-env（支持国内镜像），以及 check-mobile-env 环境检查。
    link: /zh/guide/env-setup
    linkText: 环境配置
  - title: Zippy 调试器
    details: Tauri 桌面工具 — Git（多仓库 + SSH）、Inspector（MMKV / SQLite / 网络 / 性能）、Tools（adb / 模拟器快捷操作）、APK（APK/AAB 解包与体积分析）。可在 Zippy 文档页下载 macOS 安装包。
    link: /zh/guide/zippy
    linkText: 了解 Zippy
  - title: NativeKit（Beta）
    details: 类 uni 的双端原生能力门面 — 统一 Permission / Device API，RN 与 Flutter 共用协议与 recipe，按需启用模块。
    link: /zh/guide/native-kit/
    linkText: NativeKit 指南
  - title: 技术博客
    details: 脚手架设计、NativeKit 权限模型、双端桥接与工程实践等技术文章。
    link: /zh/blog/
    linkText: 浏览文章
---

## 技术博客

工程向短文：设计取舍、API 演进与落地踩坑。

| 文章 | 摘要 |
| ---- | ---- |
| [Zippy 0.0.6：应用内自动更新怎么用](/zh/blog/zippy-auto-update) | 打包版 Check → Download → Restart；须装到 `/Applications`，以及 `latest.json` 与常见排障 |
| [为什么要有 Zippy：从定位问题说起](/zh/blog/why-zippy) | 从手动日志 → Logger → Zippy 的排查升级，以及与 Flipper 等工具的对照 |
| [更多文章…](/zh/blog/) | 完整列表与分类 |
