import { permission } from './permission';
import { device } from './device';

export type { PermissionKind, PermissionStatus, DeviceInfo } from './types';
export { NativeKitError } from './errors';
export { permission, device };

export const NativeKit = {
  permission,
  device,
};

export default NativeKit;
