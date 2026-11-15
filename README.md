# IVY Organizer V1

Eine gemeinsame PWA aus den originalen Notes- und Calendar-Projekten. `index.html` ist der Startpunkt. Inhalte aus beiden Apps sind weiterhin lokal gespeichert.

## Verknüpfung
In Notizen über **Datum** einen Kalendertag wählen und die Notiz speichern. Sie erscheint im Kalender am entsprechenden Tag (Monat/Jahr als Markierung, Tag/Woche als Eintrag) und ist im Datum-Dialog anklickbar; der Klick öffnet den Rich-Text-Editor der Notiz. Über **Datum lösen** kann die Verknüpfung entfernt werden.

## Vorhandene Daten
Bei gleicher Origin (gleiche Domain+Port+Protokoll) und im selben Browserprofil liest die neue App die bisherigen `notes`, `events` und Gruppen aus LocalStorage. Bei einer anderen GitHub-Pages-Domain oder anderem Ursprung werden Browserdaten aus Sicherheitsgründen **nicht automatisch übernommen**. Notes enthält Import/Export für Notizen. Für die bestehenden Kalenderdaten ist vor dem Wechsel eine Sicherung/Übernahme nötig; die alte PWA nicht löschen, bevor der Umzug geprüft wurde. Die App ist ohne Cloud-Synchronisierung.

## Installieren
Alle Dateien/Ordner des ZIP gemeinsam auf statisches HTTPS Hosting (z. B. GitHub Pages) hochladen. `index.html` im Stamm öffnen und PWA installieren. Kein Buildprozess, keine Abhängigkeiten.

## Hinweis
Die getrennten Originaloberflächen sind in die gemeinsame Anwendung integriert. Datumsverknüpfungen sind neue Metadaten, bestehende rein textuelle Datumsstempel sind nicht automatisch als Kalendertermine interpretierbar. Bestehende Bilder verwenden die originale Notes-IndexedDB und sind nur auf demselben Origin/Browserprofil verfügbar.
