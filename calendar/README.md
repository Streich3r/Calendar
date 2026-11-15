# IVY Kalender V2 — GitHub Pages / Offline PWA

Diese Version repariert die Jahresansicht bei hoher Termindichte und die grundlegenden Kalenderfunktionen. Die App speichert weiterhin unter dem bestehenden Browser-Schlüssel `events` im Format `{"2026-11-12": [{"text":"...", "hour": 12}, ...]}`. Eine Migration ist nicht notwendig.

## Installation

1. Vorher die bestehenden Kalenderdaten sichern. Die Daten liegen im Browser und **nicht** im GitHub-Repository.
2. Alle Dateien aus `IVY_Calendar_V2_GITHUB_PAGES.zip` in das bestehende GitHub-Pages-Repository hochladen (mit `index.html` im veröffentlichten Stammverzeichnis).
3. Bestehende `index.html`, `app.js`, `styles.css`, `service-worker.js`, `manifest.json` und Icons ersetzen.
4. Die Website einmal online öffnen; bei einem alten Service Worker kann nach der Aktualisierung ein weiterer Reload erforderlich sein.
5. Keine Website-Daten / Browser-Speicher löschen: Sonst gehen lokal gespeicherte Termine verloren.

## Verbesserungen

- Jahresübersicht: zwölf feste Monatskarten; 7×6-Zellen mit streng begrenzten Markierungen. Auch 350 Termine am selben Tag verursachen keine Verschiebung.
- Mobile Jahresansicht: eine Monatskarte pro Zeile zum Scrollen; Tablet zwei Spalten; Desktop drei.
- Jahresansicht: Klick auf einen Tag öffnet alle Einträge. Klick auf Monatsüberschrift wechselt zur Monatsansicht.
- Monat: Einträge mit Zahl und zwei Punkten zusammengefasst, kein Abschneiden ganzer Monate.
- Woche/Tag: feste Zeilenhöhen und kompakte Vorschau; alle Termine weiterhin im Dialog sichtbar. Die Wochenansicht ist auf kleinen Bildschirmen horizontal scrollbar.
- Datum: lokale Datumsverarbeitung ohne UTC-Tagverschiebung; Monatswechsel von 31.01. auf 28.02. etc. wird geklemmt.
- Geburtstage: jährlich und 29.02.-Fallback am 28.02. in Nicht-Schaltjahren; Löschaktion entfernt genau den jeweiligen Eintrag.
- Saubere HTML-Escapes für Terminnamen im Monats-/Jahresraster.
- Feiertage: `TEST1` entfernt; bundesweit gültige Feiertage im Kalender markiert. Regionale Feiertage wie Fronleichnam werden nicht mehr pauschal für ganz Deutschland angezeigt.
- Service Worker: Network First für HTML/CSS/JS, Offline-Fallback, beschränkt auf die Kalender-PWA. Kein Löschen anderer App-Caches.

## Tests

`tests/test_calendar.py` ist ein automatisierter DOM-/Browser-Test (Playwright + Chromium). Er bettet App-Quellcode und CSS direkt in den Browser ein, da in dieser Testumgebung normale Website-Navigation eingeschränkt ist. Er deckt fünf Bildschirmauflösungen, die Jahresübersicht unter Last, Monats-/Wochen-/Tagesansicht, lokale Datumsberechnung, Löschung, Geburtstage, HTML-Escaping und kaputte gespeicherte Daten ab.

`node tests/test_service_worker.js` testet Install, Activate, Caching, Offline-Fallback und Request-Abgrenzungen mittels simuliertem CacheStorage.

Die **tatsächliche GitHub-Pages-Bereitstellung und echte Offline-Nutzung einer installierten Smartphone-PWA** wurden hier nicht live getestet.

## Datenschutz

Der Kalender verwendet weiterhin `localStorage`. Das ist **nicht verschlüsselt** und synchronisiert nicht automatisch zwischen Geräten. Achtung beim Löschen von Browserdaten.
