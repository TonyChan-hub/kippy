import path from 'node:path';
import fs from 'fs-extra';

const RN_PERMISSIONS = `import { NativeKit } from '@bear1210/native-kit-rn';
import type { PermissionKind, PermissionStatus } from '@bear1210/native-kit-rn';

export { NativeKit };
export type { PermissionKind, PermissionStatus };

export async function ensurePermission(kind: PermissionKind): Promise<PermissionStatus> {
  return NativeKit.permission.ensure(kind);
}
`;

const FLUTTER_CAMERA = `import 'package:native_kit_flutter/native_kit_flutter.dart';

enum CameraPermissionResult {
  granted,
  denied,
  permanentlyDenied,
}

/// System camera permission via NativeKit (no custom rationale UI).
class CameraPermission {
  CameraPermission._();

  static Future<CameraPermissionResult> ensureCameraPermission() async {
    final status = await NativeKit.permission.ensure(PermissionKind.camera);
    switch (status) {
      case PermissionStatus.granted:
      case PermissionStatus.limited:
        return CameraPermissionResult.granted;
      case PermissionStatus.permanentlyDenied:
      case PermissionStatus.restricted:
        return CameraPermissionResult.permanentlyDenied;
      case PermissionStatus.denied:
      case PermissionStatus.notDetermined:
        return CameraPermissionResult.denied;
    }
  }

  static Future<void> openSettings() => NativeKit.permission.openSettings();
}
`;

const FLUTTER_PHOTO = `import 'package:native_kit_flutter/native_kit_flutter.dart';

/// Add-only photo library access used when saving an image.
class PhotoLibraryPermission {
  PhotoLibraryPermission._();

  static Future<bool> hasAddAccess() async {
    final status = await NativeKit.permission.check(PermissionKind.photoAdd);
    return status == PermissionStatus.granted || status == PermissionStatus.limited;
  }

  static Future<bool> requestAddAccess() async {
    final status = await NativeKit.permission.ensure(PermissionKind.photoAdd);
    return status == PermissionStatus.granted || status == PermissionStatus.limited;
  }

  static Future<void> openSettings() => NativeKit.permission.openSettings();
}
`;

/**
 * @param {string} projectDir
 * @param {'rn' | 'flutter'} platform
 * @param {string[]} modules
 */
export async function writeHelperSnippets(projectDir, platform, modules) {
  const hasPermission = modules.includes('permission');

  if (platform === 'rn') {
    const file = path.join(projectDir, 'src', 'native', 'permissions.ts');
    if (hasPermission) {
      await fs.ensureDir(path.dirname(file));
      await fs.writeFile(file, RN_PERMISSIONS, 'utf8');
    } else if (await fs.pathExists(file)) {
      await fs.remove(file);
    }
    return;
  }

  if (platform === 'flutter') {
    const camera = path.join(
      projectDir,
      'lib',
      'core',
      'permissions',
      'camera_permission.dart'
    );
    const photo = path.join(
      projectDir,
      'lib',
      'core',
      'permissions',
      'photo_library_permission.dart'
    );
    if (hasPermission) {
      await fs.ensureDir(path.dirname(camera));
      await fs.writeFile(camera, FLUTTER_CAMERA, 'utf8');
      await fs.writeFile(photo, FLUTTER_PHOTO, 'utf8');
    }
  }
}
