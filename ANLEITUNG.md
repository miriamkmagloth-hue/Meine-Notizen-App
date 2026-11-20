# Meine Notizen – Einrichtung Schritt für Schritt

Eine Notizen-App für dein Android-Handy **und** den Computer (im Browser).
Mit Überschriften, Kontrollkästchen, Textmarker, Unterstreichen, Bildern (mit Zuschneiden und KI-Freistellen),
Stickern, Ordnern und einem Widget. Abgeglichen wird über dein Google Drive.

Die Einrichtung dauert beim ersten Mal ca. 30 Minuten. Danach läuft alles von selbst.

---

## Teil 1 – Code zu GitHub hochladen

1. Auf **github.com** oben rechts auf **+** → **New repository**.
2. Name: `meine-notizen` · Sichtbarkeit: **Public** (öffentlich).
   *Warum öffentlich?* Nur so ist die kostenlose Web-Version (GitHub Pages) möglich.
   Öffentlich ist nur der **Programmcode** – deine Notizen liegen nie auf GitHub, sondern nur auf deinen Geräten und in deinem Google Drive.
3. **Create repository** → auf der neuen Seite **uploading an existing file** anklicken.
4. Den entpackten Ordner `meine-notizen` öffnen und **alle Dateien und Ordner darin** in das Browserfenster ziehen.
   ⚠️ Am Mac ist der Ordner `.github` versteckt: im Finder **⌘ + ⇧ + .** (Punkt) drücken, dann wird er sichtbar und muss mit hochgeladen werden.
5. Unten auf **Commit changes**.

## Teil 2 – Zwei Einstellungen in GitHub

**a) Signatur-Schlüssel hinterlegen** (damit die App immer gleich „unterschrieben“ ist – wichtig für Google-Anmeldung und Updates)

1. Im Repository: **Settings** → links **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `KEYSTORE_BASE64`
3. Wert: den **gesamten Inhalt** der Datei `KEYSTORE_BASE64.txt` hineinkopieren (die Datei bekommst du separat, sie gehört **nicht** ins Repository).
4. **Add secret**. Bewahre die Datei `KEYSTORE_BASE64.txt` zusätzlich sicher auf (z. B. im Passwort-Manager).

**b) Web-Version einschalten**

1. **Settings** → links **Pages**.
2. Bei **Source** „**GitHub Actions**“ auswählen.

Danach unter **Actions** → „App bauen“ → **Run workflow** anklicken, damit alles einmal neu gebaut wird.

## Teil 3 – Google Drive freischalten (einmalig, ca. 10 Minuten)

Damit die App in deinem Google Drive speichern darf, braucht sie eine eigene „Zugangskarte“ bei Google. Das ist kostenlos.

1. **console.cloud.google.com** öffnen und mit deinem Google-Konto anmelden.
2. Oben links auf die Projektauswahl → **Neues Projekt** → Name `Meine Notizen` → **Erstellen**. Danach sicherstellen, dass oben dieses Projekt ausgewählt ist.
3. Suchfeld oben: **Google Drive API** → öffnen → **Aktivieren**.
4. Links im Menü **APIs & Dienste** → **OAuth-Zustimmungsbildschirm** (heißt teilweise auch **Google Auth Platform**) → **Jetzt starten**:
   - App-Name: `Meine Notizen`, Support-E-Mail: deine Adresse
   - Zielgruppe: **Extern**
   - Kontaktdaten: deine Adresse → zustimmen → **Erstellen**
5. Links **Datenzugriff** → **Bereiche hinzufügen oder entfernen** → im Feld „Bereiche manuell hinzufügen“ einfügen:
   `https://www.googleapis.com/auth/drive.appdata` → **Zur Tabelle hinzufügen** → **Aktualisieren** → **Speichern**.
   (Das ist der kleinste mögliche Zugriff: Die App sieht nur ihren eigenen, versteckten Ordner – nicht deine anderen Dateien.)
6. Links **Zielgruppe** → **App veröffentlichen** → bestätigen.
   (Sonst müsstest du dich jede Woche neu anmelden. Eine Prüfung durch Google ist für diesen Zugriff nicht nötig.)
7. Links **Clients** → **Client erstellen**:
   - Anwendungstyp: **Android**
   - Paketname: `at.meinenotizen.app`
   - SHA-1-Fingerabdruck: `7E:AD:59:A3:FA:17:67:57:9A:02:DA:F4:7F:97:12:02:03:60:0C:23`
   - **Erstellen**
8. Nochmal **Client erstellen**:
   - Anwendungstyp: **Webanwendung**, Name: `Meine Notizen Web`
   - **Autorisierte JavaScript-Quellen** → **URI hinzufügen**: `https://DEIN-GITHUB-NAME.github.io`
     (genau so, ohne `/` am Ende und ohne `/meine-notizen`)
   - **Erstellen** → die angezeigte **Client-ID** kopieren (endet auf `.apps.googleusercontent.com`) und aufheben.

## Teil 4 – App aufs Handy

1. In GitHub → **Actions** → den neuesten grünen Durchlauf „App bauen“ öffnen.
2. Unten bei **Artifacts** auf **MeineNotizen-APK** klicken → ZIP wird geladen → darin liegt die APK.
3. APK aufs Handy bringen (z. B. über Google Drive) und antippen → Installation erlauben.
4. App öffnen → links oben Menü → unten **Google Drive verbinden** → **Mit Google Drive verbinden** → dein Konto wählen → erlauben.

**Updates:** Jede Änderung am Code baut automatisch eine neue APK. Einfach über die alte installieren – deine Notizen bleiben erhalten.

## Teil 5 – Am Computer

1. Im Browser öffnen: `https://DEIN-GITHUB-NAME.github.io/meine-notizen/`
2. Unten links **Google Drive verbinden** → die **Client-ID** aus Teil 3 einfügen → **Mit Google Drive verbinden**.
   Falls der Browser ein Pop-up blockiert: Pop-ups für diese Seite erlauben.
3. Tipp: In Chrome oben in der Adresszeile auf das Symbol **„App installieren“** klicken – dann startet „Meine Notizen“ wie ein eigenes Programm.

## Teil 6 – Widget

1. Am Startbildschirm lange auf eine freie Stelle drücken → **Widgets** → **Meine Notizen**.
2. Widget platzieren → Notiz auswählen.
3. Im Widget:
   - **Kästchen antippen** = direkt abhaken
   - **Text antippen** oder ✏️ = Schnellbearbeitung öffnet sich als Fenster über dem Startbildschirm
   - **Titel antippen** = Notiz in der App öffnen
   - ⇄ = andere Notiz oder anderes Aussehen wählen
   - Das Widget lässt sich größer ziehen, dann zeigt es mehr Zeilen (bis 20).

---

## Bedienung – kleine Tricks

| Was | Wie |
|---|---|
| Kontrollkästchen | Knopf ☑ in der Leiste – oder am Zeilenanfang `[]` + Leertaste |
| Überschrift | Knopf „Text“ → Titel / Überschrift / Zwischenüberschrift – oder `#`, `##`, `###` + Leertaste |
| Aufzählung | `-` + Leertaste |
| Markieren | Text auswählen → Marker-Knopf (markiert sofort, darunter andere Farbe wählbar) |
| Bild zuschneiden | Bild antippen → **Zuschneiden** (Frei, 1:1, 4:3, 16:9, Drehen) |
| KI | Im Zuschneiden-Fenster: **Auf Motiv zuschneiden** oder **Hintergrund entfernen** (nur in der Android-App, läuft direkt am Handy) |
| Eigener Sticker | Bild antippen → **Als Sticker**, oder Sticker-Knopf → **Meine Sticker** → **Aus Foto** |
| Ordner | Links **+ Neuer Ordner** (Name + Farbe); Ordner anklicken, dann **+** = neue Notiz darin; ⋯ neben einem Ordner = Name/Farbe ändern, löschen |
| Tastenkürzel am Computer | Strg/⌘ + B, I, U · Strg/⌘ + Enter = Kontrollkästchen · Strg/⌘ + ⇧ + H = markieren |

## Personalisieren

- **Einzelne Wörter:** Text markieren → Knopf **A** (Schriftfarbe, auch eigene Farbe über den bunten Kreis) oder Knopf **AA** (Schriftgröße: Klein bis Riesig).
- **Ganze Notiz:** Paletten-Symbol 🎨 oben in der Notiz → Hintergrund (Farbe, Papier liniert/kariert/gepunktet oder eigenes Foto mit Abdunkeln/Aufhellen), Schriftgröße und Schriftfarbe.
- **App:** Paletten-Symbol 🎨 unten in der Seitenleiste (oder Einstellungen → **Design anpassen**) → Vorlagen (Creme, Weiß, Rosé, Salbei, Lavendel, Himmel, Sand, Dunkel), Hell/Dunkel/wie das Gerät, Akzentfarbe, eigene Farben für Seitenleiste, Hintergrund, Notizkarten, Notizpapier und Schrift, App-Hintergrund (Farbe oder Foto) und Standard-Aussehen für neue Notizen. Wird auf alle Geräte übertragen.
- **Widget:** Beim Hinzufügen oder über ⇄ im Widget → Notiz wählen, Hintergrund (Standard, Farbe oder Foto), Deckkraft und Schriftfarbe. Jedes Widget kann anders aussehen.

## Wie die Synchronisierung funktioniert

- Jede Änderung wird **sofort am Gerät gespeichert** – auch ohne Internet.
- Ein paar Sekunden nach dem Tippen, beim Öffnen der App und jede Minute wird mit Google Drive abgeglichen.
- Die Daten liegen in einem **versteckten App-Ordner** in deinem Google Drive (sichtbar unter Drive → Einstellungen → Apps verwalten).
- Wenn dieselbe Notiz auf zwei Geräten gleichzeitig geändert wurde, geht nichts verloren: Die ältere Fassung erscheint als „(Konflikt-Kopie)“.
- Häkchen, die du im Widget setzt, werden übernommen, sobald die App (oder die Schnellbearbeitung) das nächste Mal geöffnet wird.

## Wenn etwas nicht klappt

- **„Anmeldung fehlgeschlagen“ am Handy:** Prüfe in Google Cloud den Android-Client (Paketname und SHA-1 genau wie oben) und ob das Secret `KEYSTORE_BASE64` in GitHub hinterlegt ist.
- **Am Computer passiert beim Verbinden nichts:** Pop-ups erlauben; prüfen, ob die JavaScript-Quelle exakt `https://DEIN-GITHUB-NAME.github.io` lautet.
- **„KI-Modul wird heruntergeladen“:** Beim ersten Mal lädt das Handy das KI-Modell (wenige MB). Eine Minute warten, nochmal tippen.
- **Notiz zu groß:** Eine einzelne Notiz kann ca. 4–5 MB haben (ungefähr 10–15 Fotos). Bei mehr Bildern die Notiz aufteilen.
