package com.futureworldvision.gaigs;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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
    private static final String HUB_URL = "https://gaigs-jarvis-v2.qw01.chatgpt.site/api/agent-hub";
    private ScheduledExecutorService scheduler;
    private volatile String statusText = "Starting private peer sync and JARVIS status checks…";

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "JARVIS presence", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps user-approved GAIGS peer sync and brief scheduling available.");
            manager.createNotificationChannel(channel);
        }
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(this::refreshStatus, 0, 5, TimeUnit.MINUTES);
    }

    private Notification notification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, openApp, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("GAIGS JARVIS is available")
            .setContentText(statusText)
            .setContentIntent(pending)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, notification());
        return START_STICKY;
    }

    private void refreshStatus() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(HUB_URL).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Accept", "application/json");
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null && body.length() < 65536) body.append(line);
                JSONObject hub = new JSONObject(body.toString());
                JSONArray agents = hub.optJSONArray("agents");
                int ready = 0;
                if (agents != null) {
                    for (int index = 0; index < agents.length(); index++) {
                        JSONObject agent = agents.optJSONObject(index);
                        String state = agent == null ? "" : agent.optString("status");
                        if ("online".equals(state) || "ready".equals(state)) ready++;
                    }
                }
                String synced = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date());
                statusText = hub.optBoolean("online")
                    ? "JARVIS linked • " + ready + " agents ready • synced " + synced
                    : "Personal node active • PC heartbeat waiting • checked " + synced;
            }
        } catch (Exception ignored) {
            statusText = "Personal node active • internet status temporarily unavailable";
        } finally {
            if (connection != null) connection.disconnect();
        }
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
