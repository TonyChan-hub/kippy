package com.bear1210.native_kit.device

import android.content.Context
import android.os.Build

object DeviceManager {
    /**
     * Public, non-sensitive device / app fields only.
     * Does not return IMEI, serial, phone number, or installed app lists.
     */
    fun getInfo(context: Context): Map<String, Any> {
        val packageInfo =
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    context.packageManager.getPackageInfo(
                        context.packageName,
                        android.content.pm.PackageManager.PackageInfoFlags.of(0),
                    )
                } else {
                    @Suppress("DEPRECATION")
                    context.packageManager.getPackageInfo(context.packageName, 0)
                }
            } catch (_: Exception) {
                null
            }

        val appVersion = packageInfo?.versionName ?: ""
        val buildNumber =
            if (packageInfo != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    packageInfo.longVersionCode.toString()
                } else {
                    @Suppress("DEPRECATION")
                    packageInfo.versionCode.toString()
                }
            } else {
                ""
            }

        return mapOf(
            "brand" to (Build.BRAND ?: ""),
            "model" to (Build.MODEL ?: ""),
            "systemName" to "Android",
            "systemVersion" to (Build.VERSION.RELEASE ?: ""),
            "appVersion" to appVersion,
            "buildNumber" to buildNumber,
            "bundleId" to context.packageName,
            "isEmulator" to isEmulator(),
        )
    }

    private fun isEmulator(): Boolean {
        return (
            Build.FINGERPRINT.startsWith("generic") ||
                Build.FINGERPRINT.startsWith("unknown") ||
                Build.MODEL.contains("google_sdk") ||
                Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for x86") ||
                Build.MANUFACTURER.contains("Genymotion") ||
                Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
                "google_sdk" == Build.PRODUCT
        )
    }
}
