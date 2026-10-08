# 平台声明

启用 `permission` 时，脚手架 / CLI 会按 recipe 注入下列键。文案与商店申报仍由业务自行负责。

接入：[接入](./install)。API：[Permission API](./permission)。

::: warning 敏感 Android 权限
`READ_SMS`、`RECEIVE_SMS`、`QUERY_ALL_PACKAGES` 会随 permission recipe 一并注入以便完整映射。若产品不需要，请从 Manifest **删掉** — 它们会触发严格的商店审核。
:::

## iOS `Info.plist`

| Key | Kind(s) |
| --- | ------- |
| `NSCameraUsageDescription` | `camera` |
| `NSMicrophoneUsageDescription` | `microphone` |
| `NSPhotoLibraryUsageDescription` | `photoRead` / `photoLimited` |
| `NSPhotoLibraryAddUsageDescription` | `photoAdd` |
| `NSLocationWhenInUseUsageDescription` | `locationWhenInUse` |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | `locationAlways` |
| `NSLocationAlwaysUsageDescription` | `locationAlways`（旧版） |
| `NSContactsUsageDescription` | `contacts` |
| `NSCalendarsUsageDescription` | `calendar` |
| `NSCalendarsFullAccessUsageDescription` | `calendar`（iOS 17+） |
| `NSUserTrackingUsageDescription` | `tracking` |
| `NSBluetoothAlwaysUsageDescription` | `bluetooth` |
| `NSSpeechRecognitionUsageDescription` | `speechRecognition` |
| `NSMotionUsageDescription` | `motion` |
| `NSRemindersUsageDescription` | `reminders` |
| `NSRemindersFullAccessUsageDescription` | `reminders`（iOS 17+） |
| `NSAppleMusicUsageDescription` | `audioRead` |
| `NSFaceIDUsageDescription` | `biometrics` |
| `NSLocalNetworkUsageDescription` | `localNetwork` |

使用局域网发现时还需声明 Bonjour 服务（`NSBonjourServices`）。

## Android `AndroidManifest.xml`

| Permission | Kind(s) | 说明 |
| ---------- | ------- | ---- |
| `CAMERA` | `camera` | |
| `RECORD_AUDIO` | `microphone` / `speechRecognition` | |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` | `photoRead` / `photoLimited`（API 33+） | |
| `READ_MEDIA_VISUAL_USER_SELECTED` | `photoLimited` 部分授权（API 34+） | |
| `READ_EXTERNAL_STORAGE` | 相册 / 音频（旧版） | |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | 定位；Android 12 前蓝牙也可能需要 | |
| `ACCESS_BACKGROUND_LOCATION` | `locationAlways` | |
| `POST_NOTIFICATIONS` | `notification`（API 33+） | |
| `READ_CONTACTS` | `contacts` | |
| `READ_CALENDAR` | `calendar` | |
| `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` | `bluetooth`（API 31+） | |
| `ACTIVITY_RECOGNITION` | `motion`（API 29+） | |
| `READ_MEDIA_AUDIO` | `audioRead`（API 33+） | |
| `USE_BIOMETRIC` | `biometrics` | 普通权限；能力由 BiometricManager 探测 |
| `READ_SMS` / `RECEIVE_SMS` | `sms` | **强合规** |
| `QUERY_ALL_PACKAGES` | `appList` | **强合规**；安装时声明，非运行时弹窗 |

可选硬件：`android.hardware.camera` / `android.hardware.bluetooth`，`required=false`。

## Device 模块

`device` **不需要** Info.plist / Manifest 运行时声明。见 [Device API](./device)。
