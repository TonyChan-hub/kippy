# native_kit_flutter

Flutter facade for NativeKit.

```dart
import 'package:native_kit_flutter/native_kit_flutter.dart';

final status = await NativeKit.permission.ensure(PermissionKind.camera);
// also: microphone, photoRead, photoLimited, photoAdd, locationWhenInUse,
//       locationAlways, notification, contacts, calendar, tracking,
//       bluetooth, speechRecognition, motion, reminders, audioRead,
//       biometrics, localNetwork, sms, appList

final info = await NativeKit.device.getInfo();
```

Docs: [NativeKit guide](https://tonychan-hub.github.io/kippy/guide/native-kit) (integration + API).
