package at.meinenotizen.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget, das eine Notiz anzeigt. Kontrollkästchen lassen sich direkt abhaken. */
public class NoteWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TOGGLE = "at.meinenotizen.app.TOGGLE";
    static final String EXTRA_NOTE = "noteId";
    static final String EXTRA_INDEX = "checkIndex";
    static final int MAX_ROWS = 20;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetStore.removeWidget(context, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_TOGGLE.equals(intent.getAction())) {
            String noteId = intent.getStringExtra(EXTRA_NOTE);
            int index = intent.getIntExtra(EXTRA_INDEX, -1);
            if (noteId != null && index >= 0 && WidgetStore.toggle(context, noteId, index)) {
                refreshNote(context, noteId);
            }
        }
    }

    /** Alle Widgets aktualisieren, die diese Notiz zeigen. */
    static void refreshNote(Context context, String noteId) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NoteWidgetProvider.class));
        for (int id : ids) {
            if (noteId == null || noteId.equals(WidgetStore.getWidgetNote(context, id))) update(context, manager, id);
        }
    }

    /** Abgehaktes Kästchen in der App-Akzentfarbe zeichnen. */
    private static Bitmap checkBitmap(Context c, int color) {
        float d = c.getResources().getDisplayMetrics().density;
        int size = Math.round(20 * d);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(color);
        canvas.drawRoundRect(new RectF(0.5f * d, 0.5f * d, size - 0.5f * d, size - 0.5f * d), 4.5f * d, 4.5f * d, fill);
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setColor(luminance(color) > 0.6 ? 0xFF26221E : Color.WHITE);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(2.4f * d);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        Path p = new Path();
        p.moveTo(5f * d, 10.5f * d);
        p.lineTo(8.2f * d, 13.7f * d);
        p.lineTo(15f * d, 7f * d);
        canvas.drawPath(p, stroke);
        return bmp;
    }

    private static double luminance(int color) {
        return (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255.0;
    }

    private static Integer parseColor(String s) {
        if (s == null || s.isEmpty()) return null;
        try {
            return Color.parseColor(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static int idOf(Context c, String name) {
        return c.getResources().getIdentifier(name, "id", c.getPackageName());
    }

    static void update(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_note);
        String noteId = WidgetStore.getWidgetNote(context, widgetId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        // ---- Aussehen (pro Widget einstellbar) ----
        JSONObject cfg = WidgetStore.getConfig(context, widgetId);
        String bgType = cfg.optString("bgType", "default");
        int alpha = Math.max(0, Math.min(255, Math.round(cfg.optInt("alpha", 100) * 2.55f)));
        if ("color".equals(bgType)) {
            Integer c = parseColor(cfg.optString("color", ""));
            if (c != null) {
                views.setInt(R.id.bg_fill, "setColorFilter", c);
            }
        } else if ("image".equals(bgType)) {
            Bitmap bmp = WidgetStore.loadImage(context, widgetId);
            if (bmp != null) {
                views.setImageViewBitmap(R.id.bg_image, bmp);
                views.setViewVisibility(R.id.bg_image, View.VISIBLE);
                views.setViewVisibility(R.id.bg_fill, View.GONE);
                views.setInt(R.id.bg_image, "setImageAlpha", alpha);
            }
        }
        views.setInt(R.id.bg_fill, "setImageAlpha", alpha);
        Integer ink = parseColor(cfg.optString("textColor", ""));
        int inkColor = ink != null ? ink : context.getColor(R.color.widget_text);
        int mutedColor = ink != null ? ((ink & 0x00FFFFFF) | 0x99000000) : context.getColor(R.color.widget_muted);
        if (ink != null) {
            views.setTextColor(R.id.title, inkColor);
            views.setTextColor(R.id.empty, mutedColor);
            views.setInt(R.id.btn_switch, "setColorFilter", mutedColor);
            views.setInt(R.id.btn_edit, "setColorFilter", inkColor);
        }
        // Ohne eigene Schriftfarbe folgen die Farben automatisch Hell/Dunkel des Systems.
        Integer accent = parseColor(WidgetStore.getAccent(context));
        Bitmap checkedBmp = accent != null ? checkBitmap(context, accent) : null;
        if (accent != null && ink == null) views.setInt(R.id.btn_edit, "setColorFilter", accent);

        // Notiz wechseln
        Intent choose = new Intent(context, WidgetConfigActivity.class);
        choose.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        choose.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        views.setOnClickPendingIntent(R.id.btn_switch,
                PendingIntent.getActivity(context, widgetId * 10 + 1, choose, flags));

        String title = noteId != null ? WidgetStore.getTitle(context, noteId) : null;
        if (noteId == null || title == null) {
            views.setTextViewText(R.id.title, context.getString(R.string.app_name));
            for (int i = 0; i < MAX_ROWS; i++) views.setViewVisibility(idOf(context, "row" + i), View.GONE);
            views.setViewVisibility(R.id.empty, View.VISIBLE);
            views.setTextViewText(R.id.empty, context.getString(R.string.widget_pick_note));
            views.setOnClickPendingIntent(R.id.empty, PendingIntent.getActivity(context, widgetId * 10 + 1, choose, flags));
            views.setViewVisibility(R.id.btn_edit, View.GONE);
            manager.updateAppWidget(widgetId, views);
            return;
        }

        // Titel → Notiz in der App öffnen
        Intent open = new Intent(context, MainActivity.class);
        open.putExtra(MainActivity.EXTRA_NOTE, noteId);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(context, widgetId * 10 + 2, open, flags);
        views.setTextViewText(R.id.title, title);
        views.setOnClickPendingIntent(R.id.title, openPi);

        // Text antippen → Schnellbearbeitung direkt über dem Startbildschirm
        Intent edit = new Intent(context, QuickEditActivity.class);
        edit.putExtra(QuickEditActivity.EXTRA_NOTE, noteId);
        edit.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent editPi = PendingIntent.getActivity(context, widgetId * 10 + 3, edit, flags);
        views.setViewVisibility(R.id.btn_edit, View.VISIBLE);
        views.setOnClickPendingIntent(R.id.btn_edit, editPi);
        views.setOnClickPendingIntent(R.id.rows, editPi);

        JSONArray blocks = WidgetStore.getBlocks(context, noteId);
        int shown = Math.min(blocks.length(), MAX_ROWS);
        boolean overflow = blocks.length() > MAX_ROWS;
        if (overflow) shown = MAX_ROWS - 1;

        views.setViewVisibility(R.id.empty, blocks.length() == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.empty, context.getString(R.string.widget_empty_note));
        views.setOnClickPendingIntent(R.id.empty, editPi);

        for (int i = 0; i < MAX_ROWS; i++) {
            int rowId = idOf(context, "row" + i);
            int chkId = idOf(context, "chk" + i);
            int txtId = idOf(context, "txt" + i);
            if (i >= shown && !(overflow && i == shown)) {
                views.setViewVisibility(rowId, View.GONE);
                continue;
            }
            views.setViewVisibility(rowId, View.VISIBLE);
            views.setOnClickPendingIntent(txtId, editPi);
            if (overflow && i == shown) {
                views.setViewVisibility(chkId, View.GONE);
                views.setTextViewText(txtId, context.getString(R.string.widget_more, blocks.length() - shown));
                views.setTextColor(txtId, mutedColor);
                views.setTextViewTextSize(txtId, TypedValue.COMPLEX_UNIT_SP, 13);
                continue;
            }
            JSONObject b = blocks.optJSONObject(i);
            if (b == null) b = new JSONObject();
            String type = b.optString("t", "p");
            String text = b.optString("x", "");
            if (ink != null) views.setTextColor(txtId, inkColor);
            views.setTextViewTextSize(txtId, TypedValue.COMPLEX_UNIT_SP, 14.5f);

            if ("c".equals(type)) {
                boolean checked = b.optBoolean("c", false);
                int index = b.optInt("i", -1);
                views.setViewVisibility(chkId, View.VISIBLE);
                if (checked && checkedBmp != null) views.setImageViewBitmap(chkId, checkedBmp);
                else views.setImageViewResource(chkId, checked ? R.drawable.ic_check_on : R.drawable.ic_check_off);
                if (ink != null && !checked) views.setInt(chkId, "setColorFilter", mutedColor);
                Intent toggle = new Intent(context, NoteWidgetProvider.class);
                toggle.setAction(ACTION_TOGGLE);
                toggle.putExtra(EXTRA_NOTE, noteId);
                toggle.putExtra(EXTRA_INDEX, index);
                // Eindeutiger requestCode je Widget und Zeile
                PendingIntent togglePi = PendingIntent.getBroadcast(context, 100000 + widgetId * 100 + i, toggle, flags);
                views.setOnClickPendingIntent(chkId, togglePi);
                if (checked) {
                    SpannableString s = new SpannableString(text);
                    s.setSpan(new StrikethroughSpan(), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    views.setTextViewText(txtId, s);
                    views.setTextColor(txtId, mutedColor);
                } else {
                    views.setTextViewText(txtId, text);
                }
            } else if ("h".equals(type)) {
                views.setViewVisibility(chkId, View.GONE);
                SpannableString s = new SpannableString(text);
                s.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                views.setTextViewText(txtId, s);
                views.setTextViewTextSize(txtId, TypedValue.COMPLEX_UNIT_SP, 16.5f);
            } else {
                views.setViewVisibility(chkId, View.GONE);
                views.setTextViewText(txtId, text);
            }
        }
        manager.updateAppWidget(widgetId, views);
    }
}
