# 为什么要有 Zippy：从定位问题说起

::: info
标签：Zippy · Logger · 排查 · React Native · Flutter · Flipper  
相关文档：[Zippy 调试器](/zh/guide/zippy) · [APK Playground 使用说明](/zh/blog/zippy-apk-playground) · [环境助手开箱](/zh/blog/env-helper-new-mac)
:::

排查移动端问题，多数时候不是「不会看 log」，而是 **log 散、环境乱、真机/Release/线上各一套办法**。Zippy 不是凭空出现的桌面玩具，而是排查手段升级到第三层之后的产物。

本文用图对比三件事：

1. **不同调试 / 定位手段** 各自覆盖哪一层  
2. **Zippy vs Flipper vs 其他常见工具** 能力差在哪  
3. **为什么 Logger + Zippy + 环境助手** 要成套，而不是单点工具

---

## 一、排查手段升级图

```text
能力 / 场景覆盖
 ▲
 │                                    ┌─────────────────────────┐
 │                                    │  ③ Zippy                │
 │                                    │  实时看库 + 设备操作     │
 │                                    │  + 包体静态分析         │
 │                         ┌──────────┴─────────────────────────┤
 │                         │  ② Logger（SQLite）                │
 │                         │  规范埋点 · Release/线上切面       │
 │              ┌──────────┴────────────────────────────────────┤
 │              │  ① 手动日志（print / console.log）            │
 │              │  本地最快 · 规范散 · Release 基本看不见       │
 └──────────────┴───────────────────────────────────────────────►
                本地 Debug          真机/模拟器        Release/线上
```

| 层 | 解决什么 | 搞不定什么 |
| -- | -------- | ---------- |
| ① 手动日志 | 「此刻假设对不对」 | 协作规范、发行包、事后取证 |
| ② Logger | 统一格式、主链路切面、可导出 | 实时跨 MMKV/网络看、清数据/拆包 |
| ③ Zippy | 摊开证据 + 动手操作设备/包体 | 不能代替线上采集策略本身 |

**下一层不取代上一层**：Logger 是数据，Zippy 是窗口与操作台。

---

## 二、三种手段：场景覆盖对照

下面用「能不能覆盖」做矩阵（● 强 / ◐ 部分 / ○ 弱或无）：

```text
                    本地快速验证   团队规范   Release切面   真机复现加速   看KV/库表   抓网络   清数据/装包   拆APK静态
① 手动日志              ●            ○          ○             ○            ○         ○         ○            ○
② Logger                ◐            ●          ●             ○            ◐*        ○         ○            ○
③ Zippy                 ◐            ●**        ◐***          ●            ●         ●         ●            ●

*  Logger 落在 SQLite，可用 SQL/导出看，但不是实时面板
** Zippy 靠 probe + 统一脚手架约定，间接促成规范
*** Release 仍依赖 Logger 先把证据留下；Zippy 负责连上后翻库
```

### ① 手动日志：最短路径，最短命

```text
  开发者
    │  console.log / print
    ▼
  Metro / Xcode Console / logcat
    │
    └─► 只活在「这次调试会话」
         ✗ 同事看不到统一格式
         ✗ Release 往往被裁掉
```

适合：**一两分钟验证一个 if**。不适合当团队唯一手段。

### ② Logger：证据落盘

```text
  业务代码
    │  logger.info('pay', 'submit', { orderId })
    ▼
  SQLite（app_logs / 业务表）
    │
    ├─► 本地：Zippy SQLite 面板 / 导出 JSON·CSV
    └─► 线上：按策略上传最近 N 条 / 会话包
         ✓ 有 category · event · payload
         ✓ Release 仍可留下主链路切面
```

回答：**事后能不能在设备上翻到证据**。

### ③ Zippy：证据摊开 + 动手

```text
                    ┌──────── Zippy（macOS）────────┐
                    │                               │
   RN / Flutter ────┼─► Inspector                   │
   probe :9876      │   MMKV · SQLite · Network      │
                    │   Perf · Device                │
                    │                               │
   adb / xcrun ─────┼─► Tools                       │
                    │   装包 · 清数据 · 截图 · 模拟器 │
                    │                               │
   .apk / .aab ─────┼─► APK Playground              │
                    │   Manifest · 签名 · 16KB · 体积│
                    │                               │
   多仓库 git ──────┼─► Git + SSH Profile           │
                    └───────────────────────────────┘
```

典型组合：

| 场景 | 路径 |
| ---- | ---- |
| Android 真机怪问题 | Tools 抓现场 → Inspector 看库/网络 → 必要时 APK 对照包体 |
| iOS 模拟器 | Tools 启模拟器/装包；Inspector 看业务数据 |
| iOS 真机 | Inspector + **Xcode Console** 交叉验证系统侧 log |
| 只有 Release 才挂 | Logger 切面 → Zippy 打开同一 SQLite 对时序 |

---

## 三、同一次 Bug：三种办法差在哪

以「支付成功页偶现空白」为例：

```text
① 手动日志
   加 print → 本地复现时看到 null
   ✗ QA 的 Release 包没有这些 print
   ✗ 用户机无法「再打一遍 log」

② 只有 Logger
   主链路有 pay.success / pay.render 事件落库
   ✓ 导出最近日志能看到 payload 缺字段
   ✗ 当时 MMKV 里 token、网络失败码要另写脚本查

③ Logger + Zippy
   Logger 留下切面
   Zippy Inspector：同一时刻对照 SQLite 事件 + MMKV 会话 + Network 失败响应
   Tools：一键清数据重装，确认是缓存还是逻辑
```

```text
时间线（理想路径）

  t0  用户操作          ──► Logger 写入 SQLite
  t1  开发连上真机      ──► Zippy Inspector 打开库 / MMKV / Network
  t2  怀疑脏缓存        ──► Tools 清数据 + 重装
  t3  怀疑包体裁剪异常  ──► APK 看混淆 / 资源是否被误删
```

---

## 四、工具大盘：Zippy · Flipper · 其他

先看「各自站在哪一层」：

```text
                    App 内实时调试          设备/模拟器操作         包体静态         多端（RN+Flutter）    团队可维护
Flipper                   ●                      ○                   ○                   RN 为主                △（Meta）
Reactotron                ●                      ○                   ○                   RN 为主                ◐
Chrome DevTools           ◐（WebView/部分）       ○                   ○                   Web / 部分 RN          ●
Android Studio / adb      ○                      ●                   ◐                   Android                ●（官方）
Xcode / Instruments       ○                      ●                   ○                   iOS                    ●（官方）
Charles / Proxyman        ◐（网络）               ○                   ○                   通用                   ●
Zippy                     ●                      ●                   ●                   RN + Flutter           ●（同仓）
```

### 能力细表（● 有 / ◐ 弱或部分 / ○ 无）

| 能力 | Zippy | Flipper | Reactotron | Android Studio / adb | Xcode | Charles 等 |
| ---- | :---: | :-----: | :--------: | :------------------: | :---: | :--------: |
| MMKV / KV 浏览 | ● | ◐ | ◐ | ○ | ○ | ○ |
| SQLite 表 / 行 | ● | ◐ | ○ | ◐ | ○ | ○ |
| 网络请求面板 | ● | ● | ● | ○ | ○ | ● |
| 轻量性能采样 | ● | ● | ◐ | ● | ● | ○ |
| React Native | ● | ● | ● | ○ | ○ | ○ |
| Flutter | ● | ○ | ○ | ○ | ○ | ○ |
| adb 装包 / 清数据等 | ● | ○ | ○ | ● | ○ | ○ |
| iOS Simulator 快捷 | ● | ○ | ○ | ○ | ● | ○ |
| APK / AAB 静态分析 | ● | ○ | ○ | ◐ | ○ | ○ |
| 多仓库 Git + SSH | ● | ○ | ○ | ○ | ○ | ○ |
| 与脚手架同仓演进 | ● | ○ | ○ | ○ | ○ | ○ |

### 为什么不继续押 Flipper

```text
Flipper 路径（常见痛点）

  业务 App（多半仅 RN）
        │
        ▼
  Flipper Desktop  ◄── Meta 维护节奏不可控
        │
        ├─ 有：布局 / 网络 / 部分插件
        └─ 无：Flutter 一等公民、APK 静态、adb 白名单工作台、多 SSH

Zippy 路径

  RN probe ──┐
             ├── 同一 /probe 协议 ──► Zippy Desktop（自维护）
  Flutter ───┘         │
                       ├─ Inspector：MMKV · SQLite · Network · Perf
                       ├─ Tools：adb / xcrun
                       ├─ APK：解包 · 签名 · 16KB · 体积
                       └─ Git：多仓库身份
```

| 维度 | Flipper | Zippy |
| ---- | ------- | ----- |
| 维护 | Meta 侧，对业务团队不友好 | 与 Kippy 同仓，跟模板一起演进 |
| 端 | 基本面向 React Native | **RN + Flutter** 共用 probe |
| 边界 | 偏 App 内调试插件 | 调试 + 设备操作 + 包体静态 + Git/SSH |
| 定位 | 通用 RN 调试器 | 脚手架配套的 **排查工作台** |

需要的不是「又一个 Inspector」，而是 **跨端一致、还能管工具链周边** 的一张桌子。

### 和其他工具怎么分工（不是互斥）

```text
                    ┌─ 系统级性能 / 崩溃符号 ──► Xcode · Android Studio
                    │
  日常业务排查 ─────┼─ 代理抓包深挖 HTTPS ──► Charles / Proxyman
                    │
                    ├─ WebView / 前端细节 ──► Chrome DevTools
                    │
                    └─ KV · SQLite · 网络概览
                       · 清数据 · 拆包 · 多机一致性 ──► Zippy（+ Logger）
```

Zippy **不替代** Instruments 或官方 IDE；它收拢 **业务侧最常重复的 80% 动作**，并和 Logger、环境助手对齐。

---

## 五、为什么要成套：Logger + Zippy + 环境助手

```text
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  环境助手       │     │  Logger        │     │  Zippy         │
│  工具链一致     │────►│  结构化证据     │────►│  看得见/操作得到│
│  可上架构建     │     │  Release 切面   │     │  动态+静态+设备 │
└────────────────┘     └────────────────┘     └────────────────┘
        │                      │                      │
        └──────────────────────┴──────────────────────┘
                               │
                    可重复的团队排查路径
                    （而不是每人一套脚本）
```

| 缺一不可时 | 后果 |
| ---------- | ---- |
| 只有手动日志 | 协作与 Release 失明 |
| 只有 Logger、没有 Zippy | 有证据，但要靠临时 SQL/导出，真机操作仍散落终端 |
| 只有 Zippy、没有 Logger | 面板空、或只有原始表，缺主链路语义 |
| 工具很好、环境不一致 | 「只有我这台复现」——先 [环境助手](/zh/blog/env-helper-new-mac) |

---

## 六、怎么选（速查）

| 场景 | 优先用 |
| ---- | ------ |
| 本地快速验证一个 if | 手动日志 |
| Release / 用户机「发生了什么」 | Logger + 导出/上传策略 |
| 连着看 KV·库表·网络、清数据、拆 APK | Zippy |
| 系统级卡顿 / 崩溃符号化 | Xcode / Android Studio |
| 深度 HTTPS 改包调试 | Charles / Proxyman |
| 新 Mac / 同事环境漂移 | 环境助手 + `check-mobile-env` |
| 还在依赖 Flipper 当唯一工作台 | 迁到 Zippy（RN+Flutter），Flipper 能力用上表核对缺口 |

---

## 小结

```text
手动日志  =  此刻看得见
Logger    =  规范统一 + Release/线上有切面
Zippy     =  摊开 MMKV/SQLite/网络/性能
             + Tools 加速真机
             + APK 看静态面
环境助手  =  大家站在同一起跑线
```

**为什么要有 Zippy？** 因为排查最终要停在一套 **跨 RN / Flutter、可维护、且覆盖动态数据 + 设备操作 + 静态包分析** 的工作台上——Flipper 做不到这条完整路径，散装 adb/SQL 脚本也撑不起团队标准。Logger 供数，Zippy 呈现与操作，环境助手保证环境一致。
