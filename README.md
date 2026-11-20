# Meine Notizen

Notizen-App für Android (mit Widget) und den Browser, synchronisiert über Google Drive.

- `web/` – die App selbst (HTML/CSS/JavaScript, ohne Build-Schritt). Läuft im Browser und wird in die Android-App eingepackt.
- `android/` – Android-Hülle: Widget, Schnellbearbeitung, Google-Anmeldung, KI-Freistellen (ML Kit, am Gerät).
- `.github/workflows/build.yml` – baut bei jeder Änderung die APK und veröffentlicht die Web-Version auf GitHub Pages.

**Einrichtung:** siehe [ANLEITUNG.md](ANLEITUNG.md).
