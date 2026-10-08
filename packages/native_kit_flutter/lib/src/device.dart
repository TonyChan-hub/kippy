import 'errors.dart';
import 'channel.dart';
import 'types.dart';

class NativeKitDevice {
  const NativeKitDevice();

  static const _moduleId = 'device';

  Future<void> _assertLinked() async {
    final linked = await nativeKitChannel.invokeListMethod<String>('getLinkedModules') ??
        const <String>[];
    if (!linked.contains(_moduleId)) {
      throw moduleNotLinked(_moduleId);
    }
  }

  /// Public device / app fields only (no IMEI, phone number, or app list).
  Future<DeviceInfo> getInfo() async {
    await _assertLinked();
    final raw = await nativeKitChannel.invokeMapMethod<Object?, Object?>('getDeviceInfo');
    return DeviceInfo.fromMap(raw ?? const <Object?, Object?>{});
  }
}
