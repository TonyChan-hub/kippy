package com.bear1210.nativekit

import com.bear1210.native_kit.device.DeviceManager
import com.bear1210.native_kit.permission.PermissionManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class NativeKitModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), PermissionListener {

  override fun getName(): String = NAME

  @ReactMethod
  fun getLinkedModules(promise: Promise) {
    val arr = WritableNativeArray()
    arr.pushString("permission")
    arr.pushString("device")
    promise.resolve(arr)
  }

  @ReactMethod
  fun checkPermission(kind: String, promise: Promise) {
    try {
      promise.resolve(PermissionManager.check(reactContext, kind))
    } catch (error: Exception) {
      promise.reject("NATIVE_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun requestPermission(kind: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NATIVE_UNAVAILABLE", "No foreground activity for permission request")
      return
    }
    if (activity !is PermissionAwareActivity) {
      promise.reject(
        "NATIVE_UNAVAILABLE",
        "Current activity does not support runtime permission requests",
      )
      return
    }

    val toAsk =
      PermissionManager.beginRequest(activity, kind) { status ->
        promise.resolve(status)
      } ?: return

    activity.requestPermissions(toAsk, PermissionManager.requestCode(), this)
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      PermissionManager.openSettings(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("NATIVE_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun getDeviceInfo(promise: Promise) {
    try {
      val info = DeviceManager.getInfo(reactContext)
      val map = Arguments.createMap()
      for ((key, value) in info) {
        when (value) {
          is String -> map.putString(key, value)
          is Boolean -> map.putBoolean(key, value)
          is Int -> map.putInt(key, value)
          is Double -> map.putDouble(key, value)
          else -> map.putString(key, value.toString())
        }
      }
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("NATIVE_ERROR", error.message, error)
    }
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray,
  ): Boolean {
    if (requestCode != PermissionManager.requestCode()) return false
    val activity = currentActivity
    if (activity == null) return true
    val next = PermissionManager.continueAfterResult(activity, permissions, grantResults)
    if (next != null && activity is PermissionAwareActivity) {
      activity.requestPermissions(next, PermissionManager.requestCode(), this)
      return false // keep listener for the next stage
    }
    return true
  }

  companion object {
    const val NAME = "NativeKit"
  }
}
