package at.meinenotizen.app;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.view.View;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;

/**
 * Gemeinsame Grundlage für die Haupt-App und die Schnellbearbeitung:
 * zeigt die Web-App an und stellt ihr Android-Funktionen zur Verfügung
 * (Google-Anmeldung, KI-Freistellen, Widget, Dateiauswahl).
 */
public abstract class BaseWebActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/app/index.html";
    static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

    private static final int REQ_FILE = 101;
    private static final int REQ_AUTH = 102;

    protected WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingAuthCallback;

    /** "main", "quick" (Schnellbearbeitung) oder "widget" (Widget einrichten) */
    protected abstract String mode();

    protected boolean isQuickMode() {
        return "quick".equals(mode());
    }

    /** Nur bei der Widget-Einrichtung gesetzt. */
    protected int widgetId = android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID;

    /** Wird von der Widget-Einrichtung überschrieben. */
    protected void onSaveWidgetConfig(String json, String imageDataUrl) {
    }

    protected void setupWebView() {
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/app/", new AssetHandler())
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    String[] types = params.getAcceptTypes();
                    String type = (types != null && types.length > 0 && types[0] != null && !types[0].isEmpty()) ? types[0] : "*/*";
                    if (type.contains(",")) type = "*/*";
                    pick.setType(type);
                    startActivityForResult(Intent.createChooser(pick, null), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
    }

    /** Liefert die Dateien der Web-App aus dem APK mit korrektem Dateityp aus. */
    private class AssetHandler implements WebViewAssetLoader.PathHandler {
        @Override
        public WebResourceResponse handle(String path) {
            if (path.isEmpty()) path = "index.html";
            try {
                InputStream is = getAssets().open(path);
                return new WebResourceResponse(mimeOf(path), "utf-8", is);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
            }
        }
    }

    static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    protected void callJs(String script) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(script, null); });
    }

    protected void callback(String cbId, JSONObject result) {
        if (cbId == null) return;
        callJs("window.__nativeCallback(" + JSONObject.quote(cbId) + "," + JSONObject.quote(result.toString()) + ")");
    }

    static JSONObject obj(String key, Object value) {
        JSONObject o = new JSONObject();
        try {
            o.put(key, value);
        } catch (JSONException ignored) {
        }
        return o;
    }

    // ---------- Google-Anmeldung für Drive ----------
    private void requestToken(String scopes, boolean interactive, String cbId) {
        java.util.List<Scope> list = new java.util.ArrayList<>();
        for (String sc : scopes.trim().split("\\s+")) {
            if (!sc.isEmpty()) list.add(new Scope(sc));
        }
        if (list.isEmpty()) list.add(new Scope(DRIVE_SCOPE));
        AuthorizationRequest req = AuthorizationRequest.builder()
                .setRequestedScopes(list)
                .build();
        Identity.getAuthorizationClient(this).authorize(req)
                .addOnSuccessListener(result -> {
                    if (result.hasResolution()) {
                        if (!interactive || result.getPendingIntent() == null) {
                            callback(cbId, obj("needsUi", true));
                            return;
                        }
                        try {
                            pendingAuthCallback = cbId;
                            startIntentSenderForResult(result.getPendingIntent().getIntentSender(), REQ_AUTH, null, 0, 0, 0);
                        } catch (IntentSender.SendIntentException e) {
                            pendingAuthCallback = null;
                            callback(cbId, obj("error", "Anmeldung konnte nicht gestartet werden"));
                        }
                    } else {
                        callback(cbId, obj("token", result.getAccessToken()));
                    }
                })
                .addOnFailureListener(e -> callback(cbId, obj("error", "Google-Anmeldung fehlgeschlagen: " + e.getMessage())));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                        result = new Uri[]{data.getClipData().getItemAt(0).getUri()};
                    } else if (data.getData() != null) {
                        result = new Uri[]{data.getData()};
                    }
                }
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
        } else if (requestCode == REQ_AUTH) {
            String cb = pendingAuthCallback;
            pendingAuthCallback = null;
            if (data == null) {
                callback(cb, obj("error", "Anmeldung abgebrochen (keine Antwort von Google, Code " + resultCode + ")"));
                return;
            }
            try {
                // Auch bei „abgebrochen“ die genaue Fehlermeldung von Google auslesen
                AuthorizationResult r = Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data);
                if (r.getAccessToken() != null) callback(cb, obj("token", r.getAccessToken()));
                else callback(cb, obj("error", "Kein Zugriff erhalten (Code " + resultCode + ")"));
            } catch (ApiException e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                String hint = e.getStatusCode() == 10
                        ? " – App-Signatur passt nicht zum Android-Client in Google Cloud (Paketname/SHA-1 prüfen)"
                        : "";
                callback(cb, obj("error", "Google-Anmeldung fehlgeschlagen (Fehler " + e.getStatusCode() + hint + ") " + msg));
            }
        }
    }

    // ---------- KI: Motiv freistellen (läuft direkt am Gerät) ----------
    private void segmentSubject(String dataUrl, String cbId) {
        new Thread(() -> {
            try {
                String b64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bmp == null) {
                    callback(cbId, obj("error", "Bild konnte nicht gelesen werden"));
                    return;
                }
                SubjectSegmenterOptions options = new SubjectSegmenterOptions.Builder()
                        .enableForegroundBitmap()
                        .build();
                SubjectSegmenter segmenter = SubjectSegmentation.getClient(options);
                segmenter.process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener(result -> {
                            Bitmap fg = result.getForegroundBitmap();
                            if (fg == null) {
                                callback(cbId, obj("error", "Kein Motiv erkannt"));
                            } else {
                                ByteArrayOutputStream out = new ByteArrayOutputStream();
                                fg.compress(Bitmap.CompressFormat.PNG, 100, out);
                                String url = "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                                callback(cbId, obj("dataUrl", url));
                            }
                            closeQuietly(segmenter);
                        })
                        .addOnFailureListener(e -> {
                            String msg = String.valueOf(e.getMessage());
                            if (msg.toLowerCase().contains("download")) {
                                msg = "Das KI-Modul wird gerade heruntergeladen – bitte in einer Minute nochmal versuchen.";
                            } else {
                                msg = "KI-Freistellen fehlgeschlagen: " + msg;
                            }
                            callback(cbId, obj("error", msg));
                            closeQuietly(segmenter);
                        });
            } catch (Exception e) {
                callback(cbId, obj("error", "KI-Freistellen fehlgeschlagen: " + e.getMessage()));
            }
        }).start();
    }

    private static void closeQuietly(SubjectSegmenter segmenter) {
        try {
            segmenter.close();
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        callJs("window.onNativeResume && window.onNativeResume()");
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Sicherheitshalber offene Änderungen speichern
        callJs("window.onNativePause && window.onNativePause()");
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("window.handleBack ? window.handleBack() : false", value -> {
            if (!"true".equals(value)) onBackNotHandled();
        });
    }

    protected void onBackNotHandled() {
        moveTaskToBack(true);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }

    /** Diese Funktionen kann die Web-App über window.AndroidBridge aufrufen. */
    public class Bridge {
        @JavascriptInterface
        public boolean isQuickEdit() {
            return isQuickMode();
        }

        @JavascriptInterface
        public String getMode() {
            return mode();
        }

        /** Akzentfarbe der App merken, damit die Häkchen im Widget dazu passen. */
        @JavascriptInterface
        public void setAccentColor(String color) {
            if (WidgetStore.setAccent(getApplicationContext(), color)) {
                NoteWidgetProvider.refreshNote(getApplicationContext(), null);
            }
        }

        /** Status- und Navigationsleiste an die App-Farben anpassen. */
        @JavascriptInterface
        public void setSystemBars(String color, boolean lightBackground) {
            runOnUiThread(() -> {
                if (!"main".equals(mode())) return;
                try {
                    int c = Color.parseColor(color);
                    getWindow().setStatusBarColor(c);
                    getWindow().setNavigationBarColor(c);
                    View decor = getWindow().getDecorView();
                    int flags = decor.getSystemUiVisibility();
                    int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    flags = lightBackground ? (flags | light) : (flags & ~light);
                    decor.setSystemUiVisibility(flags);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public String getWidgetConfig() {
            JSONObject cfg = WidgetStore.getConfig(getApplicationContext(), widgetId);
            try {
                cfg.put("widgetId", widgetId);
                String noteId = WidgetStore.getWidgetNote(getApplicationContext(), widgetId);
                if (noteId != null) cfg.put("noteId", noteId);
                cfg.put("hasImage", WidgetStore.imageFile(getApplicationContext(), widgetId).exists());
            } catch (JSONException ignored) {
            }
            return cfg.toString();
        }

        @JavascriptInterface
        public void saveWidgetConfig(String json, String imageDataUrl) {
            runOnUiThread(() -> onSaveWidgetConfig(json, imageDataUrl));
        }

        @JavascriptInterface
        public void cancelWidgetConfig() {
            runOnUiThread(() -> finish());
        }

        @JavascriptInterface
        public void requestToken(boolean interactive, String cbId) {
            runOnUiThread(() -> BaseWebActivity.this.requestToken(DRIVE_SCOPE, interactive, cbId));
        }

        /** Anmeldung mit mehreren Berechtigungen (durch Leerzeichen getrennt). */
        @JavascriptInterface
        public void requestTokenScopes(String scopes, boolean interactive, String cbId) {
            runOnUiThread(() -> BaseWebActivity.this.requestToken(scopes, interactive, cbId));
        }

        @JavascriptInterface
        public void segmentSubject(String dataUrl, String cbId) {
            BaseWebActivity.this.segmentSubject(dataUrl, cbId);
        }

        @JavascriptInterface
        public void updateWidget(String noteId, String title, String blocksJson) {
            WidgetStore.putNote(getApplicationContext(), noteId, title, blocksJson);
            NoteWidgetProvider.refreshNote(getApplicationContext(), noteId);
        }

        @JavascriptInterface
        public void setNoteIndex(String json) {
            WidgetStore.setIndex(getApplicationContext(), json);
        }

        @JavascriptInterface
        public String takePendingToggles() {
            return WidgetStore.takeToggles(getApplicationContext());
        }

        @JavascriptInterface
        public void closeQuickEdit() {
            runOnUiThread(() -> finishAndRemoveTask());
        }

        @JavascriptInterface
        public void openInApp(String noteId) {
            runOnUiThread(() -> {
                Intent i = new Intent(BaseWebActivity.this, MainActivity.class);
                i.putExtra(MainActivity.EXTRA_NOTE, noteId);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(i);
                if (isQuickMode()) finishAndRemoveTask();
            });
        }

        @JavascriptInterface
        public String deviceName() {
            return Build.MANUFACTURER + " " + Build.MODEL;
        }
    }
}
