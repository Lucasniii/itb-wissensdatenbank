# ITB – Hinweise für Claude Code

Lies zuerst `AGENTS.md` und `docs/architecture.md`.

Arbeite ausschließlich in dem vereinbarten Feature-Ordner. Für das Notizbuch
ist das `src/features/notebook/`. Die vorhandenen globalen Funktionen aus
`src/app/knowledge.js` sind die aktuelle Kompatibilitätsschicht; verändere deren
Schnittstellen nicht ohne Abstimmung.

Für Datenbankänderungen in `supabase/` keine Dateien anderer Features
anpassen und immer nur eine Änderung gleichzeitig vorbereiten.
