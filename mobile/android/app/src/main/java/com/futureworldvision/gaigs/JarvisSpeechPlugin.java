package com.futureworldvision.gaigs;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name = "JarvisSpeech", permissions = {@Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})})
public class JarvisSpeechPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private PluginCall activeCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
        else begin(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else call.reject("Microphone permission is required for voice assistance.");
    }

    private void begin(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("Speech recognition is unavailable on this device."); return; }
        if (activeCall != null) { call.reject("JARVIS is already listening."); return; }
        activeCall = call;
        getActivity().runOnUiThread(() -> {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", Locale.getDefault().toLanguageTag()));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            recognizer.startListening(intent);
        });
    }

    private void finish() { if (recognizer != null) { recognizer.destroy(); recognizer = null; } activeCall = null; }
    @Override public void onResults(Bundle results) { ArrayList<String> values=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(activeCall!=null){if(values!=null&&!values.isEmpty()){JSObject out=new JSObject();out.put("text",values.get(0));activeCall.resolve(out);}else activeCall.reject("No speech was recognized.");}finish(); }
    @Override public void onError(int error) { if(activeCall!=null)activeCall.reject("Speech recognition stopped. Error code: "+error);finish(); }
    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
