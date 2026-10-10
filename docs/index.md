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
    details: Tauri desktop tool — Git (multi-repo + SSH), Inspector (MMKV / SQLite / network / perf), Tools (adb / Simulator), and APK (APK/AAB unpack + size analysis). Download macOS builds from the Zippy guide.
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
| [Zippy 0.0.6: in-app auto-update](/blog/zippy-auto-update) | Packaged Check → Download → Restart; install under `/Applications`, plus `latest.json` and common fixes |
| [Why Zippy exists: starting from how we debug](/blog/why-zippy) | Manual logs → Logger → Zippy, and how that stacks up against Flipper and similar tools |
| [More posts…](/blog/) | Full index |
