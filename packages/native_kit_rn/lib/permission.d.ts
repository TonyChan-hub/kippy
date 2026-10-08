import type { PermissionKind, PermissionStatus } from './types';
export declare const permission: {
    check(kind: PermissionKind): Promise<PermissionStatus>;
    request(kind: PermissionKind): Promise<PermissionStatus>;
    ensure(kind: PermissionKind): Promise<PermissionStatus>;
    openSettings(): Promise<void>;
};
