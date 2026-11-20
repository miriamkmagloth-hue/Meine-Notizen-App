package at.meinenotizen.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/** Auswahl, welche Notiz das Widget zeigen soll. */
public class WidgetConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

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
        setTitle(R.string.widget_choose_title);
        final JSONArray notes = WidgetStore.getIndex(this);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);

        if (notes.length() == 0) {
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setPadding(pad * 2, pad, pad * 2, pad * 2);
            TextView t = new TextView(this);
            t.setText(R.string.widget_no_notes);
            t.setTextSize(16);
            box.addView(t);
            Button open = new Button(this);
            open.setText(R.string.widget_open_app);
            open.setOnClickListener(v -> {
                startActivity(new Intent(this, MainActivity.class));
                finish();
            });
            box.addView(open);
            setContentView(box);
            sizeWindow();
            return;
        }

        ListView list = new ListView(this);
        list.setAdapter(new BaseAdapter() {
            @Override public int getCount() { return notes.length(); }
            @Override public Object getItem(int p) { return notes.optJSONObject(p); }
            @Override public long getItemId(int p) { return p; }

            @Override
            public View getView(int position, View convert, ViewGroup parent) {
                LinearLayout row;
                if (convert instanceof LinearLayout) {
                    row = (LinearLayout) convert;
                } else {
                    row = new LinearLayout(WidgetConfigActivity.this);
                    row.setOrientation(LinearLayout.VERTICAL);
                    row.setPadding(pad * 3 / 2, pad * 3 / 4, pad * 3 / 2, pad * 3 / 4);
                    TextView a = new TextView(WidgetConfigActivity.this);
                    a.setTextSize(16.5f);
                    TextView b = new TextView(WidgetConfigActivity.this);
                    b.setTextSize(13);
                    b.setAlpha(0.6f);
                    row.addView(a);
                    row.addView(b);
                }
                JSONObject n = notes.optJSONObject(position);
                ((TextView) row.getChildAt(0)).setText(n != null ? n.optString("title") : "");
                ((TextView) row.getChildAt(1)).setText(n != null ? n.optString("nb") : "");
                return row;
            }
        });
        list.setOnItemClickListener((parent, view, position, id) -> {
            JSONObject n = notes.optJSONObject(position);
            if (n == null) return;
            WidgetStore.setWidgetNote(this, widgetId, n.optString("id"));
            NoteWidgetProvider.update(this, AppWidgetManager.getInstance(this), widgetId);
            Intent result = new Intent();
            result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
            setResult(RESULT_OK, result);
            finish();
        });
        setContentView(list);
        sizeWindow();
    }

    private void sizeWindow() {
        int w = (int) (getResources().getDisplayMetrics().widthPixels * 0.9f);
        int max = (int) (520 * getResources().getDisplayMetrics().density);
        getWindow().setLayout(Math.min(w, max), ViewGroup.LayoutParams.WRAP_CONTENT);
    }
}
