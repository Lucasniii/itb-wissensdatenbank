# Feature-Eigentümerschaft

| Aufgabe | Primärer Bereich | Darf ohne Abstimmung geändert werden |
| --- | --- | --- |
| Notiztext, Bilder, Anhänge im Notizbuch | `src/features/notebook/` | Ja |
| Decoder-Bits und ZCONFIG-Ansicht | `src/features/decoder/` | Ja |
| Excel-Prüfung | `src/features/km-check/` | Ja |
| KZ-Merge und PTO-Erkennung | `src/features/pto/` | Ja |
| PDF-Anmerkungen und Rendern | `src/features/pdf-editor/` | Ja |
| Admin-Oberfläche | `src/features/admin/` | Ja, innerhalb des Feature-Ordners |
| Anmeldung und Wissensdatenbank | `src/app/knowledge.js` | Nur mit Abstimmung |
| Navigation und App-Start | `src/app/main.js` | Nur mit Abstimmung |
| Gemeinsame Styles | `src/styles/app.css` | Nur mit Abstimmung |
| Datenbankschema und Edge Functions | `supabase/` | Nur mit Abstimmung |
