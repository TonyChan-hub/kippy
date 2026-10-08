# NativeKit（Beta）

::: warning 实验中 / Beta
NativeKit **仍在实验阶段**。API 形态、模块 ID、recipe 与打包方式可能随时调整，目前没有稳定兼容承诺。建议只在可选 / 非关键路径试用，待退出 Beta 后再用于生产。
:::

NativeKit 是一套 **类 uni** 的双端原生能力门面。业务侧调用稳定的 JS/Dart API（`NativeKit.permission.*`、`NativeKit.device.*`）；只有你启用的模块才会把对应 Kotlin / Swift 实现链进 App。

| 状态 | 模块 | API |
| ---- | ---- | --- |
| Beta | `permission` | `check` / `request` / `ensure` / `openSettings` |
| Beta | `device` | `getInfo`（公开字段；非权限） |
| 规划中 | `camera`、`media` | — |

## 文档结构

| 页面 | 内容 |
| ---- | ---- |
| [接入](./install) | 创建时 / 事后启用、配置、依赖与编译 |
| [Permission API](./permission) | 方法、状态、kind（含 Android-only / 强合规标注）、错误码 |
| [Device API](./device) | 公开设备 / App 信息（无运行时权限） |
| [平台声明](./platform) | Info.plist / AndroidManifest 注入清单 |

## 与 Zippy Tools 的区别

| 层 | 作用 |
| -- | ---- |
| **NativeKit** | App 内运行时：向用户申请相机、麦克风、相册、定位、通知、通讯录、日历、ATT、蓝牙等权限 |
| **[Zippy Tools](../zippy#tools)** | 调试期用 `adb` / `simctl` 授予或撤销权限 — **不**走 NativeKit |

两套 API 不要混用。

## 相关包

| 包 | 发布 | 作用 |
| -- | ---- | ---- |
| `@bear1210/native-kit-protocol` | npm | 模块 ID、kind/status、recipe |
| `native_kit` | path | Kotlin / Swift 模块源码 |
| `@bear1210/native-kit-rn` | npm | RN 门面 + 原生桥 |
| `native_kit_flutter` | zip / path | Flutter 门面 + plugin |
| `@bear1210/native-kit` | npm | `add` / `remove` / `list` CLI |

## 路线图

后续模块（尚未交付）：`camera`（拍摄辅助）、`media`（相册保存 / 选择）。门面将以 `NativeKit.<module>.*` 扩展，不破坏现有 `permission` / `device`。
