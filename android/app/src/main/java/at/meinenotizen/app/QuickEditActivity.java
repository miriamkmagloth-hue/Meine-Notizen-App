package at.meinenotizen.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;

/**
 * Schnellbearbeitung aus dem Widget: ein kleines Fenster über dem Startbildschirm,
 * in dem die Notiz direkt bearbeitet werden kann, ohne die ganze App zu öffnen.
 */
public class QuickEditActivity extends BaseWebActivity {
    static final String EXTRA_NOTE = "noteId";

    @Override
    protected boolean isQuickMode() {
        return true;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebView();
        web.setBackgroundColor(Color.TRANSPARENT);
        load(getIntent());
    }

    private void load(Intent intent) {
        String noteId = intent.getStringExtra(EXTRA_NOTE);
        String url = START_URL + "#quick=" + (noteId != null ? noteId : "new");
        web.loadUrl(url);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Erst speichern, dann die neue Notiz laden
        String noteId = intent.getStringExtra(EXTRA_NOTE);
        callJs("window.loadQuick(" + org.json.JSONObject.quote(noteId != null ? noteId : "new") + ")");
    }

    @Override
    protected void onBackNotHandled() {
        finishAndRemoveTask();
    }
}
