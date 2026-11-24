package at.meinenotizen.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Unsichtbarer Empfänger für Klicks in der Widget-Liste:
 * Kästchen abhaken (ohne die App zu öffnen) oder die Schnellbearbeitung starten.
 */
public class WidgetClickActivity extends Activity {
    static final String EXTRA_NOTE = "noteId";
    static final String EXTRA_ACTION = "action";
    static final String EXTRA_INDEX = "checkIndex";
    static final String ACTION_TOGGLE = "toggle";
    static final String ACTION_EDIT = "edit";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        String noteId = in.getStringExtra(EXTRA_NOTE);
        String action = in.getStringExtra(EXTRA_ACTION);
        if (noteId != null) {
            if (ACTION_TOGGLE.equals(action)) {
                int index = in.getIntExtra(EXTRA_INDEX, -1);
                if (index >= 0 && WidgetStore.toggle(this, noteId, index)) {
                    NoteWidgetProvider.refreshNote(this, noteId);
                }
            } else {
                Intent edit = new Intent(this, QuickEditActivity.class);
                edit.putExtra(QuickEditActivity.EXTRA_NOTE, noteId);
                edit.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(edit);
            }
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
