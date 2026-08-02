package com.futureworldvision.gaigs;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Network;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "JarvisDevice", permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class JarvisDevicePlugin extends Plugin {
    @PluginMethod
    public void startBackground(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) start(call);
        else call.reject("Notification permission is required for visible background presence.");
    }

    private void start(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(JarvisForegroundService.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(JarvisForegroundService.ENABLED, true).apply();
        ContextCompat.startForegroundService(context, new Intent(context, JarvisForegroundService.class));
        JSObject result = new JSObject(); result.put("enabled", true); call.resolve(result);
    }

    @PluginMethod
    public void stopBackground(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(JarvisForegroundService.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(JarvisForegroundService.ENABLED, false).apply();
        context.stopService(new Intent(context, JarvisForegroundService.class));
        JSObject result = new JSObject(); result.put("enabled", false); call.resolve(result);
    }

    private boolean networkAvailable(Context context) {
        ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        Network network = manager == null ? null : manager.getActiveNetwork();
        NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        android.content.SharedPreferences prefs = context.getSharedPreferences(JarvisForegroundService.PREFS, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean(JarvisForegroundService.ENABLED, false);
        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int level = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int batteryPercent = level >= 0 && scale > 0 ? Math.round(level * 100f / scale) : -1;
        int batteryState = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = batteryState == BatteryManager.BATTERY_STATUS_CHARGING || batteryState == BatteryManager.BATTERY_STATUS_FULL;
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean unrestrictedBattery = power != null && power.isIgnoringBatteryOptimizations(context.getPackageName());
        String appVersion = "unknown";
        long versionCode = 0;
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            appVersion = info.versionName;
            versionCode = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        } catch (Exception ignored) {}

        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("visibleNotification", enabled);
        result.put("alwaysListening", false);
        result.put("batteryPercent", batteryPercent);
        result.put("charging", charging);
        result.put("networkAvailable", networkAvailable(context));
        result.put("batteryUnrestricted", unrestrictedBattery);
        result.put("appVersion", appVersion);
        result.put("versionCode", versionCode);
        result.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        result.put("lastSyncAt", prefs.getLong(JarvisForegroundService.LAST_SYNC_AT, 0));
        result.put("hubOnline", prefs.getBoolean(JarvisForegroundService.LAST_HUB_ONLINE, false));
        result.put("readyAgents", prefs.getInt(JarvisForegroundService.LAST_AGENT_COUNT, 0));
        result.put("status", prefs.getString(JarvisForegroundService.LAST_STATUS, "Not checked yet"));
        call.resolve(result);
    }

    @PluginMethod
    public void executeSafeCommand(PluginCall call) {
        String action = call.getString("action", "");
        Context context = getContext();
        Intent intent;
        switch (action) {
            case "open_wifi_settings": intent = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            case "open_bluetooth_settings": intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); break;
            case "open_location_settings": intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS); break;
            case "open_battery_settings": intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS); break;
            case "open_notification_settings":
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
                break;
            case "open_app_settings":
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.getPackageName()));
                break;
            case "refresh_presence":
                if (!context.getSharedPreferences(JarvisForegroundService.PREFS, Context.MODE_PRIVATE)
                    .getBoolean(JarvisForegroundService.ENABLED, false)) {
                    call.reject("Enable visible mobile presence first.");
                    return;
                }
                Intent refresh = new Intent(context, JarvisForegroundService.class).setAction(JarvisForegroundService.ACTION_REFRESH);
                ContextCompat.startForegroundService(context, refresh);
                JSObject refreshed = new JSObject(); refreshed.put("ok", true); refreshed.put("action", action); call.resolve(refreshed);
                return;
            default:
                call.reject("This device command is not in the owner-approved allow-list.");
                return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        JSObject result = new JSObject(); result.put("ok", true); result.put("action", action); call.resolve(result);
    }
}

