package com.futureworldvision.gaigs;

import android.Manifest;
import android.os.Build;
import androidx.annotation.NonNull;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;
import com.google.android.gms.tasks.Tasks;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(
    name = "GaigsNearby",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        }),
        @Permission(alias = "nearbyWifi", strings = { Manifest.permission.NEARBY_WIFI_DEVICES })
    }
)
public class GaigsNearbyPlugin extends Plugin {
    private static final Strategy STRATEGY = Strategy.P2P_CLUSTER;
    private static final int MAX_BYTES = 30 * 1024;
    private ConnectionsClient client;
    private String localName = "GAIGS member";
    private boolean running = false;
    private final Set<String> connected = new HashSet<>();
    private final Set<String> requested = new HashSet<>();
    private final Map<String, ConnectionInfo> pending = new HashMap<>();

    private ConnectionsClient client() {
        if (client == null) client = Nearby.getConnectionsClient(getContext());
        return client;
    }

    private boolean permissionsReady() {
        if (Build.VERSION.SDK_INT >= 32) return getPermissionState("nearbyWifi") == PermissionState.GRANTED
            && getPermissionState("bluetooth") == PermissionState.GRANTED;
        if (Build.VERSION.SDK_INT >= 31) return getPermissionState("bluetooth") == PermissionState.GRANTED;
        return getPermissionState("location") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void start(PluginCall call) {
        localName = safeName(call.getString("displayName", "GAIGS member"));
        if (!permissionsReady()) {
            if (Build.VERSION.SDK_INT >= 32) requestPermissionForAliases(new String[]{"bluetooth", "nearbyWifi"}, call, "permissionCallback");
            else if (Build.VERSION.SDK_INT >= 31) requestPermissionForAlias("bluetooth", call, "permissionCallback");
            else requestPermissionForAlias("location", call, "permissionCallback");
            return;
        }
        startTransport(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (!permissionsReady()) {
            call.reject("Nearby devices permission is required for offline messaging.");
            return;
        }
        startTransport(call);
    }

    private void startTransport(PluginCall call) {
        String serviceId = getContext().getPackageName() + ".nearby.v1";
        AdvertisingOptions advertising = new AdvertisingOptions.Builder().setStrategy(STRATEGY).build();
        DiscoveryOptions discovery = new DiscoveryOptions.Builder().setStrategy(STRATEGY).build();
        Tasks.whenAll(
            client().startAdvertising(localName, serviceId, lifecycleCallback, advertising),
            client().startDiscovery(serviceId, discoveryCallback, discovery)
        ).addOnSuccessListener(unused -> {
            running = true;
            JSObject result = state();
            result.put("transport", "nearby-connections");
            result.put("encryptedLink", true);
            call.resolve(result);
            emitState();
        }).addOnFailureListener(error -> call.reject("Nearby mesh could not start: " + error.getMessage(), error));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (client != null) {
            client.stopAdvertising();
            client.stopDiscovery();
            client.stopAllEndpoints();
        }
        running = false;
        connected.clear();
        requested.clear();
        pending.clear();
        call.resolve(state());
        emitState();
    }

    @PluginMethod
    public void accept(PluginCall call) {
        String endpointId = call.getString("endpointId", "");
        if (!pending.containsKey(endpointId)) { call.reject("Connection request is no longer available."); return; }
        client().acceptConnection(endpointId, payloadCallback)
            .addOnSuccessListener(unused -> { pending.remove(endpointId); JSObject result = new JSObject(); result.put("accepted", true); call.resolve(result); })
            .addOnFailureListener(error -> call.reject("Could not accept nearby connection: " + error.getMessage(), error));
    }

    @PluginMethod
    public void reject(PluginCall call) {
        String endpointId = call.getString("endpointId", "");
        client().rejectConnection(endpointId);
        pending.remove(endpointId);
        JSObject result = new JSObject(); result.put("rejected", true); call.resolve(result);
    }

    @PluginMethod
    public void send(PluginCall call) {
        String message = call.getString("message", "");
        byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 1 || bytes.length > MAX_BYTES) { call.reject("Nearby text packets must be between 1 byte and 30 KB."); return; }
        String endpointId = call.getString("endpointId", "");
        ArrayList<String> targets = new ArrayList<>();
        if (!endpointId.isEmpty() && connected.contains(endpointId)) targets.add(endpointId);
        else targets.addAll(connected);
        if (targets.isEmpty()) { call.reject("No verified nearby peer is connected."); return; }
        client().sendPayload(targets, Payload.fromBytes(bytes))
            .addOnSuccessListener(unused -> { JSObject result = new JSObject(); result.put("sent", true); result.put("peers", targets.size()); call.resolve(result); })
            .addOnFailureListener(error -> call.reject("Nearby packet failed: " + error.getMessage(), error));
    }

    @PluginMethod
    public void getState(PluginCall call) { call.resolve(state()); }

    private final EndpointDiscoveryCallback discoveryCallback = new EndpointDiscoveryCallback() {
        @Override public void onEndpointFound(@NonNull String endpointId, @NonNull DiscoveredEndpointInfo info) {
            if (requested.contains(endpointId) || connected.contains(endpointId)) return;
            requested.add(endpointId);
            JSObject event = new JSObject(); event.put("endpointId", endpointId); event.put("name", safeName(info.getEndpointName())); event.put("state", "found");
            notifyListeners("nearbyPeer", event);
            client().requestConnection(localName, endpointId, lifecycleCallback)
                .addOnFailureListener(error -> { requested.remove(endpointId); emitPeer(endpointId, info.getEndpointName(), "request-failed"); });
        }
        @Override public void onEndpointLost(@NonNull String endpointId) {
            requested.remove(endpointId); emitPeer(endpointId, "Nearby peer", "lost");
        }
    };

    private final ConnectionLifecycleCallback lifecycleCallback = new ConnectionLifecycleCallback() {
        @Override public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
            pending.put(endpointId, info);
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("name", safeName(info.getEndpointName()));
            event.put("verificationCode", info.getAuthenticationDigits());
            event.put("incoming", info.isIncomingConnection());
            notifyListeners("nearbyConnectionRequest", event);
        }
        @Override public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution resolution) {
            pending.remove(endpointId); requested.remove(endpointId);
            if (resolution.getStatus().isSuccess()) { connected.add(endpointId); emitPeer(endpointId, "Verified nearby peer", "connected"); }
            else emitPeer(endpointId, "Nearby peer", "rejected");
            emitState();
        }
        @Override public void onDisconnected(@NonNull String endpointId) {
            connected.remove(endpointId); emitPeer(endpointId, "Nearby peer", "disconnected"); emitState();
        }
    };

    private final PayloadCallback payloadCallback = new PayloadCallback() {
        @Override public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
            if (payload.getType() != Payload.Type.BYTES || payload.asBytes() == null) return;
            JSObject event = new JSObject(); event.put("endpointId", endpointId); event.put("message", new String(payload.asBytes(), StandardCharsets.UTF_8));
            notifyListeners("nearbyPayload", event);
        }
        @Override public void onPayloadTransferUpdate(@NonNull String endpointId, @NonNull PayloadTransferUpdate update) {
            if (update.getStatus() == PayloadTransferUpdate.Status.FAILURE || update.getStatus() == PayloadTransferUpdate.Status.CANCELED) {
                JSObject event = new JSObject(); event.put("endpointId", endpointId); event.put("payloadId", update.getPayloadId()); event.put("status", "failed");
                notifyListeners("nearbyTransfer", event);
            }
        }
    };

    private JSObject state() {
        JSObject result = new JSObject(); result.put("running", running); result.put("connectedPeers", connected.size()); result.put("pendingRequests", pending.size());
        JSArray endpoints = new JSArray(); for (String id : connected) endpoints.put(id); result.put("endpoints", endpoints); return result;
    }

    private void emitState() { notifyListeners("nearbyState", state()); }
    private void emitPeer(String endpointId, String name, String peerState) {
        JSObject event = new JSObject(); event.put("endpointId", endpointId); event.put("name", safeName(name)); event.put("state", peerState); notifyListeners("nearbyPeer", event);
    }
    private String safeName(String value) {
        String cleaned = value == null ? "GAIGS member" : value.replaceAll("[\\p{Cntrl}]", " ").trim();
        if (cleaned.isEmpty()) cleaned = "GAIGS member";
        return cleaned.substring(0, Math.min(40, cleaned.length()));
    }
}
