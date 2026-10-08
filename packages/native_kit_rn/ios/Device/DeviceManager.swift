import Foundation
import UIKit

@objc public final class NKDeviceManager: NSObject {
  /// Public, non-sensitive device / app fields only.
  /// Does not return IMEI, serial, phone number, or installed app lists.
  @objc public static func getInfo() -> [String: Any] {
    let info = Bundle.main.infoDictionary
    let appVersion = (info?["CFBundleShortVersionString"] as? String) ?? ""
    let buildNumber = (info?["CFBundleVersion"] as? String) ?? ""
    let bundleId = Bundle.main.bundleIdentifier ?? ""

    var systemInfo = utsname()
    uname(&systemInfo)
    let machineMirror = Mirror(reflecting: systemInfo.machine)
    let identifier = machineMirror.children.reduce("") { identifier, element in
      guard let value = element.value as? Int8, value != 0 else { return identifier }
      return identifier + String(UnicodeScalar(UInt8(value)))
    }

    return [
      "brand": "Apple",
      "model": identifier.isEmpty ? UIDevice.current.model : identifier,
      "systemName": UIDevice.current.systemName,
      "systemVersion": UIDevice.current.systemVersion,
      "appVersion": appVersion,
      "buildNumber": buildNumber,
      "bundleId": bundleId,
      "isEmulator": isEmulator(),
    ]
  }

  private static func isEmulator() -> Bool {
    #if targetEnvironment(simulator)
      return true
    #else
      return false
    #endif
  }
}
