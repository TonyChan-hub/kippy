import { NativeModules, Platform } from 'react-native';
import type { NativeKitNativeModule } from './types';
import { NativeKitError } from './errors';

const LINKING_ERROR =
  `NativeKit native module is not linked. ` +
  (Platform.OS === 'ios'
    ? 'Run pod install in the ios/ directory, then rebuild.'
    : 'Rebuild the Android app after installing @bear1210/native-kit-rn.');

export function getNativeKitModule(): NativeKitNativeModule {
  const mod = NativeModules.NativeKit as NativeKitNativeModule | undefined;
  if (!mod) {
    throw new NativeKitError('NATIVE_UNAVAILABLE', LINKING_ERROR);
  }
  return mod;
}
