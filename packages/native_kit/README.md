# native_kit

Shared Kotlin / Swift sources for NativeKit modules. Bridges (`native_kit_rn`, `native_kit_flutter`) ship copies of these sources.

## Modules

| Module | Android | iOS |
| ------ | ------- | --- |
| `permission` | `permission/PermissionManager.kt` | `Permission/PermissionManager.swift` |
| `device` | `device/DeviceManager.kt` | `Device/DeviceManager.swift` |

### Permission kinds

`camera` · `microphone` · `photoRead` · `photoLimited` · `photoAdd` · `locationWhenInUse` · `locationAlways` · `notification` · `contacts` · `calendar` · `tracking` · `bluetooth` · `speechRecognition` · `motion` · `reminders` · `audioRead` · `biometrics` · `localNetwork` · `sms` · `appList`

Notes:

- `sms` / `appList` — Android-only, strong store compliance
- `reminders` — iOS-only (`restricted` on Android)
- `localNetwork` — iOS-focused (`granted` on Android)
- `device.getInfo` — public fields only; not a permission

See the [NativeKit guide](https://tonychan-hub.github.io/kippy/guide/native-kit).
