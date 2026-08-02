package com.futureworldvision.gaigs;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class JarvisBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        boolean enabled = context.getSharedPreferences(JarvisForegroundService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(JarvisForegroundService.ENABLED, false);
        if (!enabled) return;
        try { ContextCompat.startForegroundService(context, new Intent(context, JarvisForegroundService.class)); }
        catch (RuntimeException ignored) { /* Android may defer background starts; opening the app restores presence. */ }
    }
}
