# ITB-Architektur

## Ziel

Die Anwendung bleibt eine statische Web-App ohne Build-Schritt. Die
Funktionen werden dennoch als klassische JavaScript-Dateien in getrennten
Ordnern geladen. Dadurch funktionieren die vorhandenen Inline-Bedienelemente
weiter und einzelne Bereiche können unabhängig bearbeitet werden.

## Laufzeit

`index.html` enthält nur noch die Oberfläche, Bibliotheks-Imports und die
Reihenfolge der Dateien. `src/styles/app.css` enthält die gemeinsamen
Styles. Die Feature-Dateien laden zuerst; danach lädt
`src/app/knowledge.js` die gemeinsame Supabase-/Wissenslogik und
`src/app/main.js` startet die App.

## Gemeinsame Schnittstellen

Feature-Dateien dürfen diese bestehenden Werte aus `src/app/knowledge.js`
benutzen:

- `supabaseClient`, `currentSession`, `currentProfile`
- `remoteKnowledgeEntries`
- `loadRemoteKnowledge()`
- `uploadRemoteAttachments()`
- `remoteImageAttachment()`, `remoteAttachmentHtml()`

Diese Schnittstellen werden erst in einem eigenen Schritt in
`src/shared/` überführt. Bis dahin gilt `src/app/knowledge.js` als
Kompatibilitätsschicht.

## Parallel arbeiten

Ein Agent arbeitet pro Feature-Ordner. Änderungen an
`src/app/knowledge.js`, `src/app/main.js`, `src/styles/app.css`,
`index.html` oder `supabase/` sind Integrationsänderungen und werden
nacheinander vorgenommen.

Empfohlener Ablauf:

1. Lokalen Ausgangspunkt committen.
2. Für jedes Feature einen eigenen Git-Branch oder Worktree verwenden.
3. Feature isoliert testen.
4. Änderungen nacheinander in den Integrationsbranch übernehmen.

Beispiel:

```bash
git worktree add ../itb-notebook claude/notebook
git worktree add ../itb-decoder codex/decoder
```

Beide Worktrees verwenden dieselbe Supabase-Instanz. Daher dürfen
Schema-, RLS-, Storage- und Edge-Function-Änderungen nicht parallel erfolgen.
