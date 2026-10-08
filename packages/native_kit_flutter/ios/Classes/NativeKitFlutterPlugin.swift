import Flutter
import UIKit

public class NativeKitFlutterPlugin: NSObject, FlutterPlugin {
  public static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "native_kit", binaryMessenger: registrar.messenger())
    let instance = NativeKitFlutterPlugin()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "getLinkedModules":
      result(["permission", "device"])
    case "checkPermission":
      guard
        let args = call.arguments as? [String: Any],
        let kind = args["kind"] as? String
      else {
        result(
          FlutterError(code: "INVALID_KIND", message: "Missing kind", details: nil)
        )
        return
      }
      NKPermissionManager.check(kind) { status in
        result(status)
      }
    case "requestPermission":
      guard
        let args = call.arguments as? [String: Any],
        let kind = args["kind"] as? String
      else {
        result(
          FlutterError(code: "INVALID_KIND", message: "Missing kind", details: nil)
        )
        return
      }
      NKPermissionManager.request(kind) { status in
        result(status)
      }
    case "openSettings":
      NKPermissionManager.openSettings()
      result(nil)
    case "getDeviceInfo":
      result(NKDeviceManager.getInfo())
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
