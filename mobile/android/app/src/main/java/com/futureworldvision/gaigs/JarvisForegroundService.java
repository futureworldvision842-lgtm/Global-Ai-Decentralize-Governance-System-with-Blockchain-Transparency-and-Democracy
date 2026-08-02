package com.futureworldvision.gaigs;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class JarvisForegroundService extends Service {
    public static final String CHANNEL_ID = "gaigs_jarvis_presence";
    public static final int NOTIFICATION_ID = 2402;
    public static final String ACTION_STOP = "com.futureworldvision.gaigs.JARVIS_STOP";
    public static final String ACTION_REFRESH = "com.futureworldvision.gaigs.JARVIS_REFRESH";
    public static final String PREFS = "gaigs.jarvis";
    public static final String ENABLED = "background_enabled";
    public static final String LAST_SYNC_AT = "last_sync_at";
    public static final String LAST_HUB_ONLINE = "last_hub_online";
    public static final String LAST_AGENT_COUNT = "last_agent_count";
    public static final String LAST_STATUS = "last_status";

    private static final String HUB_URL = "https://gaigs-jarvis-v2.qw01.chatgpt.site/api/agent-hub";
    private ScheduledExecutorService scheduler;
    private volatile String statusText = "Starting your visible JARVIS mobile presence...";

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "JARVIS presence", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Visible, user-controlled GAIGS agent status and approved brief scheduling.");
            manager.createNotificationChannel(channel);
        }
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(this::refreshStatus, 0, 5, TimeUnit.MINUTES);
    }

    private Notification notification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openApp, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent pause = new Intent(this, JarvisForegroundService.class).setAction(ACTION_STOP);
        PendingIntent pausePending = PendingIntent.getService(this, 1, pause, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent refresh = new Intent(this, JarvisForegroundService.class).setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getService(this, 2, refresh, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("GAIGS JARVIS mobile core")
            .setContentText(statusText)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_popup_sync, "Refresh", refreshPending)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? "" : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, false).apply();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, notification());
        if (ACTION_REFRESH.equals(action) && scheduler != null) scheduler.submit(this::refreshStatus);
        return START_STICKY;
    }

    private void persistStatus(boolean hubOnline, int ready, String text) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(LAST_SYNC_AT, System.currentTimeMillis())
            .putBoolean(LAST_HUB_ONLINE, hubOnline)
            .putInt(LAST_AGENT_COUNT, ready)
            .putString(LAST_STATUS, text)
            .apply();
    }

    private void refreshStatus() {
        HttpURLConnection connection = null;
        boolean hubOnline = false;
        int ready = 0;
        try {
            connection = (HttpURLConnection) new URL(HUB_URL).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Accept", "application/json");
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) throw new IllegalStateException("Hub returned " + responseCode);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null && body.length() < 65536) body.append(line);
                JSONObject hub = new JSONObject(body.toString());
                JSONArray agents = hub.optJSONArray("agents");
                if (agents != null) {
                    for (int index = 0; index < agents.length(); index++) {
                        JSONObject agent = agents.optJSONObject(index);
                        String state = agent == null ? "" : agent.optString("status");
                        if ("online".equals(state) || "ready".equals(state)) ready++;
                    }
                }
                hubOnline = hub.optBoolean("online");
                String synced = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date());
                statusText = hubOnline
                    ? "Linked - " + ready + " agents ready - synced " + synced
                    : "Mobile core active - PC is paused/offline - checked " + synced;
            }
        } catch (Exception ignored) {
            statusText = "Mobile core active - waiting for internet - encrypted memory remains local";
        } finally {
            if (connection != null) connection.disconnect();
        }
        persistStatus(hubOnline, ready, statusText);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, notification());
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) scheduler.shutdownNow();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}

