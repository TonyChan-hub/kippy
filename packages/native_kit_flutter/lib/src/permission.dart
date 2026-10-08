import 'errors.dart';
import 'channel.dart';
import 'types.dart';

class NativeKitPermission {
  const NativeKitPermission();

  static const _moduleId = 'permission';

  Future<void> _assertLinked() async {
    final linked = await nativeKitChannel.invokeListMethod<String>('getLinkedModules') ??
        const <String>[];
    if (!linked.contains(_moduleId)) {
      throw moduleNotLinked(_moduleId);
    }
  }

  Future<PermissionStatus> check(PermissionKind kind) async {
    await _assertLinked();
    final raw = await nativeKitChannel.invokeMethod<String>(
      'checkPermission',
      {'kind': kind.wireName},
    );
    return permissionStatusFromWire(raw ?? 'denied');
  }

  Future<PermissionStatus> request(PermissionKind kind) async {
    await _assertLinked();
    final raw = await nativeKitChannel.invokeMethod<String>(
      'requestPermission',
      {'kind': kind.wireName},
    );
    return permissionStatusFromWire(raw ?? 'denied');
  }

  Future<PermissionStatus> ensure(PermissionKind kind) async {
    final current = await check(kind);
    if (current == PermissionStatus.granted ||
        current == PermissionStatus.limited ||
        current == PermissionStatus.permanentlyDenied ||
        current == PermissionStatus.restricted) {
      return current;
    }
    return request(kind);
  }

  Future<void> openSettings() async {
    await _assertLinked();
    await nativeKitChannel.invokeMethod<void>('openSettings');
  }
}
