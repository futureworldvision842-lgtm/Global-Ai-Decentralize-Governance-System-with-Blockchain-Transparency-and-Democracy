package com.futureworldvision.gaigs;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "JarvisBridge")
public class JarvisBridgePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private boolean privateHost(String host) {
        try {
            InetAddress address = InetAddress.getByName(host);
            return address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress();
        } catch (Exception error) { return false; }
    }

    private URI checkedEndpoint(String raw) throws Exception {
        URI base = new URI(raw == null ? "" : raw.trim());
        if (!("http".equalsIgnoreCase(base.getScheme()) || "https".equalsIgnoreCase(base.getScheme()))) throw new IllegalArgumentException("Bridge must use HTTP or HTTPS.");
        if (base.getHost() == null || !privateHost(base.getHost())) throw new IllegalArgumentException("For safety, the mobile bridge connects only to this device or a private local network address.");
        return new URI(base.getScheme(), null, base.getHost(), base.getPort(), "/api/agent-hub", null, null);
    }

    @PluginMethod
    public void getAgentHub(PluginCall call) {
        String endpoint = call.getString("endpoint", "http://192.168.100.238:8090");
        executor.submit(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) checkedEndpoint(endpoint).toURL().openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("Accept", "application/json");
                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null && body.length() < 262144) body.append(line);
                if (status < 200 || status >= 300) throw new IllegalStateException("Bridge returned " + status + ".");
                JSONObject parsed = new JSONObject(body.toString());
                JSObject result = new JSObject(); result.put("data", parsed); call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage() == null ? "JARVIS bridge is unavailable." : error.getMessage()); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
