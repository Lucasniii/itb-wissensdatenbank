# ITB – Arbeitsregeln für Coding-Agents

Die App ist nach Funktionen getrennt. Arbeite nur im vereinbarten Bereich und
ändere Dateien außerhalb davon nur, wenn die Aufgabe es wirklich erfordert.

## Zuständigkeiten

| Bereich | Pfad | Verantwortung |
| --- | --- | --- |
| Decoder | `src/features/decoder/` | Decoder-Logik |
| KM-Prüfung | `src/features/km-check/` | Excel-Auswertung |
| PTO-Erkennung | `src/features/pto/` | KZ-/Datei-Abgleich |
| Notizbuch | `src/features/notebook/` | Editor, Text, Bilder, Anhänge |
| PDF-Editor | `src/features/pdf-editor/` | PDF-Anmerkungen |
| Admin | `src/features/admin/` | Admin-Oberfläche und lokale Feature-Verwaltung |
| Wissensdatenbank & Auth | `src/app/knowledge.js` | Supabase, Rollen, Anhänge, KI-Suche |
| App-Start | `src/app/main.js` | Einbindungen und Startlogik |
| Gemeinsame Styles | `src/styles/app.css` | Nur nach Abstimmung |
| Datenbank | `supabase/` | Nur ein Agent gleichzeitig |

## Regeln

1. Keine Änderungen direkt in `index.html`, außer bei App-Shell oder Script-/Style-Einbindungen.
2. Neue Logik gehört in den passenden Feature-Ordner.
3. Gemeinsame Datenbank-, Auth- oder Storage-Änderungen zuerst in
   `docs/architecture.md` prüfen und abstimmen. Änderungen an
   `src/app/knowledge.js` bitte nur in einem Branch gleichzeitig.
4. Vor der Übergabe mindestens JavaScript-Syntax und `git diff --check` prüfen.
5. Keine Secrets, Service-Role-Keys oder Tokens in Dateien schreiben.
