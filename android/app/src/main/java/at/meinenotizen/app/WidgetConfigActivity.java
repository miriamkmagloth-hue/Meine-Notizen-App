package at.meinenotizen.app;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Einrichtung eines Widgets: Notiz wählen und Aussehen festlegen
 * (Hintergrundfarbe oder -foto, Transparenz, Schriftfarbe). Die Oberfläche kommt aus der Web-App.
 */
public class WidgetConfigActivity extends BaseWebActivity {

    @Override
    protected String mode() {
        return "widget";
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        setupWebView();
        web.setBackgroundColor(Color.TRANSPARENT);
        web.loadUrl(START_URL + "#widget=" + widgetId);
    }

    @Override
    protected void onSaveWidgetConfig(String json, String imageDataUrl) {
        try {
            JSONObject cfg = new JSONObject(json);
            String noteId = cfg.optString("noteId", "");
            if (!noteId.isEmpty()) WidgetStore.setWidgetNote(this, widgetId, noteId);
            cfg.remove("noteId");
            WidgetStore.setConfig(this, widgetId, cfg.toString());
            if ("none".equals(imageDataUrl)) {
                WidgetStore.deleteImage(this, widgetId);
            } else if (imageDataUrl != null && imageDataUrl.startsWith("data:")) {
                WidgetStore.saveImage(this, widgetId, imageDataUrl);
            }
        } catch (JSONException ignored) {
        }
        NoteWidgetProvider.update(this, AppWidgetManager.getInstance(this), widgetId);
        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    @Override
    protected void onBackNotHandled() {
        finish();
    }
}
