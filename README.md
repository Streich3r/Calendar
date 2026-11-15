# IVY Organizer V2

Eine PWA mit Kalender als Startansicht und Notizen als zweitem Tab.

## Datierte Notizen
Jeder über die Datumsfunktion eingefügte Datumsstempel wird als Beginn eines eigenen Abschnitts erkannt. Der Kalender zeigt am jeweiligen Tag ausschließlich den Text bis zum nächsten Datumsstempel. Ältere Notizen mit nur einem `date`-Feld bleiben kompatibel. Im Kalenderdialog ist der jeweilige Abschnitt lesbar, darunter öffnet eine Schaltfläche die gesamte Notiz zur Bearbeitung. Die eigentlichen Notizen bleiben unverändert.

## Updates
Die Startseite prüft alle 5 Minuten, beim Aktivieren und beim Online-Gehen auf eine andere veröffentlichte Version. Das Update-Popup erscheint nur, wenn die Versionskennung in der veröffentlichten `index.html` von der aktuell laufenden Version abweicht. „Später“ unterdrückt denselben Hinweis für die Sitzung; „Jetzt aktualisieren“ lädt die neue Seite. Für folgende Releases die `ivy-organizer-build`-Kennung in `index.html` ändern. Keine Popups allein durch Service-Worker-Neustart.

## Deployment / Datenspeicher
Alle Dateien gemeinsam auf dieselbe Domain und unter denselben URL-Pfad hochladen. Lokal gespeicherte Daten sind an Browser und Origin gebunden; Backups aus früheren Domains müssen ggf. importiert werden. Vor dem ersten Wechsel Backup von Notes und Kalender erstellen. Offline-PWA funktioniert nach erstem erfolgreichen Laden.
