import { getNativeKitModule } from './nativeModule';
import { moduleNotLinked } from './errors';
import type { DeviceInfo } from './types';

const MODULE_ID = 'device';

async function assertLinked(): Promise<void> {
  const linked = await getNativeKitModule().getLinkedModules();
  if (!linked.includes(MODULE_ID)) {
    throw moduleNotLinked(MODULE_ID);
  }
}

export const device = {
  async getInfo(): Promise<DeviceInfo> {
    await assertLinked();
    return getNativeKitModule().getDeviceInfo();
  },
};
