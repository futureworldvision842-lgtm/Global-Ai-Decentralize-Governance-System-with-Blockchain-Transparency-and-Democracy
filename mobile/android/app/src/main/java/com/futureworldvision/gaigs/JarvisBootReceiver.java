package com.futureworldvision.gaigs;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class JarvisBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        boolean enabled = context.getSharedPreferences("gaigs.jarvis", Context.MODE_PRIVATE).getBoolean("background_enabled", false);
        if (!enabled) return;
        try { ContextCompat.startForegroundService(context, new Intent(context, JarvisForegroundService.class)); }
        catch (RuntimeException ignored) { /* Android may defer background starts; opening the app restores presence. */ }
    }
}
