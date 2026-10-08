import { permission } from './permission';
import { device } from './device';
export type { PermissionKind, PermissionStatus, DeviceInfo } from './types';
export { NativeKitError } from './errors';
export { permission, device };
export declare const NativeKit: {
    permission: {
        check(kind: import("./types").PermissionKind): Promise<import("./types").PermissionStatus>;
        request(kind: import("./types").PermissionKind): Promise<import("./types").PermissionStatus>;
        ensure(kind: import("./types").PermissionKind): Promise<import("./types").PermissionStatus>;
        openSettings(): Promise<void>;
    };
    device: {
        getInfo(): Promise<import("./types").DeviceInfo>;
    };
};
export default NativeKit;
