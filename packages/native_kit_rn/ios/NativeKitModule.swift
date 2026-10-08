import Foundation
import React

@objc(NativeKit)
class NativeKitModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func getLinkedModules(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(["permission", "device"])
  }

  @objc
  func checkPermission(
    _ kind: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    NKPermissionManager.check(kind) { status in
      resolve(status)
    }
  }

  @objc
  func requestPermission(
    _ kind: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    NKPermissionManager.request(kind) { status in
      resolve(status)
    }
  }

  @objc
  func openSettings(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    NKPermissionManager.openSettings()
    resolve(nil)
  }

  @objc
  func getDeviceInfo(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(NKDeviceManager.getInfo())
  }
}
