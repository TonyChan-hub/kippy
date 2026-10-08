# Zippy APK Playground 使用说明

::: info
标签：Zippy · APK · AAB · 体积分析 · 16 KB  
相关文档：[Zippy 调试器](/zh/guide/zippy) · [下载 Zippy](/zh/guide/zippy#download)
:::

Zippy 的 **APK** 模式是一个本地包体 Playground：把 `.apk` / `.aab`（也支持 `.xapk` / `.apkm`）拖进去，就能解包、看 Manifest、查签名、做 16 KB 兼容检测，以及看体积占比 / DEX 优化 / 混淆与缩减估计。不需要连真机，也不需要启动 probe。

## 打开方式

1. 安装或启动 Zippy（文档页可 [下载 macOS 安装包](/zh/guide/zippy#download)，开发环境用 `npm run zippy`）
2. 顶栏切换到 **APK**
3. 将包文件拖入左侧虚线区域，或点 **Open…** / 点击虚线区域选择文件

加载成功后，左侧会显示文件名、格式（APK / AAB）、体积与条目数；右侧用页签浏览分析结果。

## 页签怎么用

### Overview

包的「身份证」：包名、版本、min/target/compile SDK、主 Activity、ABI、模块（AAB）、权限数量等。

顶部四个速览指标：

| 指标 | 含义 |
| ---- | ---- |
| 混淆百分比 | DEX 类名里偏 ProGuard/R8 短名（如 `a`、`ab`、`a/b/c`）的比例 |
| 缩减百分比 | ZIP 压缩缩减 + 代码侧启发式（debug 剥离、混淆信号）的综合估计 |
| DEX 优化分 | 0–100，结合 debug info、混淆强度、multidex 等 |
| ZIP 压缩缩减 | 未压缩体积 → 压缩体积的节省比例 |

右侧还有 16 KB 状态与体积占比条，方便一眼判断「有没有 native 对齐问题、谁最占空间」。

### Size（体积与代码）

适合发版前做包体体检：

1. **包体积占比** — DEX / Native / `res` / assets / `resources.arsc` / Manifest / META-INF / Other 的 Install % 与 Download %
2. **DEX 代码优化** — 各 `classes*.dex` 的类、方法、字段、字符串数量；是否含 debug info；优化分与说明
3. **混淆 / 缩减** — 混淆类占比、ZIP 缩减、代码缩减估计，并给出若干混淆 / 可读类名样例
4. **最大条目 Top N** — 按解压体积排序，快速定位「谁最大」

::: tip 怎么读这些百分比
- **Install size** ≈ 解压后体积；**Download ~** ≈ ZIP 内压缩后体积之和（近似下载体量）。
- **混淆 % / 缩减 %** 是启发式，便于横向对比构建产物，**不能**替代 mapping 文件或 Play Console 体积报告。
:::

### 16 KB

针对 Android 16 KB 页大小设备：

- 扫描包内 `.so`（含 AAB 的 `base/lib/...` 等路径）
- 对 `arm64-v8a` / `x86_64`：检查 ELF `PT_LOAD` 的 `p_align ≥ 16384`
- 对 **STORED**（未压缩）的 `.so`：检查 ZIP 数据偏移是否按 16 KB 对齐
- 无 native 库 → 判定为兼容

某条库失败时，Notes 会写明是 ELF 还是 ZIP 未对齐，便于对照 NDK / `zipalign -P 16` 修复。

### Signing

- **APK**：解析 v1 / v2 / v3 / v3.1 等方案与证书主体、指纹（SHA-256 / SHA-1 / MD5）
- **AAB**：主要识别 `META-INF` 的 JAR / v1；证书详情可能不如 APK 完整

适合核对「是不是预期签名」、证书是否过期、是否存在多 scheme。

### Manifest

展示解码后的可读 XML（APK 二进制 AXML，或 AAB 的 protobuf Manifest），以及权限、四大组件表。

::: warning 不要用「原始文件预览」当 Manifest
包内的 `AndroidManifest.xml` 在磁盘上是二进制 / protobuf。Playground 会在 Manifest 页与资源预览里**自动解码**；若用外部编辑器直接打开解压后的文件，仍会看到乱码，这是正常现象。
:::

### Resources / Files

按类别浏览：

- `assets`、`res/raw`、其它 `res`
- `lib`（native）、`dex`、`META-INF`
- Files：全量条目 + 过滤

点选条目可预览文本或图片；体积过大或二进制会提示去 Unpack。

### Unpack

点 **Unpack…** 选择目标目录，把整包解压到本地，便于用 IDE / `aapt2` / 十六进制工具继续挖。

## 推荐工作流

### 发版前快检

1. 拖入 **release APK 或 AAB**
2. Overview 看混淆 / 缩减 / DEX 优化是否符合 release 预期（debug 包通常混淆低、带 debug info）
3. Size 看 DEX / Native / 资源谁占大头；Top 条目对一下是否误打进大资源
4. 16 KB 确认 64 位 `.so` 全部 PASS
5. Signing 确认 scheme 与证书指纹

### 对比 debug vs release

同一应用分别丢进 Playground，重点对比：

| 项 | debug 常见 | release 常见 |
| -- | ---------- | ------------ |
| 混淆 % | 偏低 | 明显升高 |
| Debug info | 常有 | 多为 stripped |
| DEX 优化分 | 偏低 | 更高、易标 OPTIMIZED |
| 体积占比 | 可能含未压缩资源 / 调试符号 | Native / DEX 更「干净」 |

### AAB 与 APK

- AAB 会多出 **Modules**（如 `base`、feature）
- Manifest 路径在 `base/manifest/AndroidManifest.xml`（protobuf）
- Native 路径多为 `base/lib/<abi>/…`
- 签名面板信息以 JAR/v1 为主；完整商店签名链路仍以最终 APK / Play 为准

## 常见问题

**Q：Manifest 还是乱码？**  
请看 **Manifest** 页签，或在 Resources 里点 `AndroidManifest.xml`（应用内会解码）。不要用文本编辑器直接打开解压后的二进制文件。

**Q：混淆 / 缩减和 Android Studio / Play 不一致？**  
Playground 用类名启发式 + ZIP 压缩估算，用于本地快检。精确数字请用官方工具与 mapping。

**Q：16 KB 只有部分 ABI 失败？**  
以 `arm64-v8a` / `x86_64` 为准；其它 ABI 会标注「非重点检查」。失败库按 Notes 修 ELF 对齐或重新 `zipalign`。

**Q：需要装 Android SDK 吗？**  
APK 模式是纯 Rust 分析，一般不需要 `aapt` / `apkanalyzer`。Tools 模式才依赖 `adb` / Xcode。

## 小结

| 你想… | 去哪个页签 |
| ----- | ---------- |
| 快速看包是否像 release | Overview 指标条 |
| 查谁占体积 | Size → 占比 + Top 条目 |
| 查 minify / 混淆大致程度 | Size → 混淆 / 缩减 |
| 查 16 KB 兼容 | 16 KB |
| 查证书 | Signing |
| 查权限与组件 | Manifest |
| 抠 assets / raw / so | Resources → Unpack |

完整功能表见 [Zippy 文档 · APK Playground](/zh/guide/zippy#apk-playground)。
