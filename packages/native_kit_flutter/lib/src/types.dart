enum PermissionKind {
  camera,
  microphone,
  photoRead,
  photoLimited,
  photoAdd,
  locationWhenInUse,
  locationAlways,
  notification,
  contacts,
  calendar,
  tracking,
  bluetooth,
  speechRecognition,
  motion,
  reminders,
  audioRead,
  biometrics,
  localNetwork,
  sms,
  appList,
}

enum PermissionStatus {
  granted,
  denied,
  permanentlyDenied,
  restricted,
  limited,
  notDetermined,
}

class DeviceInfo {
  const DeviceInfo({
    required this.brand,
    required this.model,
    required this.systemName,
    required this.systemVersion,
    required this.appVersion,
    required this.buildNumber,
    required this.bundleId,
    required this.isEmulator,
  });

  final String brand;
  final String model;
  final String systemName;
  final String systemVersion;
  final String appVersion;
  final String buildNumber;
  final String bundleId;
  final bool isEmulator;

  factory DeviceInfo.fromMap(Map<Object?, Object?> map) {
    return DeviceInfo(
      brand: map['brand']?.toString() ?? '',
      model: map['model']?.toString() ?? '',
      systemName: map['systemName']?.toString() ?? '',
      systemVersion: map['systemVersion']?.toString() ?? '',
      appVersion: map['appVersion']?.toString() ?? '',
      buildNumber: map['buildNumber']?.toString() ?? '',
      bundleId: map['bundleId']?.toString() ?? '',
      isEmulator: map['isEmulator'] == true,
    );
  }
}

extension PermissionKindWire on PermissionKind {
  String get wireName {
    switch (this) {
      case PermissionKind.camera:
        return 'camera';
      case PermissionKind.microphone:
        return 'microphone';
      case PermissionKind.photoRead:
        return 'photoRead';
      case PermissionKind.photoLimited:
        return 'photoLimited';
      case PermissionKind.photoAdd:
        return 'photoAdd';
      case PermissionKind.locationWhenInUse:
        return 'locationWhenInUse';
      case PermissionKind.locationAlways:
        return 'locationAlways';
      case PermissionKind.notification:
        return 'notification';
      case PermissionKind.contacts:
        return 'contacts';
      case PermissionKind.calendar:
        return 'calendar';
      case PermissionKind.tracking:
        return 'tracking';
      case PermissionKind.bluetooth:
        return 'bluetooth';
      case PermissionKind.speechRecognition:
        return 'speechRecognition';
      case PermissionKind.motion:
        return 'motion';
      case PermissionKind.reminders:
        return 'reminders';
      case PermissionKind.audioRead:
        return 'audioRead';
      case PermissionKind.biometrics:
        return 'biometrics';
      case PermissionKind.localNetwork:
        return 'localNetwork';
      case PermissionKind.sms:
        return 'sms';
      case PermissionKind.appList:
        return 'appList';
    }
  }
}

PermissionStatus permissionStatusFromWire(String value) {
  switch (value) {
    case 'granted':
      return PermissionStatus.granted;
    case 'denied':
      return PermissionStatus.denied;
    case 'permanentlyDenied':
      return PermissionStatus.permanentlyDenied;
    case 'restricted':
      return PermissionStatus.restricted;
    case 'limited':
      return PermissionStatus.limited;
    case 'notDetermined':
      return PermissionStatus.notDetermined;
    default:
      return PermissionStatus.denied;
  }
}
