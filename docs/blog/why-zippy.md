# Why Zippy exists: starting from how we debug

::: info
Tags: Zippy · Logger · Debugging · React Native · Flutter · Flipper  
Related: [Zippy inspector](/guide/zippy) · [APK Playground walkthrough](/blog/zippy-apk-playground) · [Env helper on a new Mac](/blog/env-helper-new-mac)
:::

Most mobile debugging pain is not “I don’t know how to read a log.” It is **scattered logs, uneven machines, and a different ritual for debug / device / Release / production**. Zippy is not a random desktop toy—it is what you get after the third step of that evolution.

This post uses diagrams for three comparisons:

1. **What each debugging / localization layer covers**  
2. **Zippy vs Flipper vs other common tools**  
3. **Why Logger + Zippy + the env helper** are a set, not single-point gadgets

---

## 1. The upgrade ladder

```text
Coverage
 ▲
 │                                    ┌─────────────────────────┐
 │                                    │  ③ Zippy                │
 │                                    │  Live stores + device    │
 │                                    │  ops + package statics  │
 │                         ┌──────────┴─────────────────────────┤
 │                         │  ② Logger (SQLite)                 │
 │                         │  Shared schema · Release cut points│
 │              ┌──────────┴────────────────────────────────────┤
 │              │  ① Manual logs (print / console.log)          │
 │              │  Fast locally · no standard · Release blind   │
 └──────────────┴───────────────────────────────────────────────►
                Local debug          Device / sim          Release / prod
```

| Layer | Fixes | Still missing |
| ----- | ----- | ------------- |
| ① Manual logs | “Is this hypothesis true *now*?” | Team format, shipping builds, later evidence |
| ② Logger | Shared shape, main-path trail, export | Live MMKV/network UI, wipe/reinstall, unpack |
| ③ Zippy | Lay out evidence + operate device/package | Does not replace your production upload policy |

**The next layer does not replace the previous:** Logger is data; Zippy is the window and control surface.

---

## 2. Scenario coverage matrix

● strong / ◐ partial / ○ weak or none:

```text
                    Local check   Team format   Release trail   Device speed   KV/SQLite UI   Network   Wipe/install   APK static
① Manual logs           ●              ○              ○               ○              ○           ○           ○              ○
② Logger                ◐              ●              ●               ○              ◐*          ○           ○              ○
③ Zippy                 ◐              ●**            ◐***            ●              ●           ●           ●              ●

*  Logger rows live in SQLite—query/export works, but not a live panel
** Zippy + scaffold conventions reinforce shared practice
*** Release still needs Logger to leave evidence; Zippy opens the DB afterward
```

### ① Manual logs: shortest path, shortest life

```text
  Developer
    │  console.log / print
    ▼
  Metro / Xcode Console / logcat
    │
    └─► Lives only in “this debug session”
         ✗ No shared format for teammates
         ✗ Often stripped in Release
```

Good for: **one if in minutes**. Bad as: **the only team process**.

### ② Logger: evidence on disk

```text
  App code
    │  logger.info('pay', 'submit', { orderId })
    ▼
  SQLite (app_logs / domain tables)
    │
    ├─► Local: Zippy SQLite panel / JSON·CSV export
    └─► Prod: upload last N rows / session bundle by policy
         ✓ category · event · payload
         ✓ Release can keep main-path cut points
```

Answers: **can we dig up proof on the device later?**

### ③ Zippy: lay it out and act

```text
                    ┌──────── Zippy (macOS) ────────┐
                    │                               │
   RN / Flutter ────┼─► Inspector                   │
   probe :9876      │   MMKV · SQLite · Network      │
                    │   Perf · Device                │
                    │                               │
   adb / xcrun ─────┼─► Tools                       │
                    │   install · clear · shot · sim │
                    │                               │
   .apk / .aab ─────┼─► APK Playground              │
                    │   Manifest · sign · 16KB · size│
                    │                               │
   multi-repo git ──┼─► Git + SSH profiles          │
                    └───────────────────────────────┘
```

| Situation | Path |
| --------- | ---- |
| Weird Android device | Tools for the scene → Inspector stores/network → APK if the package is suspect |
| iOS simulator | Tools to boot/install; Inspector for app data |
| iOS device | Inspector + **Xcode Console** for system logs |
| Fails only in Release | Logger cut points → Zippy opens the same SQLite timeline |

---

## 3. One bug, three approaches

Example: payment success screen sometimes blank.

```text
① Manual logs
   Add prints → see null when reproducing locally
   ✗ QA’s Release build has none of those prints
   ✗ You cannot “add logs again” on a user device

② Logger only
   pay.success / pay.render events on disk
   ✓ Export shows a missing field in payload
   ✗ MMKV token / network failure code need extra scripts

③ Logger + Zippy
   Logger leaves the trail
   Inspector: same moment → SQLite events + MMKV session + Network failure
   Tools: one-tap clear + reinstall to separate cache vs logic
```

```text
Ideal timeline

  t0  User action           ──► Logger writes SQLite
  t1  Dev connects device   ──► Inspector: DB / MMKV / Network
  t2  Suspect dirty cache   ──► Tools: clear data + reinstall
  t3  Suspect bad shrink    ──► APK: obfuscation / missing assets
```

---

## 4. Tool landscape: Zippy · Flipper · others

Where each tool sits:

```text
                    Live in-app debug       Device / sim ops        Package static      RN + Flutter        Team-maintainable
Flipper                   ●                      ○                   ○                 RN-first              △ (Meta)
Reactotron                ●                      ○                   ○                 RN-first              ◐
Chrome DevTools           ◐ (WebView / some)      ○                   ○                 Web / partial RN      ●
Android Studio / adb      ○                      ●                   ◐                 Android               ● (official)
Xcode / Instruments       ○                      ●                   ○                 iOS                   ● (official)
Charles / Proxyman        ◐ (network)             ○                   ○                 universal             ●
Zippy                     ●                      ●                   ●                 RN + Flutter          ● (same repo)
```

### Capability detail (● yes / ◐ weak or partial / ○ no)

| Capability | Zippy | Flipper | Reactotron | Android Studio / adb | Xcode | Charles etc. |
| ---------- | :---: | :-----: | :--------: | :------------------: | :---: | :----------: |
| MMKV / KV browser | ● | ◐ | ◐ | ○ | ○ | ○ |
| SQLite tables / rows | ● | ◐ | ○ | ◐ | ○ | ○ |
| Network panel | ● | ● | ● | ○ | ○ | ● |
| Light perf samples | ● | ● | ◐ | ● | ● | ○ |
| React Native | ● | ● | ● | ○ | ○ | ○ |
| Flutter | ● | ○ | ○ | ○ | ○ | ○ |
| adb install / clear data | ● | ○ | ○ | ● | ○ | ○ |
| iOS Simulator shortcuts | ● | ○ | ○ | ○ | ● | ○ |
| APK / AAB static analysis | ● | ○ | ○ | ◐ | ○ | ○ |
| Multi-repo Git + SSH | ● | ○ | ○ | ○ | ○ | ○ |
| Evolves with the scaffold | ● | ○ | ○ | ○ | ○ | ○ |

### Why not keep betting on Flipper

```text
Flipper path (common pain)

  App (usually RN only)
        │
        ▼
  Flipper Desktop  ◄── Meta cadence out of your control
        │
        ├─ Has: layout / network / some plugins
        └─ Lacks: first-class Flutter, APK statics, allowlisted adb bench, multi-SSH

Zippy path

  RN probe ──┐
             ├── same /probe protocol ──► Zippy Desktop (owned)
  Flutter ───┘         │
                       ├─ Inspector: MMKV · SQLite · Network · Perf
                       ├─ Tools: adb / xcrun
                       ├─ APK: unpack · signing · 16KB · size
                       └─ Git: multi-repo identity
```

| Dimension | Flipper | Zippy |
| --------- | ------- | ----- |
| Maintenance | Meta; rough for product teams | Same Kippy monorepo as the templates |
| Targets | Mostly React Native | **RN + Flutter** on one probe |
| Scope | In-app debug plugins | Debug + device ops + package statics + Git/SSH |
| Role | Generic RN debugger | Scaffold-paired **investigation workbench** |

You need more than “another Inspector”: one **cross-stack desk that also owns toolchain-adjacent work**.

### How to split work with other tools (not mutually exclusive)

```text
                    ┌─ System perf / crash symbols ──► Xcode · Android Studio
                    │
  Day-to-day bugs ──┼─ Deep HTTPS MITM ──► Charles / Proxyman
                    │
                    ├─ WebView / web detail ──► Chrome DevTools
                    │
                    └─ KV · SQLite · network overview
                       · wipe · unpack · multi-Mac parity ──► Zippy (+ Logger)
```

Zippy **does not replace** Instruments or the official IDEs. It folds the **repeated 80% of product debugging**, aligned with Logger and the env helper.

---

## 5. Why the set: Logger + Zippy + env helper

```text
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Env helper    │     │  Logger        │     │  Zippy         │
│  Same toolchain│────►│  Structured    │────►│  See + operate │
│  Store-ready   │     │  Release trail │     │  live+static+  │
└────────────────┘     └────────────────┘     │  device        │
        │                      │              └────────────────┘
        └──────────────────────┴──────────────────────┘
                               │
                    A repeatable team path
                    (not everyone’s private scripts)
```

| If you drop one | What breaks |
| ---------------- | ----------- |
| Manual logs only | Collaboration + Release blindness |
| Logger without Zippy | Evidence exists; still ad-hoc SQL/exports and terminal device ops |
| Zippy without Logger | Empty panels or raw tables without main-path meaning |
| Great tools, drifted SDKs | “Only my Mac reproduces” — start with the [env helper](/blog/env-helper-new-mac) |

---

## 6. Quick chooser

| Situation | Prefer |
| --------- | ------ |
| Local check of one if | Manual logs |
| Release / user device “what happened” | Logger + export/upload policy |
| Live KV·tables·network, wipe, unpack APK | Zippy |
| System jank / symbolicated crashes | Xcode / Android Studio |
| Deep HTTPS rewrite debugging | Charles / Proxyman |
| New Mac / teammate drift | Env helper + `check-mobile-env` |
| Flipper as the only workbench | Move to Zippy (RN+Flutter); use the matrix above for gaps |

---

## Takeaway

```text
Manual logs  =  visible right now
Logger       =  shared format + Release/prod cut points
Zippy        =  MMKV/SQLite/network/perf laid out
                + Tools for devices
                + APK for static package truth
Env helper   =  everyone on the same starting line
```

**Why Zippy?** Debugging should land on one **RN + Flutter, maintainable workbench covering live data, device ops, and static package analysis**—Flipper does not cover that whole path, and loose adb/SQL scripts do not set a team standard. Logger supplies the data; Zippy presents and operates; the env helper keeps environments aligned.
