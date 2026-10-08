import { getNativeKitModule } from './nativeModule';
import { moduleNotLinked } from './errors';
import type { PermissionKind, PermissionStatus } from './types';

const MODULE_ID = 'permission';

async function assertLinked(): Promise<void> {
  const linked = await getNativeKitModule().getLinkedModules();
  if (!linked.includes(MODULE_ID)) {
    throw moduleNotLinked(MODULE_ID);
  }
}

async function asStatus(value: string): Promise<PermissionStatus> {
  return value as PermissionStatus;
}

export const permission = {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    await assertLinked();
    return asStatus(await getNativeKitModule().checkPermission(kind));
  },

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    await assertLinked();
    return asStatus(await getNativeKitModule().requestPermission(kind));
  },

  async ensure(kind: PermissionKind): Promise<PermissionStatus> {
    const current = await permission.check(kind);
    if (
      current === 'granted' ||
      current === 'limited' ||
      current === 'permanentlyDenied' ||
      current === 'restricted'
    ) {
      return current;
    }
    return permission.request(kind);
  },

  async openSettings(): Promise<void> {
    await assertLinked();
    await getNativeKitModule().openSettings();
  },
};
