import AppTrackingTransparency
import AVFoundation
import Contacts
import CoreBluetooth
import CoreLocation
import CoreMotion
import EventKit
import Foundation
import LocalAuthentication
import MediaPlayer
import Photos
import Speech
import UIKit
import UserNotifications

@objc public final class NKPermissionManager: NSObject {
  public static let statusGranted = "granted"
  public static let statusDenied = "denied"
  public static let statusPermanentlyDenied = "permanentlyDenied"
  public static let statusRestricted = "restricted"
  public static let statusLimited = "limited"
  public static let statusNotDetermined = "notDetermined"

  /// Async check — required for notification / tracking consistency with request.
  @objc public static func check(_ kind: String, completion: @escaping (String) -> Void) {
    switch kind {
    case "camera":
      completion(mapAV(AVCaptureDevice.authorizationStatus(for: .video)))
    case "microphone":
      completion(mapAV(AVCaptureDevice.authorizationStatus(for: .audio)))
    case "photoRead", "photoLimited":
      // Same underlying status; photoRead wants full, photoLimited accepts limited.
      completion(mapPhoto(PHPhotoLibrary.authorizationStatus(for: .readWrite)))
    case "photoAdd":
      completion(mapPhoto(PHPhotoLibrary.authorizationStatus(for: .addOnly)))
    case "locationWhenInUse":
      completion(mapLocation(CLLocationManager().authorizationStatus, always: false))
    case "locationAlways":
      completion(mapLocation(CLLocationManager().authorizationStatus, always: true))
    case "notification":
      checkNotification(completion: completion)
    case "contacts":
      completion(mapContacts(CNContactStore.authorizationStatus(for: .contacts)))
    case "calendar":
      completion(mapCalendar(Self.calendarAuthorizationStatus()))
    case "tracking":
      completion(mapTracking())
    case "bluetooth":
      completion(mapBluetooth())
    case "speechRecognition":
      completion(mapSpeech(SFSpeechRecognizer.authorizationStatus()))
    case "motion":
      completion(mapMotion())
    case "reminders":
      completion(mapReminders(Self.remindersAuthorizationStatus()))
    case "audioRead":
      completion(mapMediaLibrary(MPMediaLibrary.authorizationStatus()))
    case "biometrics":
      completion(mapBiometrics())
    case "localNetwork":
      completion(statusNotDetermined)
    case "sms", "appList":
      completion(statusRestricted) // Android-only
    default:
      completion(statusDenied)
    }
  }

  @objc public static func request(_ kind: String, completion: @escaping (String) -> Void) {
    switch kind {
    case "camera":
      requestAV(.video, completion: completion)
    case "microphone":
      requestAV(.audio, completion: completion)
    case "photoRead":
      requestPhotoRead(completion: completion)
    case "photoLimited":
      requestPhotoLimited(completion: completion)
    case "photoAdd":
      requestPhoto(.addOnly, completion: completion)
    case "locationWhenInUse":
      requestLocation(always: false, completion: completion)
    case "locationAlways":
      requestLocation(always: true, completion: completion)
    case "notification":
      requestNotification(completion: completion)
    case "contacts":
      requestContacts(completion: completion)
    case "calendar":
      requestCalendar(completion: completion)
    case "tracking":
      requestTracking(completion: completion)
    case "bluetooth":
      requestBluetooth(completion: completion)
    case "speechRecognition":
      requestSpeech(completion: completion)
    case "motion":
      requestMotion(completion: completion)
    case "reminders":
      requestReminders(completion: completion)
    case "audioRead":
      requestAudioRead(completion: completion)
    case "biometrics":
      completion(mapBiometrics())
    case "localNetwork":
      // No public preflight API — system prompts on first Bonjour/local use.
      completion(statusNotDetermined)
    case "sms", "appList":
      completion(statusRestricted)
    default:
      completion(statusDenied)
    }
  }

  @objc public static func openSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    DispatchQueue.main.async {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
  }

  private static func checkNotification(completion: @escaping (String) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        completion(mapNotification(settings.authorizationStatus))
      }
    }
  }

  private static func requestAV(_ media: AVMediaType, completion: @escaping (String) -> Void) {
    let current = AVCaptureDevice.authorizationStatus(for: media)
    if current == .authorized {
      completion(statusGranted)
      return
    }
    if current == .denied || current == .restricted {
      completion(mapAV(current))
      return
    }
    AVCaptureDevice.requestAccess(for: media) { granted in
      DispatchQueue.main.async {
        completion(granted ? statusGranted : statusDenied)
      }
    }
  }

  /// Full library read. If user already chose Limited Photos, returns `limited`
  /// (upgrade requires Settings — do not re-prompt).
  private static func requestPhotoRead(completion: @escaping (String) -> Void) {
    let current = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if current == .authorized {
      completion(statusGranted)
      return
    }
    if current == .limited {
      completion(statusLimited)
      return
    }
    if current == .denied || current == .restricted {
      completion(mapPhoto(current))
      return
    }
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
      DispatchQueue.main.async {
        completion(mapPhoto(status))
      }
    }
  }

  /// Selected-range / limited library access.
  /// First ask uses the system dialog (user may pick Limited or Full).
  /// If already limited, presents the limited-library picker to change the selection.
  private static func requestPhotoLimited(completion: @escaping (String) -> Void) {
    let current = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if current == .authorized {
      completion(statusGranted)
      return
    }
    if current == .limited {
      presentLimitedLibraryPicker {
        completion(mapPhoto(PHPhotoLibrary.authorizationStatus(for: .readWrite)))
      }
      return
    }
    if current == .denied || current == .restricted {
      completion(mapPhoto(current))
      return
    }
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
      DispatchQueue.main.async {
        completion(mapPhoto(status))
      }
    }
  }

  private static func presentLimitedLibraryPicker(completion: @escaping () -> Void) {
    DispatchQueue.main.async {
      guard let vc = topViewController() else {
        completion()
        return
      }
      if #available(iOS 15.0, *) {
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: vc) { _ in
          completion()
        }
      } else if #available(iOS 14.0, *) {
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: vc)
        // No completion on iOS 14 — report current status after presentation.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: completion)
      } else {
        completion()
      }
    }
  }

  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window =
      scenes.flatMap(\.windows).first(where: \.isKeyWindow)
      ?? scenes.flatMap(\.windows).first
    var top = window?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }

  private static func requestPhoto(
    _ level: PHAccessLevel,
    completion: @escaping (String) -> Void
  ) {
    let current = PHPhotoLibrary.authorizationStatus(for: level)
    if current == .authorized || current == .limited {
      completion(mapPhoto(current))
      return
    }
    if current == .denied || current == .restricted {
      completion(mapPhoto(current))
      return
    }
    PHPhotoLibrary.requestAuthorization(for: level) { status in
      DispatchQueue.main.async {
        completion(mapPhoto(status))
      }
    }
  }

  private static func requestLocation(always: Bool, completion: @escaping (String) -> Void) {
    let manager = CLLocationManager()
    let status = manager.authorizationStatus
    if always {
      if status == .authorizedAlways {
        completion(statusGranted)
        return
      }
    } else if status == .authorizedWhenInUse || status == .authorizedAlways {
      completion(statusGranted)
      return
    }
    if status == .denied {
      completion(statusPermanentlyDenied)
      return
    }
    if status == .restricted {
      completion(statusRestricted)
      return
    }

    let delegate = LocationDelegate(always: always) { result in
      completion(result)
    }
    objc_setAssociatedObject(
      manager,
      &LocationDelegate.assocKey,
      delegate,
      .OBJC_ASSOCIATION_RETAIN_NONATOMIC
    )
    manager.delegate = delegate
    if always {
      manager.requestAlwaysAuthorization()
    } else {
      manager.requestWhenInUseAuthorization()
    }
  }

  private static func requestNotification(completion: @escaping (String) -> Void) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        DispatchQueue.main.async { completion(statusGranted) }
      case .denied:
        DispatchQueue.main.async { completion(statusPermanentlyDenied) }
      case .notDetermined:
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
          DispatchQueue.main.async {
            completion(granted ? statusGranted : statusDenied)
          }
        }
      @unknown default:
        DispatchQueue.main.async { completion(statusDenied) }
      }
    }
  }

  private static func requestContacts(completion: @escaping (String) -> Void) {
    let status = CNContactStore.authorizationStatus(for: .contacts)
    if status == .authorized {
      completion(statusGranted)
      return
    }
    if #available(iOS 18.0, *), status == .limited {
      completion(statusLimited)
      return
    }
    if status == .denied || status == .restricted {
      completion(mapContacts(status))
      return
    }
    CNContactStore().requestAccess(for: .contacts) { granted, _ in
      DispatchQueue.main.async {
        if granted {
          completion(statusGranted)
        } else {
          completion(mapContacts(CNContactStore.authorizationStatus(for: .contacts)))
        }
      }
    }
  }

  private static func calendarAuthorizationStatus() -> EKAuthorizationStatus {
    if #available(iOS 17.0, *) {
      return EKEventStore.authorizationStatus(for: .event)
    }
    return EKEventStore.authorizationStatus(for: .event)
  }

  private static func requestCalendar(completion: @escaping (String) -> Void) {
    let status = calendarAuthorizationStatus()
    if #available(iOS 17.0, *) {
      if status == .fullAccess {
        completion(statusGranted)
        return
      }
      if status == .writeOnly {
        completion(statusLimited)
        return
      }
    } else if status == .authorized {
      completion(statusGranted)
      return
    }
    if status == .denied || status == .restricted {
      completion(mapCalendar(status))
      return
    }

    let store = EKEventStore()
    if #available(iOS 17.0, *) {
      store.requestFullAccessToEvents { granted, _ in
        DispatchQueue.main.async {
          completion(granted ? statusGranted : mapCalendar(Self.calendarAuthorizationStatus()))
        }
      }
    } else {
      store.requestAccess(to: .event) { granted, _ in
        DispatchQueue.main.async {
          completion(granted ? statusGranted : mapCalendar(Self.calendarAuthorizationStatus()))
        }
      }
    }
  }

  private static func mapTracking() -> String {
    if #available(iOS 14, *) {
      switch ATTrackingManager.trackingAuthorizationStatus {
      case .authorized: return statusGranted
      case .denied: return statusPermanentlyDenied
      case .restricted: return statusRestricted
      case .notDetermined: return statusNotDetermined
      @unknown default: return statusDenied
      }
    }
    return statusGranted
  }

  private static func mapBluetooth() -> String {
    if #available(iOS 13.1, *) {
      switch CBCentralManager.authorization {
      case .allowedAlways: return statusGranted
      case .denied: return statusPermanentlyDenied
      case .restricted: return statusRestricted
      case .notDetermined: return statusNotDetermined
      @unknown default: return statusDenied
      }
    }
    return statusNotDetermined
  }

  private static func requestBluetooth(completion: @escaping (String) -> Void) {
    let status = mapBluetooth()
    if status != statusNotDetermined {
      completion(status)
      return
    }
    // Creating a central manager triggers the system Bluetooth permission prompt.
    var retained: CBCentralManager?
    let delegate = BluetoothAuthDelegate { mapped in
      retained = nil
      completion(mapped)
    }
    let manager = CBCentralManager(delegate: delegate, queue: nil, options: [
      CBCentralManagerOptionShowPowerAlertKey: false,
    ])
    objc_setAssociatedObject(
      manager,
      &BluetoothAuthDelegate.assocKey,
      delegate,
      .OBJC_ASSOCIATION_RETAIN_NONATOMIC
    )
    retained = manager
    _ = retained
  }

  private static func mapSpeech(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
    switch status {
    case .authorized: return statusGranted
    case .denied: return statusPermanentlyDenied
    case .restricted: return statusRestricted
    case .notDetermined: return statusNotDetermined
    @unknown default: return statusDenied
    }
  }

  private static func requestSpeech(completion: @escaping (String) -> Void) {
    let current = SFSpeechRecognizer.authorizationStatus()
    if current != .notDetermined {
      completion(mapSpeech(current))
      return
    }
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        completion(mapSpeech(status))
      }
    }
  }

  private static func mapMotion() -> String {
    if #available(iOS 11.0, *) {
      switch CMMotionActivityManager.authorizationStatus() {
      case .authorized: return statusGranted
      case .denied: return statusPermanentlyDenied
      case .restricted: return statusRestricted
      case .notDetermined: return statusNotDetermined
      @unknown default: return statusDenied
      }
    }
    return statusNotDetermined
  }

  private static func requestMotion(completion: @escaping (String) -> Void) {
    let status = mapMotion()
    if status != statusNotDetermined {
      completion(status)
      return
    }
    guard CMMotionActivityManager.isActivityAvailable() else {
      completion(statusRestricted)
      return
    }
    let manager = CMMotionActivityManager()
    let now = Date()
    manager.queryActivityStarting(from: now, to: now, to: .main) { _, error in
      if let error = error as NSError?,
         error.domain == CMErrorDomain,
         error.code == Int(CMErrorMotionActivityNotAuthorized.rawValue)
      {
        completion(statusPermanentlyDenied)
        return
      }
      completion(mapMotion())
    }
  }

  private static func remindersAuthorizationStatus() -> EKAuthorizationStatus {
    if #available(iOS 17.0, *) {
      return EKEventStore.authorizationStatus(for: .reminder)
    }
    return EKEventStore.authorizationStatus(for: .reminder)
  }

  private static func mapReminders(_ status: EKAuthorizationStatus) -> String {
    mapCalendar(status)
  }

  private static func requestReminders(completion: @escaping (String) -> Void) {
    let status = remindersAuthorizationStatus()
    if #available(iOS 17.0, *) {
      if status == .fullAccess {
        completion(statusGranted)
        return
      }
      if status == .writeOnly {
        completion(statusLimited)
        return
      }
    } else if status == .authorized {
      completion(statusGranted)
      return
    }
    if status == .denied || status == .restricted {
      completion(mapReminders(status))
      return
    }

    let store = EKEventStore()
    if #available(iOS 17.0, *) {
      store.requestFullAccessToReminders { granted, _ in
        DispatchQueue.main.async {
          completion(granted ? statusGranted : mapReminders(Self.remindersAuthorizationStatus()))
        }
      }
    } else {
      store.requestAccess(to: .reminder) { granted, _ in
        DispatchQueue.main.async {
          completion(granted ? statusGranted : mapReminders(Self.remindersAuthorizationStatus()))
        }
      }
    }
  }

  private static func mapMediaLibrary(_ status: MPMediaLibraryAuthorizationStatus) -> String {
    switch status {
    case .authorized: return statusGranted
    case .denied: return statusPermanentlyDenied
    case .restricted: return statusRestricted
    case .notDetermined: return statusNotDetermined
    @unknown default: return statusDenied
    }
  }

  private static func requestAudioRead(completion: @escaping (String) -> Void) {
    let current = MPMediaLibrary.authorizationStatus()
    if current != .notDetermined {
      completion(mapMediaLibrary(current))
      return
    }
    MPMediaLibrary.requestAuthorization { status in
      DispatchQueue.main.async {
        completion(mapMediaLibrary(status))
      }
    }
  }

  private static func mapBiometrics() -> String {
    let context = LAContext()
    var error: NSError?
    if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
      return statusGranted
    }
    if let error = error as? LAError {
      switch error.code {
      case .biometryNotEnrolled, .passcodeNotSet:
        return statusDenied
      case .biometryNotAvailable:
        return statusRestricted
      default:
        return statusDenied
      }
    }
    return statusRestricted
  }

  private static func requestTracking(completion: @escaping (String) -> Void) {
    if #available(iOS 14, *) {
      let status = ATTrackingManager.trackingAuthorizationStatus
      if status != .notDetermined {
        completion(mapTracking())
        return
      }
      ATTrackingManager.requestTrackingAuthorization { newStatus in
        DispatchQueue.main.async {
          switch newStatus {
          case .authorized: completion(statusGranted)
          case .denied: completion(statusDenied)
          case .restricted: completion(statusRestricted)
          case .notDetermined: completion(statusNotDetermined)
          @unknown default: completion(statusDenied)
          }
        }
      }
    } else {
      completion(statusGranted)
    }
  }

  private static func mapAV(_ status: AVAuthorizationStatus) -> String {
    switch status {
    case .authorized: return statusGranted
    case .denied: return statusPermanentlyDenied
    case .restricted: return statusRestricted
    case .notDetermined: return statusNotDetermined
    @unknown default: return statusDenied
    }
  }

  private static func mapPhoto(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .authorized: return statusGranted
    case .limited: return statusLimited
    case .denied: return statusPermanentlyDenied
    case .restricted: return statusRestricted
    case .notDetermined: return statusNotDetermined
    @unknown default: return statusDenied
    }
  }

  private static func mapLocation(_ status: CLAuthorizationStatus, always: Bool) -> String {
    switch status {
    case .authorizedAlways:
      return statusGranted
    case .authorizedWhenInUse:
      return always ? statusDenied : statusGranted
    case .denied:
      return statusPermanentlyDenied
    case .restricted:
      return statusRestricted
    case .notDetermined:
      return statusNotDetermined
    @unknown default:
      return statusDenied
    }
  }

  private static func mapNotification(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .authorized, .provisional, .ephemeral:
      return statusGranted
    case .denied:
      return statusPermanentlyDenied
    case .notDetermined:
      return statusNotDetermined
    @unknown default:
      return statusDenied
    }
  }

  private static func mapContacts(_ status: CNAuthorizationStatus) -> String {
    if #available(iOS 18.0, *), status == .limited {
      return statusLimited
    }
    switch status {
    case .authorized:
      return statusGranted
    case .denied:
      return statusPermanentlyDenied
    case .restricted:
      return statusRestricted
    case .notDetermined:
      return statusNotDetermined
    @unknown default:
      return statusDenied
    }
  }

  private static func mapCalendar(_ status: EKAuthorizationStatus) -> String {
    if #available(iOS 17.0, *) {
      switch status {
      case .fullAccess: return statusGranted
      case .writeOnly: return statusLimited
      case .denied: return statusPermanentlyDenied
      case .restricted: return statusRestricted
      case .notDetermined: return statusNotDetermined
      @unknown default: return statusDenied
      }
    }
    switch status {
    case .authorized: return statusGranted
    case .denied: return statusPermanentlyDenied
    case .restricted: return statusRestricted
    case .notDetermined: return statusNotDetermined
    default: return statusDenied
    }
  }
}

private final class LocationDelegate: NSObject, CLLocationManagerDelegate {
  static var assocKey: UInt8 = 0
  private let always: Bool
  private let completion: (String) -> Void
  private var finished = false

  init(always: Bool, completion: @escaping (String) -> Void) {
    self.always = always
    self.completion = completion
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    finish(manager.authorizationStatus)
  }

  func locationManager(
    _ manager: CLLocationManager,
    didChangeAuthorization status: CLAuthorizationStatus
  ) {
    finish(status)
  }

  private func finish(_ status: CLAuthorizationStatus) {
    if finished { return }
    if status == .notDetermined { return }
    finished = true
    let mapped: String
    switch status {
    case .authorizedAlways:
      mapped = NKPermissionManager.statusGranted
    case .authorizedWhenInUse:
      mapped = always ? NKPermissionManager.statusDenied : NKPermissionManager.statusGranted
    case .denied:
      mapped = NKPermissionManager.statusPermanentlyDenied
    case .restricted:
      mapped = NKPermissionManager.statusRestricted
    default:
      mapped = NKPermissionManager.statusDenied
    }
    DispatchQueue.main.async {
      self.completion(mapped)
    }
  }
}

private final class BluetoothAuthDelegate: NSObject, CBCentralManagerDelegate {
  static var assocKey: UInt8 = 0
  private let completion: (String) -> Void
  private var finished = false

  init(completion: @escaping (String) -> Void) {
    self.completion = completion
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if finished { return }
    if #available(iOS 13.1, *) {
      let auth = CBCentralManager.authorization
      if auth == .notDetermined { return }
      finished = true
      let mapped: String
      switch auth {
      case .allowedAlways:
        mapped = NKPermissionManager.statusGranted
      case .denied:
        mapped = NKPermissionManager.statusPermanentlyDenied
      case .restricted:
        mapped = NKPermissionManager.statusRestricted
      default:
        mapped = NKPermissionManager.statusDenied
      }
      DispatchQueue.main.async {
        self.completion(mapped)
      }
    } else {
      finished = true
      DispatchQueue.main.async {
        self.completion(NKPermissionManager.statusGranted)
      }
    }
  }
}
