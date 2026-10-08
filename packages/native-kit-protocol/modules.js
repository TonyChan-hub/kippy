import { ModuleId, PermissionKind, PermissionStatus } from './constants.js';

/** @type {ReadonlyArray<string>} */
export const PERMISSION_KINDS = Object.values(PermissionKind);

/** @type {ReadonlyArray<string>} */
export const PERMISSION_STATUSES = Object.values(PermissionStatus);

/**
 * Platform declaration recipe for the permission module.
 * Used by scaffold / native-kit CLI — not compiled into apps.
 *
 * Note: `sms` / `appList` (Android) are sensitive — injecting the recipe does not mean store approval.
 */
export const PERMISSION_RECIPE = {
  id: ModuleId.PERMISSION,
  iosUsageDescriptions: [
    {
      key: 'NSCameraUsageDescription',
      defaultValue: '{displayName} needs camera access to capture photos.',
    },
    {
      key: 'NSMicrophoneUsageDescription',
      defaultValue: '{displayName} needs microphone access to record audio.',
    },
    {
      key: 'NSPhotoLibraryUsageDescription',
      defaultValue: '{displayName} can optionally pick a photo from your library.',
    },
    {
      key: 'NSPhotoLibraryAddUsageDescription',
      defaultValue: '{displayName} can save images you choose to your photo library.',
    },
    {
      key: 'NSLocationWhenInUseUsageDescription',
      defaultValue: '{displayName} uses your location while you use the app.',
    },
    {
      key: 'NSLocationAlwaysAndWhenInUseUsageDescription',
      defaultValue: '{displayName} uses your location in the background for ongoing features.',
    },
    {
      key: 'NSLocationAlwaysUsageDescription',
      defaultValue: '{displayName} uses your location in the background for ongoing features.',
    },
    {
      key: 'NSContactsUsageDescription',
      defaultValue: '{displayName} uses your contacts to help you find people.',
    },
    {
      key: 'NSCalendarsUsageDescription',
      defaultValue: '{displayName} uses your calendar to show and create events.',
    },
    {
      key: 'NSCalendarsFullAccessUsageDescription',
      defaultValue: '{displayName} uses your calendar to show and create events.',
    },
    {
      key: 'NSUserTrackingUsageDescription',
      defaultValue: '{displayName} uses an identifier to measure ad performance.',
    },
    {
      key: 'NSBluetoothAlwaysUsageDescription',
      defaultValue: '{displayName} uses Bluetooth to connect to nearby devices.',
    },
    {
      key: 'NSSpeechRecognitionUsageDescription',
      defaultValue: '{displayName} uses speech recognition to convert your voice to text.',
    },
    {
      key: 'NSMotionUsageDescription',
      defaultValue: '{displayName} uses motion data for activity-related features.',
    },
    {
      key: 'NSRemindersUsageDescription',
      defaultValue: '{displayName} uses your reminders to show and create tasks.',
    },
    {
      key: 'NSRemindersFullAccessUsageDescription',
      defaultValue: '{displayName} uses your reminders to show and create tasks.',
    },
    {
      key: 'NSAppleMusicUsageDescription',
      defaultValue: '{displayName} accesses your media library to play or pick audio.',
    },
    {
      key: 'NSFaceIDUsageDescription',
      defaultValue: '{displayName} uses Face ID for secure authentication.',
    },
    {
      key: 'NSLocalNetworkUsageDescription',
      defaultValue: '{displayName} uses the local network to discover nearby devices.',
    },
  ],
  androidPermissions: [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_BACKGROUND_LOCATION',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.READ_CONTACTS',
    'android.permission.READ_CALENDAR',
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.ACTIVITY_RECOGNITION',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.USE_BIOMETRIC',
    // Strong compliance — store declaration required; not for casual use.
    'android.permission.READ_SMS',
    'android.permission.RECEIVE_SMS',
    'android.permission.QUERY_ALL_PACKAGES',
  ],
  androidFeatures: [
    {
      name: 'android.hardware.camera',
      required: false,
    },
    {
      name: 'android.hardware.bluetooth',
      required: false,
    },
  ],
};

/**
 * Device module: public read-only info — no Manifest / Info.plist runtime declarations.
 */
export const DEVICE_RECIPE = {
  id: ModuleId.DEVICE,
  iosUsageDescriptions: [],
  androidPermissions: [],
  androidFeatures: [],
};

/** @type {Record<string, typeof PERMISSION_RECIPE>} */
export const MODULE_RECIPES = {
  [ModuleId.PERMISSION]: PERMISSION_RECIPE,
  [ModuleId.DEVICE]: DEVICE_RECIPE,
};
