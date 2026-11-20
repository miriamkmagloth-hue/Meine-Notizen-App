package at.meinenotizen.app;

import android.content.Intent;
import android.os.Bundle;

import org.json.JSONObject;

/** Die eigentliche Notizen-App. */
public class MainActivity extends BaseWebActivity {
    static final String EXTRA_NOTE = "noteId";

    @Override
    protected String mode() {
        return "main";
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebView();
        String url = START_URL;
        String noteId = getIntent().getStringExtra(EXTRA_NOTE);
        if (noteId != null) url += "#note=" + noteId;
        web.loadUrl(url);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String noteId = intent.getStringExtra(EXTRA_NOTE);
        if (noteId != null) {
            callJs("window.openNoteFromNative && window.openNoteFromNative(" + JSONObject.quote(noteId) + ")");
        }
    }
}
