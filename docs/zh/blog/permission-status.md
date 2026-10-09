# Android / iOS 权限：status 到底是什么意思

::: info
标签：NativeKit · 权限 · Android · iOS  
相关文档：[Permission API](/zh/guide/native-kit/permission) · [平台声明](/zh/guide/native-kit/platform) · [快速搭建三种媒体权限](/zh/blog/quick-scaffold-media)
:::

做权限时，最容易踩坑的不是「弹不弹窗」，而是**弹完之后业务该怎么走**。系统 API 返回的原始状态在 Android 与 iOS 上名字不同、语义也不对称；NativeKit 把它们归一成六个 `status`，业务只需要按状态分支。

本文只讲一件事：**每个 status 的含义、在双端分别对应什么，以及 UI 该怎么响应。**

## 六个 status 一览

| Status | 一句话 | 还能再弹系统框吗 | 典型下一步 |
| ------ | ------ | ---------------- | ---------- |
| `notDetermined` | 还没问过用户 | 可以 | `request` / `ensure` |
| `granted` | 已完整允许 | 无需 | 直接用能力 |
| `limited` | 部分允许 | 视能力而定 | 多数场景可当「可用」；要完整权限再引导设置 |
| `denied` | 拒绝了，但仍可能再问 | 可能 | `request`；或说明用途后再试 |
| `permanentlyDenied` | 永久拒绝，系统不再弹窗 | 否 | `openSettings()` |
| `restricted` | 系统 / MDM 限制，或**本平台根本没有该能力** | 否 | 降级功能；不要反复申请 |

除非产品明确要求「必须完整相册 / 完整通讯录」，否则把 **`granted` 与 `limited` 都当成成功** 是最省事、也最贴合现代系统策略的做法。

## 状态机：业务该怎么画

```text
                    check()
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
 notDetermined     granted       limited ──► 可用（多数场景）
        │             ▲
        │             │
        ▼             │
     request() ───────┘
        │
        ├── granted / limited
        ├── denied ──────────────► 可再 request（或先讲清楚再问）
        ├── permanentlyDenied ───► openSettings()
        └── restricted ──────────► 降级 / 隐藏入口
```

`ensure(kind)` 的约定是：

1. 先 `check`
2. 只有 `denied` / `notDetermined` 才会继续 `request`
3. 遇到 `permanentlyDenied` / `restricted` / 已是 `granted`·`limited` → **不再弹窗**，原样返回

所以：`ensure` 不是「保证一定拿到权限」，而是「在还能问的时候再问一次」。

## 逐个拆开：含义与双端差异

### `notDetermined` — 尚未询问

用户从没见过系统权限框（或等价于从未决态）。

| 平台 | 常见来源 |
| ---- | -------- |
| iOS | `AVAuthorizationStatus.notDetermined`、`PHAuthorizationStatus.notDetermined`、ATT `notDetermined` 等 |
| Android | 运行时权限尚未授予，且通常也未进入「不再询问」路径；`checkSelfPermission` 为 denied 且 `shouldShowRequestPermissionRationale` 为 false 的**首次**场景，常被映射为「还可请求」 |

**业务建议：** 先展示用途说明（自定义 UI），再 `request`。不要一进页就连环弹窗。

### `granted` — 已允许

完整（或对该 kind 而言足够）的授权。

| 平台 | 常见来源 |
| ---- | -------- |
| iOS | `.authorized` / `.authorizedAlways` / ATT `.authorized` 等 |
| Android | `PackageManager.PERMISSION_GRANTED` |

**业务建议：** 直接调用相机、定位、读相册等能力。

### `limited` — 部分允许

这是现代隐私模型的核心状态，**主要来自 iOS**，Android 14+ 选图授权也会出现类似语义。

典型例子：

- iOS 相册「选中的照片」→ `limited`
- iOS 通讯录有限访问（较新系统）→ `limited`
- iOS 日历仅写 → NativeKit 也映射为 `limited`
- Android 14+ 用户只授权部分媒体 → 与 `photoLimited` 流程配套时，可视为 `limited`

**业务建议：**

| 需求 | 如何对待 `limited` |
| ---- | ------------------ |
| 用户先勾选一批图再读 | **成功**（`photoLimited`） |
| 必须扫完整相册 | **未成功**（`photoRead`）；引导去设置升级完整访问 |
| 一般读写能力 | 多数可当成功 |

### `denied` — 拒绝了，但仍可能再问

用户点了「不允许」，但系统**还没有**把你锁死到「只能去设置」。

| 平台 | 要点 |
| ---- | ---- |
| iOS | 许多权限第一次拒绝后，再次 `request` **不会**再出系统框，实际已接近永久拒绝；NativeKit 会尽量向 `permanentlyDenied` 靠拢，但部分路径仍可能先看到 `denied` |
| Android | 首次拒绝后，`shouldShowRequestPermissionRationale == true` 时，再次 `request` 仍可弹窗；这是 `denied` 最干净的语义 |

**业务建议：** 用产品文案解释「为什么需要」，再给一次「继续授权」按钮调用 `request`。不要静默死循环 `request`。

### `permanentlyDenied` — 永久拒绝

系统不会再弹标准权限框，只能去应用设置页改。

| 平台 | 常见判定 |
| ---- | -------- |
| iOS | 用户已拒绝且再次申请无效；或设置里手动关掉 |
| Android | 勾选「不再询问」后拒绝；或设置里关掉。常见信号：`check` 为未授予且 `shouldShowRequestPermissionRationale == false`（且并非从未问过） |

**业务建议：** 弹自有对话框 → 「去设置」→ `openSettings()`。**不要**再调 `request` 指望系统框出现。

### `restricted` — 限制，或不支持

两种完全不同的现实，共用一个状态：

1. **系统 / 家长控制 / MDM** 禁止该能力（用户自己也改不了）
2. **本平台没有对等能力**（NativeKit 的跨端约定）

| 例子 | 结果 |
| ---- | ---- |
| iOS 上的 `sms` / `appList` | `restricted`（无对等 API） |
| Android 上的 `reminders` | `restricted` |
| 企业设备禁用相机 | `restricted` |

**业务建议：** 隐藏入口或展示「此设备不可用」，**不要**引导去设置（往往无效），更不要反复 `request`。

::: tip 为什么不单独做一个 `unsupported`？
业务侧 `ensure` / UI 分支已经习惯处理「拿不到权限」；再拆一个状态会让每个 call site 多一层判断。用 `restricted` 表示「此端不可用」，文档和 recipe 用标注（Android-only 等）说明原因即可。
:::

## Android 与 iOS：容易误解的对照

| 你在想… | Android 实际 | iOS 实际 | NativeKit status |
| ------- | ------------ | -------- | ---------------- |
| 还没问过 | 未授予 + 可再请求 | `notDetermined` | `notDetermined`（或可请求的 `denied`） |
| 用户拒绝一次 | 常可再弹（rationale） | 很多权限二次不再弹 | `denied` → 很快变成 / 视为 `permanentlyDenied` |
| 「不再询问」 | 明确存在 | 无同名勾选，但效果类似永久拒绝 | `permanentlyDenied` |
| 选部分照片 | API 34+ 部分媒体授权 | 选中的照片 | `limited` |
| 平台没有这能力 | 视 kind 返回 `granted` 或 `restricted` | 同左 | 见 kind 映射表，**不要当成用户拒绝** |

关键点：**不要用 Android 的「再弹一次」心智硬套 iOS**，也不要把「平台不支持」当成「用户点了不允许」。

## 推荐的 UI 分支（伪代码）

```ts
async function onNeedCamera() {
  const status = await NativeKit.permission.ensure('camera');

  switch (status) {
    case 'granted':
    case 'limited': // 相机一般不会 limited，写上无妨
      return openCamera();

    case 'denied':
      return showExplainSheet({
        onRetry: () => NativeKit.permission.request('camera'),
      });

    case 'permanentlyDenied':
      return showGoSettings({
        onConfirm: () => NativeKit.permission.openSettings(),
      });

    case 'restricted':
      return showUnavailable('当前设备无法使用相机');

    case 'notDetermined':
      // ensure 理论上已处理；若单独 check 见到它，再 request
      return NativeKit.permission.request('camera');
  }
}
```

相册要特别小心 kind：

```ts
// 用户勾选范围即可
const s = await NativeKit.permission.ensure('photoLimited');
if (s === 'granted' || s === 'limited') { /* OK */ }

// 必须完整相册
const full = await NativeKit.permission.ensure('photoRead');
if (full === 'granted') { /* OK */ }
if (full === 'limited' || full === 'permanentlyDenied') {
  // 引导去设置开启「所有照片」
  await NativeKit.permission.openSettings();
}
```

## 和 `check` / `request` / `ensure` 的关系

| 方法 | 会不会改系统状态 | 何时用 |
| ---- | ---------------- | ------ |
| `check` | 否 | 进入页面前预检、决定按钮文案 |
| `request` | 可能弹窗 | 用户明确点击「允许访问」之后 |
| `ensure` | 仅在还可问时弹窗 | 大多数业务入口的默认选择 |
| `openSettings` | 把用户送出 App | 仅 `permanentlyDenied`（或需升级 `limited`→完整） |

原则：**解释权在 App，决定权在系统。** status 告诉你现在处在哪一步，而不是替你保证结果。

## 小结

| Status | 记住这句话 |
| ------ | ---------- |
| `notDetermined` | 还没问 |
| `granted` | 可以用 |
| `limited` | 能用一部分；是否够用取决于产品 |
| `denied` | 拒绝了，或许还能再问 |
| `permanentlyDenied` | 别再弹了，去设置 |
| `restricted` | 问也没用（限制或不支持） |

把这六态吃透，权限流程的分支会少很多「双端 if-else」。具体 kind 映射与相册选型见 [Permission API](/zh/guide/native-kit/permission)。
