package at.meinenotizen.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Speichert, was das Widget anzeigen soll (Kopie der Notiz-Inhalte als einfache Zeilen). */
final class WidgetStore {
    private static final String PREFS = "widget";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void putNote(Context c, String noteId, String title, String blocksJson) {
        prefs(c).edit()
                .putString("title_" + noteId, title)
                .putString("blocks_" + noteId, blocksJson)
                .apply();
    }

    static String getTitle(Context c, String noteId) {
        return prefs(c).getString("title_" + noteId, null);
    }

    static JSONArray getBlocks(Context c, String noteId) {
        try {
            return new JSONArray(prefs(c).getString("blocks_" + noteId, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void setIndex(Context c, String json) {
        prefs(c).edit().putString("index", json).apply();
    }

    static JSONArray getIndex(Context c) {
        try {
            return new JSONArray(prefs(c).getString("index", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void setWidgetNote(Context c, int widgetId, String noteId) {
        prefs(c).edit().putString("w_" + widgetId, noteId).apply();
    }

    static String getWidgetNote(Context c, int widgetId) {
        return prefs(c).getString("w_" + widgetId, null);
    }

    static void removeWidget(Context c, int widgetId) {
        prefs(c).edit().remove("w_" + widgetId).apply();
    }

    /** Kontrollkästchen im Widget umschalten: sofort in der Kopie ändern und für die App vormerken. */
    static synchronized boolean toggle(Context c, String noteId, int checkIndex) {
        JSONArray blocks = getBlocks(c, noteId);
        boolean newState = false;
        boolean found = false;
        try {
            for (int i = 0; i < blocks.length(); i++) {
                JSONObject b = blocks.getJSONObject(i);
                if ("c".equals(b.optString("t")) && b.optInt("i", -1) == checkIndex) {
                    newState = !b.optBoolean("c", false);
                    b.put("c", newState);
                    found = true;
                    break;
                }
            }
            if (!found) return false;
            JSONArray pending = new JSONArray(prefs(c).getString("toggles", "[]"));
            JSONObject t = new JSONObject();
            t.put("n", noteId);
            t.put("i", checkIndex);
            t.put("c", newState);
            pending.put(t);
            prefs(c).edit()
                    .putString("blocks_" + noteId, blocks.toString())
                    .putString("toggles", pending.toString())
                    .apply();
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    static synchronized String takeToggles(Context c) {
        String s = prefs(c).getString("toggles", "[]");
        prefs(c).edit().remove("toggles").apply();
        return s;
    }
}
