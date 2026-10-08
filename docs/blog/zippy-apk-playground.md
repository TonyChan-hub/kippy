# Using Zippy’s APK Playground

::: info
Tags: Zippy · APK · AAB · Size analysis · 16 KB  
Related: [Zippy inspector](/guide/zippy) · [Download Zippy](/guide/zippy#download)
:::

Zippy’s **APK** mode is a local package playground: drop an `.apk` / `.aab` (also `.xapk` / `.apkm`), then unpack, inspect Manifest and signing, run 16 KB page-size checks, and review size share / DEX optimization / obfuscation & shrink estimates. No device and no probe required.

## Open it

1. Install or launch Zippy ([macOS download](/guide/zippy#download), or `npm run zippy` in this repo)
2. Switch the top bar to **APK**
3. Drop a package onto the dashed zone, or use **Open…** / click the zone to pick a file

After load, the left pane shows file name, format (APK / AAB), size, and entry count; the right pane uses tabs for each analysis.

## Tabs

### Overview

Package identity: name, version, min/target/compile SDK, main activity, ABIs, AAB modules, permission count, and more.

Four headline metrics:

| Metric | Meaning |
| ------ | ------- |
| Obfuscation % | Share of DEX class names that look ProGuard/R8-short (`a`, `ab`, `a/b/c`, …) |
| Shrink % | Combined estimate from ZIP compression + code-side heuristics (stripped debug, minify signals) |
| DEX optimization score | 0–100 from debug info, obfuscation strength, multidex, etc. |
| ZIP shrink | Savings from uncompressed → compressed entry sizes |

The side panel also shows 16 KB status and a compact size breakdown.

### Size

Use this before a release:

1. **Category share** — DEX / native / `res` / assets / `resources.arsc` / Manifest / META-INF / other (install % and download %)
2. **DEX optimization** — per-`classes*.dex` class/method/field/string counts; debug-info presence; score + notes
3. **Obfuscation / shrink** — obfuscated class ratio, ZIP shrink, code shrink hint, plus sample descriptors
4. **Top entries** — largest paths by uncompressed size

::: tip How to read the percentages
- **Install size** ≈ sum of uncompressed entry sizes; **Download ~** ≈ sum of compressed sizes inside the ZIP.
- Obfuscation / shrink figures are **heuristics** for local comparison — not a substitute for mapping files or Play Console reports.
:::

### 16 KB

For Android 16 KB page-size devices:

- Scans `.so` libraries (including AAB paths like `base/lib/...`)
- For `arm64-v8a` / `x86_64`: requires ELF `PT_LOAD` `p_align ≥ 16384`
- For **STORED** (uncompressed) `.so` files: checks ZIP data offset alignment to 16 KB
- No native libs → treated as compatible

Failed rows include Notes (ELF vs ZIP) so you can fix NDK flags or re-run `zipalign -P 16`.

### Signing

- **APK**: schemes such as v1 / v2 / v3 / v3.1 plus certificate subject and fingerprints
- **AAB**: mainly JAR / v1 via `META-INF`; certificate detail may be thinner than APK

Useful to confirm expected signing and fingerprint.

### Manifest

Decoded human-readable XML (APK binary AXML or AAB protobuf), plus permissions and component tables.

::: warning Do not trust raw file preview as Manifest
On disk, `AndroidManifest.xml` is binary / protobuf. The Manifest tab and in-app resource preview **decode** it. Opening the extracted file in a text editor will still look like garbage — that is expected.
:::

### Resources / Files

Browse by group:

- `assets`, `res/raw`, other `res`
- `lib`, `dex`, `META-INF`
- Files: full list with filter

Select an entry to preview text or images; large/binary entries point you to Unpack.

### Unpack

**Unpack…** extracts the whole archive to a folder for IDE / `aapt2` / hex tooling.

## Suggested workflows

### Pre-release checklist

1. Drop the **release APK or AAB**
2. On Overview, check whether obfuscation / shrink / DEX score look like a release build
3. On Size, see whether DEX, native, or resources dominate; skim Top entries for accidental fat files
4. On 16 KB, confirm all 64-bit `.so` rows PASS
5. On Signing, confirm scheme and certificate fingerprint

### Debug vs release

| Signal | Debug (typical) | Release (typical) |
| ------ | --------------- | ----------------- |
| Obfuscation % | Lower | Higher |
| Debug info | Often present | Often stripped |
| DEX score | Lower | Higher / OPTIMIZED |
| Size mix | May include bulky debug assets | Cleaner DEX / native split |

### AAB vs APK

- AAB Overview lists **Modules** (`base`, features, …)
- Manifest lives at `base/manifest/AndroidManifest.xml` (protobuf)
- Native libs often under `base/lib/<abi>/…`
- Signing panel is JAR/v1-oriented; store signing still follows the final APK / Play path

## FAQ

**Manifest still garbled?**  
Use the **Manifest** tab, or open `AndroidManifest.xml` inside Resources (decoded in-app). Do not open the extracted binary in a text editor.

**Numbers disagree with Android Studio / Play?**  
Playground uses class-name heuristics + ZIP compression. Prefer official tooling for shipping numbers.

**Only some ABIs fail 16 KB?**  
Focus on `arm64-v8a` / `x86_64`. Other ABIs are annotated as non-primary. Fix ELF / zipalign per Notes.

**Do I need the Android SDK?**  
APK mode is pure Rust analysis — no `aapt` / `apkanalyzer` required. Tools mode still needs `adb` / Xcode when you use it.

## Cheat sheet

| Goal | Tab |
| ---- | --- |
| Does this look like a release build? | Overview metrics |
| What eats the size? | Size → categories + Top entries |
| Rough minify / obfuscation level | Size → obfuscation / shrink |
| 16 KB readiness | 16 KB |
| Certificate check | Signing |
| Permissions / components | Manifest |
| Dig into assets / raw / `.so` | Resources → Unpack |

Full feature table: [Zippy guide · APK Playground](/guide/zippy#apk-playground).
