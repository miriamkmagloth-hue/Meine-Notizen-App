package at.meinenotizen.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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
    static final int MAX_ROWS = 400;

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
    static Bitmap checkBitmap(Context c, int color) {
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

    static double luminance(int color) {
        return (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255.0;
    }

    static Integer parseColor(String s) {
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
            views.setViewVisibility(R.id.list, View.GONE);
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

        // Scrollbare Liste der Zeilen
        Intent svc = new Intent(context, NoteWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.list, svc);
        views.setEmptyView(R.id.list, R.id.empty);
        views.setTextViewText(R.id.empty, context.getString(R.string.widget_empty_note));
        views.setOnClickPendingIntent(R.id.empty, editPi);

        // Vorlage für Klicks in der Liste (Kästchen abhaken oder Text bearbeiten)
        Intent tap = new Intent(context, WidgetClickActivity.class);
        tap.putExtra(WidgetClickActivity.EXTRA_NOTE, noteId);
        tap.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        int tplFlags = PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        views.setPendingIntentTemplate(R.id.list, PendingIntent.getActivity(context, widgetId * 10 + 4, tap, tplFlags));

        manager.updateAppWidget(widgetId, views);
        manager.notifyAppWidgetViewDataChanged(widgetId, R.id.list);
    }
}
