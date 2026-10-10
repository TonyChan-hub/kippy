# Zippy 0.0.6：应用内自动更新怎么用

::: info
标签：Zippy · 自动更新 · macOS · Tauri · 发版  
相关文档：[Zippy 调试器](/zh/guide/zippy) · [下载 Zippy](/zh/guide/zippy#download) · [为什么要有 Zippy](/zh/blog/why-zippy)
:::

从 **0.0.5** 起，打包版 Zippy 支持应用内更新；到 **0.0.6**，检查 / 下载 / 安装的流程更清晰，并针对 macOS「只读文件系统」这类踩坑加了前置校验与可读错误提示。本文说明用户侧怎么用、背后依赖什么，以及常见失败怎么排。

## 为什么要做应用内更新

Zippy 通过 **GitHub Releases** 发 `.dmg`，不走 npm。以前每次发版都要：

1. 打开文档页或 Releases  
2. 下新 DMG  
3. 拖进「应用程序」覆盖旧版  

调试工具更新频率不低，手动装包容易落后。应用内更新把「发现新版本 → 下载 → 替换 → 重启」收进 App，同时**不会**在启动时偷偷下载——只检查，是否更新由你点按钮决定。

## 用户怎么用

### 前提：装到 `/Applications`

应用内更新会**原地替换** `Zippy.app`。请：

1. 从 [文档下载区](/zh/guide/zippy#download) 或 GitHub Releases 拿到 DMG  
2. 把 **Zippy.app** 拖进 **「应用程序」**（`/Applications`）  
3. **从「应用程序」启动**（不要从 DMG、下载文件夹、桌面直接跑）

若仍在 DMG 挂载卷、`Downloads` 或 Desktop 上运行，下载/安装阶段会失败。0.0.6 会尽量在动手前拦截，并提示把 App 移到 `/Applications` 后再试（底层常见错误是 `Read-only file system` / `os error 30`）。

### 流程：检查 → 下载 → 重启安装

| 步骤 | 发生什么 |
| ---- | -------- |
| **启动检查** | 打包版启动后静默请求 `latest.json`，**只比对版本，不下载** |
| **有新版本** | 模式栏下方出现全局横幅，提示可用版本 |
| **Download** | 再检查一次，下载并暂存更新包（带进度） |
| **Restart & install** | 重启应用并完成替换 |

横幅可关闭；需要时也可在 **Inspector → Device** 面板里手动 **Check for updates**。开发模式（`npm run zippy` / `tauri dev`）**不会**在启动时自动检查；手动检查在没有公开 Release / 签名产物时也常会失败，这是预期行为。

```text
启动（打包版）
    │
    ▼
请求 GitHub latest.json ──仅检查──► 已是最新 → 无横幅
    │
    ▼ 有新版本
横幅：Update x.y.z available
    │
    ▼ 用户点 Download
下载 + 校验签名 ──进度──► 横幅：ready
    │
    ▼ 用户点 Restart & install
重启并替换 /Applications/Zippy.app
```

## 背后依赖什么

| 组件 | 作用 |
| ---- | ---- |
| `tauri-plugin-updater` | 检查、下载、校验、触发重启安装 |
| `latest.json` | 发布在 `…/releases/latest/download/latest.json`，描述最新版本与产物 URL |
| minisign 签名 | CI 用 `TAURI_SIGNING_PRIVATE_KEY` 签名；App 内嵌公钥校验，避免篡改包被装上 |
| GitHub Release `zippy-v{version}` | 承载 `.dmg`、updater 产物与 JSON |

发版时 bump `@bear1210/zippy` 并推到 `main`，工作流会打 macOS 包；若签名密钥配置正确，Release 会带上 updater 产物与 `latest.json`。若签名被跳过，**DMG 仍会发出**，但应用内更新会因拿不到有效 JSON 而失败——此时仍可从[文档页](/zh/guide/zippy#download)手动安装。

文档站点还会镜像 `.dmg`（以及 `download.json`），方便 Releases CDN 不可达时下载；**应用内更新通道本身仍读 GitHub 的 `latest.json`**。

## 常见问题

### 横幅报错 / 检查失败

- 当前网络访问不了 `github.com` Releases  
- 该次 Release **没有** 发布 `latest.json`（签名密钥未进 CI / 配置成了文件路径而非密钥字符串）  
- 本机是 `tauri dev`，没有走打包 updater 配置  

可先打开文档页确认能否下到最新 DMG；能下 DMG、不能应用内更新时，优先怀疑 Release 是否缺 updater 产物。

### 点了 Download 却提示移到 Applications

说明当前进程不在 `/Applications/Zippy.app` 下。关掉 App，从「应用程序」重新打开，再点 Download。

### 仍提示「已损坏」？

那是 Gatekeeper / 隔离属性问题，与 updater 签名是两条线。从 **0.0.3** 起 CI 会做完整 ad-hoc 签名；若遇到旧包，见 [Zippy 指南 · DMG 已损坏](/zh/guide/zippy#打开-dmg-时提示已损坏)。首次打开仍可能需要「仍要打开」。

### 架构

当前 CI 产出 **Apple Silicon（aarch64）** 安装包（M1–M4）。Intel Mac 需本机 `npm run zippy:build`，应用内更新通道也面向该 Apple Silicon 产物。

## 和 0.0.6 的关系（简表）

| 能力 | 说明 |
| ---- | ---- |
| 检查与下载分离 | 启动只 check；下载由用户触发，避免静默占带宽 |
| 全局更新横幅 | 不限当前模式，随时可见进度与操作 |
| `/Applications` 校验 | 下载前检查路径，把「os error 30」变成可执行提示 |
| CI 签名密钥 | 以 Secret **字符串**传入（不是文件路径），保证 `latest.json` 能随 Release 发出 |

## 小结

1. 把 Zippy 放进 **`/Applications`** 再日常使用  
2. 有横幅就 **Download → Restart & install**  
3. 更新失败时，对照：网络 / Release 是否含 `latest.json` / 是否从 Applications 启动  
4. 兜底始终是文档页的 DMG 手动安装  

完整模式说明与 probe 连接方式见 [Zippy 调试器](/zh/guide/zippy)。
