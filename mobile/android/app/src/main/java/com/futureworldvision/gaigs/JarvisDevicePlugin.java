package com.futureworldvision.gaigs;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
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
    private static final String PREFS = "gaigs.jarvis";
    private static final String ENABLED = "background_enabled";

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
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, true).apply();
        ContextCompat.startForegroundService(context, new Intent(context, JarvisForegroundService.class));
        JSObject result = new JSObject(); result.put("enabled", true); call.resolve(result);
    }

    @PluginMethod
    public void stopBackground(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply();
        context.stopService(new Intent(context, JarvisForegroundService.class));
        JSObject result = new JSObject(); result.put("enabled", false); call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        boolean enabled = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false);
        JSObject result = new JSObject(); result.put("enabled", enabled); result.put("visibleNotification", enabled); result.put("alwaysListening", false); call.resolve(result);
    }
}
