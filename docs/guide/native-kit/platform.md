# Platform declarations

Enabling `permission` injects the keys below via scaffold / CLI recipe. Apps still own final copy and store declarations.

Setup: [Install](./install). API: [Permission API](./permission).

::: warning Sensitive Android permissions
`READ_SMS`, `RECEIVE_SMS`, and `QUERY_ALL_PACKAGES` are injected with the permission recipe for completeness. Remove them from the Manifest if your product does not need them — they trigger strict store review.
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
| `NSLocationAlwaysUsageDescription` | `locationAlways` (legacy) |
| `NSContactsUsageDescription` | `contacts` |
| `NSCalendarsUsageDescription` | `calendar` |
| `NSCalendarsFullAccessUsageDescription` | `calendar` (iOS 17+) |
| `NSUserTrackingUsageDescription` | `tracking` |
| `NSBluetoothAlwaysUsageDescription` | `bluetooth` |
| `NSSpeechRecognitionUsageDescription` | `speechRecognition` |
| `NSMotionUsageDescription` | `motion` |
| `NSRemindersUsageDescription` | `reminders` |
| `NSRemindersFullAccessUsageDescription` | `reminders` (iOS 17+) |
| `NSAppleMusicUsageDescription` | `audioRead` |
| `NSFaceIDUsageDescription` | `biometrics` |
| `NSLocalNetworkUsageDescription` | `localNetwork` |

Also declare Bonjour services (`NSBonjourServices`) when using local network discovery.

## Android `AndroidManifest.xml`

| Permission | Kind(s) | Notes |
| ---------- | ------- | ----- |
| `CAMERA` | `camera` | |
| `RECORD_AUDIO` | `microphone` / `speechRecognition` | |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` | `photoRead` / `photoLimited` (API 33+) | |
| `READ_MEDIA_VISUAL_USER_SELECTED` | `photoLimited` partial (API 34+) | |
| `READ_EXTERNAL_STORAGE` | photo / audio (older) | |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | location; also pre-12 bluetooth | |
| `ACCESS_BACKGROUND_LOCATION` | `locationAlways` | |
| `POST_NOTIFICATIONS` | `notification` (API 33+) | |
| `READ_CONTACTS` | `contacts` | |
| `READ_CALENDAR` | `calendar` | |
| `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` | `bluetooth` (API 31+) | |
| `ACTIVITY_RECOGNITION` | `motion` (API 29+) | |
| `READ_MEDIA_AUDIO` | `audioRead` (API 33+) | |
| `USE_BIOMETRIC` | `biometrics` | Normal permission; capability via BiometricManager |
| `READ_SMS` / `RECEIVE_SMS` | `sms` | **Strong compliance** |
| `QUERY_ALL_PACKAGES` | `appList` | **Strong compliance**; install-time, not a runtime dialog |

Optional features: `android.hardware.camera` / `android.hardware.bluetooth` with `required=false`.

## Device module

`device` needs **no** Info.plist / Manifest runtime declarations. See [Device API](./device).
