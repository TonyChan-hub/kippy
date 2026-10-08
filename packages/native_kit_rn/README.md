# `@bear1210/native-kit-rn`

React Native facade for NativeKit.

```ts
import { NativeKit } from '@bear1210/native-kit-rn';

const status = await NativeKit.permission.ensure('camera');
// also: microphone | photoRead | photoLimited | photoAdd | locationWhenInUse |
//       locationAlways | notification | contacts | calendar | tracking |
//       bluetooth | speechRecognition | motion | reminders | audioRead |
//       biometrics | localNetwork | sms | appList

const info = await NativeKit.device.getInfo();
```

Docs: [NativeKit guide](https://tonychan-hub.github.io/AppSetup/guide/native-kit) (integration + API).
