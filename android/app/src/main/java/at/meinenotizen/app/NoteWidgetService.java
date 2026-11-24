package at.meinenotizen.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

/** Liefert die Zeilen einer Notiz für die scrollbare Liste im Widget. */
public class NoteWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        return new Factory(getApplicationContext(), widgetId);
    }

    static class Factory implements RemoteViewsFactory {
        private final Context context;
        private final int widgetId;
        private JSONArray blocks = new JSONArray();
        private Integer ink;
        private int inkColor;
        private int mutedColor;
        private Bitmap checkedBmp;

        Factory(Context context, int widgetId) {
            this.context = context;
            this.widgetId = widgetId;
        }

        @Override
        public void onCreate() {
        }

        @Override
        public void onDataSetChanged() {
            String noteId = WidgetStore.getWidgetNote(context, widgetId);
            blocks = noteId != null ? WidgetStore.getBlocks(context, noteId) : new JSONArray();
            JSONObject cfg = WidgetStore.getConfig(context, widgetId);
            ink = NoteWidgetProvider.parseColor(cfg.optString("textColor", ""));
            inkColor = ink != null ? ink : context.getColor(R.color.widget_text);
            mutedColor = ink != null ? ((ink & 0x00FFFFFF) | 0x99000000) : context.getColor(R.color.widget_muted);
            Integer accent = NoteWidgetProvider.parseColor(WidgetStore.getAccent(context));
            checkedBmp = accent != null ? NoteWidgetProvider.checkBitmap(context, accent) : null;
        }

        @Override
        public void onDestroy() {
        }

        @Override
        public int getCount() {
            return Math.min(blocks.length(), NoteWidgetProvider.MAX_ROWS);
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
            JSONObject b = blocks.optJSONObject(position);
            if (b == null) b = new JSONObject();
            String type = b.optString("t", "p");
            String text = b.optString("x", "");
            row.setTextColor(R.id.txt, inkColor);
            row.setTextViewTextSize(R.id.txt, TypedValue.COMPLEX_UNIT_SP, 14.5f);

            // Text antippen → bearbeiten
            Intent editFill = new Intent();
            editFill.putExtra(WidgetClickActivity.EXTRA_ACTION, WidgetClickActivity.ACTION_EDIT);
            row.setOnClickFillInIntent(R.id.txt, editFill);
            row.setOnClickFillInIntent(R.id.row, editFill);

            if ("c".equals(type)) {
                boolean checked = b.optBoolean("c", false);
                int index = b.optInt("i", -1);
                row.setViewVisibility(R.id.chk, View.VISIBLE);
                if (checked && checkedBmp != null) {
                    row.setImageViewBitmap(R.id.chk, checkedBmp);
                } else {
                    row.setImageViewResource(R.id.chk, checked ? R.drawable.ic_check_on : R.drawable.ic_check_off);
                    if (!checked && ink != null) row.setInt(R.id.chk, "setColorFilter", mutedColor);
                }
                Intent toggleFill = new Intent();
                toggleFill.putExtra(WidgetClickActivity.EXTRA_ACTION, WidgetClickActivity.ACTION_TOGGLE);
                toggleFill.putExtra(WidgetClickActivity.EXTRA_INDEX, index);
                row.setOnClickFillInIntent(R.id.chk, toggleFill);
                if (checked) {
                    SpannableString s = new SpannableString(text);
                    s.setSpan(new StrikethroughSpan(), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    row.setTextViewText(R.id.txt, s);
                    row.setTextColor(R.id.txt, mutedColor);
                } else {
                    row.setTextViewText(R.id.txt, text);
                }
            } else if ("h".equals(type)) {
                row.setViewVisibility(R.id.chk, View.GONE);
                SpannableString s = new SpannableString(text);
                s.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                row.setTextViewText(R.id.txt, s);
                row.setTextViewTextSize(R.id.txt, TypedValue.COMPLEX_UNIT_SP, 16.5f);
            } else {
                row.setViewVisibility(R.id.chk, View.GONE);
                row.setTextViewText(R.id.txt, text);
            }
            return row;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
