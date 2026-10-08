---
layout: home
title: Kippy
hero:
  name: Kippy
  text: Ship mobile apps without the boilerplate tax
  tagline: One CLI for React Native & Flutter scaffolds, plus macOS Android/iOS toolchain setup — business-free, production-shaped.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Download Zippy
      link: /guide/zippy#download
    - theme: alt
      text: GitHub
      link: https://github.com/TonyChan-hub/kippy
features:
  - title: React Native scaffold
    details: npx @bear1210/create-rn-template — RN 0.81, TypeScript, logger, i18n, SQLite, MMKV, husky & Cursor rules.
    link: /guide/create-rn
    linkText: Create RN app
  - title: Flutter scaffold
    details: Layered lib/ layout with Dio, GoRouter, Provider, sqflite logger, ScreenUtil, ARB i18n — no business domain.
    link: /guide/create-flutter
    linkText: Create Flutter app
  - title: Environment helpers
    details: setup-rn-android-env / setup-rn-ios-env on macOS with CN/global mirrors, plus check-mobile-env for readiness.
    link: /guide/env-setup
    linkText: Env setup
  - title: Zippy inspector
    details: Tauri desktop tool — Git (multi-repo + SSH), Inspector (MMKV / SQLite / network / perf), and Tools (adb / Simulator). Download macOS builds from the Zippy guide.
    link: /guide/zippy
    linkText: About Zippy
  - title: NativeKit (Beta)
    details: Uni-style dual-end native facade — shared Permission / Device APIs, one protocol + recipes for RN and Flutter, enable modules on demand.
    link: /guide/native-kit/
    linkText: NativeKit guide
  - title: Engineering blog
    details: Design notes on scaffolds, NativeKit permissions, bridges, and mobile tooling practice.
    link: /blog/
    linkText: Browse posts
---

## Engineering blog

Short posts on design trade-offs, API evolution, and shipping pitfalls.

| Post | Summary |
| ---- | ------- |
| [NativeKit: designing a dual-end permission facade](/blog/native-kit-permissions) | Unified `kind`s, platform mapping, compliance tags, and why device info is a separate module |
| [More posts…](/blog/) | Full index |
