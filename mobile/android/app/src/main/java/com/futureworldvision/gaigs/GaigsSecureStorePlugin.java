package com.futureworldvision.gaigs;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Stores the native session with a non-exportable Android Keystore AES key. */
@CapacitorPlugin(name = "GaigsSecureStore")
public class GaigsSecureStorePlugin extends Plugin {
    private static final String PREFS = "gaigs_secure_store";
    private static final String ALIAS = "gaigs_session_aes_v1";
    private static final int TAG_BITS = 128;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        ByteBuffer packed = ByteBuffer.allocate(4 + iv.length + encrypted.length);
        packed.putInt(iv.length).put(iv).put(encrypted);
        return Base64.encodeToString(packed.array(), Base64.NO_WRAP);
    }

    private String decrypt(String packedValue) throws Exception {
        byte[] bytes = Base64.decode(packedValue, Base64.NO_WRAP);
        ByteBuffer packed = ByteBuffer.wrap(bytes);
        int ivLength = packed.getInt();
        if (ivLength < 12 || ivLength > 32 || packed.remaining() <= ivLength) throw new IllegalStateException("Invalid secure value.");
        byte[] iv = new byte[ivLength];
        packed.get(iv);
        byte[] encrypted = new byte[packed.remaining()];
        packed.get(encrypted);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("key");
        String value = call.getString("value");
        if (name == null || value == null || name.length() > 80) { call.reject("A valid key and value are required."); return; }
        try {
            prefs().edit().putString(name, encrypt(value)).apply();
            call.resolve();
        } catch (Exception error) { call.reject("Secure storage is unavailable.", error); }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String name = call.getString("key");
        if (name == null || name.length() > 80) { call.reject("A valid key is required."); return; }
        JSObject result = new JSObject();
        String encrypted = prefs().getString(name, null);
        if (encrypted == null) { result.put("value", JSObject.NULL); call.resolve(result); return; }
        try {
            result.put("value", decrypt(encrypted));
            call.resolve(result);
        } catch (Exception error) {
            prefs().edit().remove(name).apply();
            call.reject("Secure value could not be decrypted.", error);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String name = call.getString("key");
        if (name != null) prefs().edit().remove(name).apply();
        call.resolve();
    }
}
