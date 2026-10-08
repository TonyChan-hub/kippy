package com.bear1210.native_kit.permission

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

object PermissionManager {
    const val STATUS_GRANTED = "granted"
    const val STATUS_DENIED = "denied"
    const val STATUS_PERMANENTLY_DENIED = "permanentlyDenied"
    const val STATUS_RESTRICTED = "restricted"
    const val STATUS_LIMITED = "limited"
    const val STATUS_NOT_DETERMINED = "notDetermined"

    private const val REQUEST_CODE = 0x4E4B // 'NK'

    private var pendingKind: String? = null
    private var pendingCallback: ((String) -> Unit)? = null
    private var pendingStage: String? = null

    fun check(context: Context, kind: String): String {
        when (kind) {
            "photoRead", "photoLimited" -> return checkPhotoAccess(context)
            "locationAlways" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val foreground = foregroundLocationPermissions()
                    val foregroundGranted =
                        foreground.all {
                            ContextCompat.checkSelfPermission(context, it) ==
                                PackageManager.PERMISSION_GRANTED
                        }
                    if (!foregroundGranted) {
                        return STATUS_DENIED
                    }
                    val backgroundGranted =
                        ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION,
                        ) == PackageManager.PERMISSION_GRANTED
                    return if (backgroundGranted) STATUS_GRANTED else STATUS_DENIED
                }
            }
            "biometrics" -> return checkBiometrics(context)
            "reminders" -> return STATUS_RESTRICTED // iOS-only
            "appList" -> return checkAppList(context)
            "localNetwork" -> return STATUS_GRANTED // no Android runtime gate
        }

        val permissions = permissionsFor(kind) ?: return STATUS_DENIED
        if (permissions.isEmpty()) {
            return STATUS_GRANTED
        }

        val allGranted =
            permissions.all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
        return if (allGranted) STATUS_GRANTED else STATUS_DENIED
    }

    /**
     * High-level request that shows the system dialog via [ActivityCompat].
     * Prefer this from Flutter / plain Activities.
     */
    fun request(activity: Activity, kind: String, callback: (String) -> Unit) {
        val toAsk = beginRequest(activity, kind, callback) ?: return
        ActivityCompat.requestPermissions(activity, toAsk, REQUEST_CODE)
    }

    /**
     * Start a request without showing a dialog yet.
     * Returns the permission array to ask now, or `null` if [callback] was already invoked
     * (already granted / no runtime permission / invalid kind / busy).
     *
     * Use with RN [PermissionAwareActivity] or any custom dispatcher.
     */
    fun beginRequest(
        activity: Activity,
        kind: String,
        callback: (String) -> Unit,
    ): Array<String>? {
        when (kind) {
            "reminders" -> {
                callback(STATUS_RESTRICTED)
                return null
            }
            "biometrics" -> {
                callback(checkBiometrics(activity))
                return null
            }
            "appList" -> {
                val status = checkAppList(activity)
                callback(if (status == STATUS_GRANTED) STATUS_GRANTED else STATUS_PERMANENTLY_DENIED)
                return null
            }
            "localNetwork" -> {
                callback(STATUS_GRANTED)
                return null
            }
        }

        val permissions = permissionsFor(kind)
        if (permissions == null) {
            callback(STATUS_DENIED)
            return null
        }
        if (permissions.isEmpty()) {
            callback(STATUS_GRANTED)
            return null
        }
        if (pendingCallback != null) {
            callback(STATUS_DENIED)
            return null
        }

        if (kind == "locationAlways" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return beginLocationAlways(activity, callback)
        }

        if (kind == "photoRead" || kind == "photoLimited") {
            return beginPhotoRequest(activity, kind, callback)
        }

        val already = check(activity, kind)
        if (already == STATUS_GRANTED || already == STATUS_LIMITED) {
            callback(already)
            return null
        }

        pendingKind = kind
        pendingStage = null
        pendingCallback = callback
        return permissions.toTypedArray()
    }

    /**
     * Continue after a system permission result.
     * Returns another permission array to ask, or `null` if finished (callback already invoked).
     */
    fun continueAfterResult(
        activity: Activity,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Array<String>? {
        val kind = pendingKind
        val stage = pendingStage
        val callback = pendingCallback
        if (kind == null || callback == null) {
            clearPending()
            return null
        }

        val allGranted =
            grantResults.isNotEmpty() &&
                grantResults.all { it == PackageManager.PERMISSION_GRANTED }

        if (kind == "locationAlways" && stage == "foreground") {
            if (!allGranted) {
                clearPending()
                callback(deniedStatus(activity, permissions))
                return null
            }
            pendingStage = "background"
            return arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }

        clearPending()
        if (kind == "photoRead" || kind == "photoLimited") {
            // Partial grant on API 34+ yields READ_MEDIA_VISUAL_USER_SELECTED, not full READ_MEDIA_*.
            val status = checkPhotoAccess(activity)
            if (status == STATUS_GRANTED || status == STATUS_LIMITED) {
                callback(status)
            } else {
                callback(deniedStatus(activity, permissions))
            }
            return null
        }

        if (allGranted) {
            callback(STATUS_GRANTED)
        } else {
            callback(deniedStatus(activity, permissions))
        }
        return null
    }

    fun onRequestPermissionsResult(
        activity: Activity,
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != REQUEST_CODE) return false
        val next = continueAfterResult(activity, permissions, grantResults)
        if (next != null) {
            ActivityCompat.requestPermissions(activity, next, REQUEST_CODE)
        }
        return true
    }

    fun openSettings(context: Context) {
        val intent =
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        context.startActivity(intent)
    }

    /** Manifest / runtime permission names for a kind (empty = no runtime prompt). */
    fun permissionsFor(kind: String): List<String>? {
        return when (kind) {
            "camera" -> listOf(Manifest.permission.CAMERA)
            "microphone" -> listOf(Manifest.permission.RECORD_AUDIO)
            "photoRead" -> photoReadPermissions()
            "photoLimited" -> photoLimitedRequestPermissions(null)
            "photoAdd" -> emptyList() // MediaStore insert needs no runtime grant on modern Android
            "locationWhenInUse" -> foregroundLocationPermissions()
            "locationAlways" -> locationAlwaysPermissions()
            "notification" -> notificationPermissions()
            "contacts" -> listOf(Manifest.permission.READ_CONTACTS)
            "calendar" -> listOf(Manifest.permission.READ_CALENDAR)
            "tracking" -> emptyList() // no Android runtime equivalent of ATT
            "bluetooth" -> bluetoothPermissions()
            "speechRecognition" -> listOf(Manifest.permission.RECORD_AUDIO)
            "motion" -> motionPermissions()
            "reminders" -> null // handled as restricted in check/beginRequest
            "audioRead" -> audioReadPermissions()
            "biometrics" -> emptyList() // capability check via BiometricManager
            "localNetwork" -> emptyList()
            "sms" -> listOf(Manifest.permission.READ_SMS)
            "appList" -> emptyList() // install-time QUERY_ALL_PACKAGES; no runtime dialog
            else -> null
        }
    }

    fun requestCode(): Int = REQUEST_CODE

    /**
     * Full library → [STATUS_GRANTED]; selected/partial (API 34+) → [STATUS_LIMITED]; else denied.
     * Shared by [photoRead] and [photoLimited] — callers interpret whether limited is enough.
     */
    private fun checkPhotoAccess(context: Context): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val full =
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.READ_MEDIA_IMAGES,
                ) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.READ_MEDIA_VIDEO,
                    ) == PackageManager.PERMISSION_GRANTED
            if (full) {
                return STATUS_GRANTED
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                return STATUS_LIMITED
            }
            return STATUS_DENIED
        }
        return if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_EXTERNAL_STORAGE,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            STATUS_GRANTED
        } else {
            STATUS_DENIED
        }
    }

    private fun beginPhotoRequest(
        activity: Activity,
        kind: String,
        callback: (String) -> Unit,
    ): Array<String>? {
        val already = checkPhotoAccess(activity)
        if (already == STATUS_GRANTED) {
            callback(STATUS_GRANTED)
            return null
        }
        // photoRead wants full access — limited is a terminal status (upgrade via Settings).
        if (kind == "photoRead" && already == STATUS_LIMITED) {
            callback(STATUS_LIMITED)
            return null
        }
        // photoLimited: limited is usable; on API 34+ re-request expands the selected set.
        if (kind == "photoLimited" && already == STATUS_LIMITED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                pendingKind = kind
                pendingStage = "photoExpand"
                pendingCallback = callback
                return arrayOf(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
            }
            callback(STATUS_LIMITED)
            return null
        }

        pendingKind = kind
        pendingStage = null
        pendingCallback = callback
        return photoReadPermissions().toTypedArray()
    }

    private fun beginLocationAlways(
        activity: Activity,
        callback: (String) -> Unit,
    ): Array<String>? {
        val foreground = foregroundLocationPermissions()
        val foregroundGranted =
            foreground.all {
                ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
            }
        if (!foregroundGranted) {
            pendingKind = "locationAlways"
            pendingStage = "foreground"
            pendingCallback = callback
            return foreground.toTypedArray()
        }

        val backgroundGranted =
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
        if (backgroundGranted) {
            callback(STATUS_GRANTED)
            return null
        }

        pendingKind = "locationAlways"
        pendingStage = "background"
        pendingCallback = callback
        return arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    }

    private fun checkBiometrics(context: Context): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val manager = context.getSystemService(BiometricManager::class.java) ?: return STATUS_RESTRICTED
            @Suppress("DEPRECATION")
            val result =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                } else {
                    manager.canAuthenticate()
                }
            return when (result) {
                BiometricManager.BIOMETRIC_SUCCESS -> STATUS_GRANTED
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> STATUS_DENIED
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                -> STATUS_RESTRICTED
                else -> STATUS_DENIED
            }
        }
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        return if (keyguard?.isKeyguardSecure == true) STATUS_GRANTED else STATUS_DENIED
    }

    private fun checkAppList(context: Context): String {
        return if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.QUERY_ALL_PACKAGES,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            STATUS_GRANTED
        } else {
            STATUS_DENIED
        }
    }

    private fun deniedStatus(activity: Activity, permissions: Array<out String>): String {
        val showRationale =
            permissions.any {
                ActivityCompat.shouldShowRequestPermissionRationale(activity, it)
            }
        return if (showRationale) STATUS_DENIED else STATUS_PERMANENTLY_DENIED
    }

    private fun clearPending() {
        pendingKind = null
        pendingStage = null
        pendingCallback = null
    }

    private fun foregroundLocationPermissions(): List<String> {
        return listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
    }

    private fun locationAlwaysPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            foregroundLocationPermissions() + Manifest.permission.ACCESS_BACKGROUND_LOCATION
        } else {
            foregroundLocationPermissions()
        }
    }

    private fun photoReadPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
            )
        } else {
            listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    /** Declared for recipe / inspection; runtime request uses [beginPhotoRequest]. */
    private fun photoLimitedRequestPermissions(@Suppress("UNUSED_PARAMETER") ctx: Context?): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            photoReadPermissions() + Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
        } else {
            photoReadPermissions()
        }
    }

    private fun notificationPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyList()
        }
    }

    private fun bluetoothPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            )
        } else {
            // Pre-12 Bluetooth discovery often required location.
            listOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    private fun motionPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            listOf(Manifest.permission.ACTIVITY_RECOGNITION)
        } else {
            emptyList()
        }
    }

    private fun audioReadPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }
}
