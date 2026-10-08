package com.bear1210.native_kit_flutter

import android.app.Activity
import com.bear1210.native_kit.device.DeviceManager
import com.bear1210.native_kit.permission.PermissionManager
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

class NativeKitFlutterPlugin :
  FlutterPlugin,
  MethodChannel.MethodCallHandler,
  ActivityAware,
  PluginRegistry.RequestPermissionsResultListener {

  private lateinit var channel: MethodChannel
  private var appContext: android.content.Context? = null
  private var activity: Activity? = null
  private var activityBinding: ActivityPluginBinding? = null
  private var pendingResult: MethodChannel.Result? = null

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    appContext = binding.applicationContext
    channel = MethodChannel(binding.binaryMessenger, "native_kit")
    channel.setMethodCallHandler(this)
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "getLinkedModules" -> result.success(listOf("permission", "device"))
      "checkPermission" -> {
        val kind = call.argument<String>("kind")
        if (kind == null) {
          result.error("INVALID_KIND", "Missing kind", null)
          return
        }
        val ctx = activity ?: appContext
        if (ctx == null) {
          result.error("NATIVE_UNAVAILABLE", "No context", null)
          return
        }
        result.success(PermissionManager.check(ctx, kind))
      }
      "requestPermission" -> {
        val kind = call.argument<String>("kind")
        if (kind == null) {
          result.error("INVALID_KIND", "Missing kind", null)
          return
        }
        val act = activity
        if (act == null) {
          result.error("NATIVE_UNAVAILABLE", "No activity", null)
          return
        }
        if (pendingResult != null) {
          result.error("REQUEST_IN_PROGRESS", "Another permission request is in progress", null)
          return
        }
        pendingResult = result
        PermissionManager.request(act, kind) { status ->
          val pending = pendingResult
          pendingResult = null
          pending?.success(status)
        }
      }
      "openSettings" -> {
        val ctx = activity ?: return result.error("NATIVE_UNAVAILABLE", "No activity", null)
        PermissionManager.openSettings(ctx)
        result.success(null)
      }
      "getDeviceInfo" -> {
        val ctx = activity ?: appContext
        if (ctx == null) {
          result.error("NATIVE_UNAVAILABLE", "No context", null)
          return
        }
        result.success(DeviceManager.getInfo(ctx))
      }
      else -> result.notImplemented()
    }
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ): Boolean {
    val act = activity ?: return false
    return PermissionManager.onRequestPermissionsResult(
      act,
      requestCode,
      permissions,
      grantResults,
    )
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    channel.setMethodCallHandler(null)
  }

  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activity = binding.activity
    activityBinding = binding
    binding.addRequestPermissionsResultListener(this)
  }

  override fun onDetachedFromActivityForConfigChanges() {
    activityBinding?.removeRequestPermissionsResultListener(this)
    activityBinding = null
    activity = null
  }

  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
    onAttachedToActivity(binding)
  }

  override fun onDetachedFromActivity() {
    activityBinding?.removeRequestPermissionsResultListener(this)
    activityBinding = null
    activity = null
  }
}
