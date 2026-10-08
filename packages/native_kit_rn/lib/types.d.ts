export type PermissionKind = 'camera' | 'microphone' | 'photoRead' | 'photoLimited' | 'photoAdd' | 'locationWhenInUse' | 'locationAlways' | 'notification' | 'contacts' | 'calendar' | 'tracking' | 'bluetooth' | 'speechRecognition' | 'motion' | 'reminders' | 'audioRead' | 'biometrics' | 'localNetwork' | 'sms' | 'appList';
export type PermissionStatus = 'granted' | 'denied' | 'permanentlyDenied' | 'restricted' | 'limited' | 'notDetermined';
export type DeviceInfo = {
    brand: string;
    model: string;
    systemName: string;
    systemVersion: string;
    appVersion: string;
    buildNumber: string;
    bundleId: string;
    isEmulator: boolean;
};
export type NativeKitNativeModule = {
    checkPermission(kind: string): Promise<string>;
    requestPermission(kind: string): Promise<string>;
    openSettings(): Promise<void>;
    getDeviceInfo(): Promise<DeviceInfo>;
    getLinkedModules(): Promise<string[]>;
};
