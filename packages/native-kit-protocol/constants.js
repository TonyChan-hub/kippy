/** @enum {string} */
export const ModuleId = {
  PERMISSION: 'permission',
  DEVICE: 'device',
};

/** Modules with a shipped native implementation. */
export const SHIPPED_MODULES = [ModuleId.PERMISSION, ModuleId.DEVICE];

/** Roadmap module ids (not shipped). */
export const ROADMAP_MODULES = ['camera', 'media'];

/** @enum {string} */
export const PermissionKind = {
  CAMERA: 'camera',
  MICROPHONE: 'microphone',
  PHOTO_READ: 'photoRead',
  PHOTO_LIMITED: 'photoLimited',
  PHOTO_ADD: 'photoAdd',
  LOCATION_WHEN_IN_USE: 'locationWhenInUse',
  LOCATION_ALWAYS: 'locationAlways',
  NOTIFICATION: 'notification',
  CONTACTS: 'contacts',
  CALENDAR: 'calendar',
  TRACKING: 'tracking',
  BLUETOOTH: 'bluetooth',
  SPEECH_RECOGNITION: 'speechRecognition',
  MOTION: 'motion',
  REMINDERS: 'reminders',
  AUDIO_READ: 'audioRead',
  BIOMETRICS: 'biometrics',
  LOCAL_NETWORK: 'localNetwork',
  SMS: 'sms',
  APP_LIST: 'appList',
};

/** @enum {string} */
export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PERMANENTLY_DENIED: 'permanentlyDenied',
  RESTRICTED: 'restricted',
  LIMITED: 'limited',
  NOT_DETERMINED: 'notDetermined',
};

/** @enum {string} */
export const NativeKitErrorCode = {
  MODULE_NOT_LINKED: 'MODULE_NOT_LINKED',
  INVALID_KIND: 'INVALID_KIND',
  NATIVE_UNAVAILABLE: 'NATIVE_UNAVAILABLE',
  REQUEST_IN_PROGRESS: 'REQUEST_IN_PROGRESS',
};

export const CHANNEL_NAME = 'native_kit';

export const PRESETS = {
  media: [ModuleId.PERMISSION],
};
