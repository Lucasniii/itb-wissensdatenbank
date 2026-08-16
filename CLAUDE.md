# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Überblick

ITB ist eine statische Web-App für Fahrzeug-Techniker: QR-Code-Decoder,
Excel-Auswertungen (KM-Prüfung, PTO-Erkennung) und eine Wissensdatenbank mit
KI-Suche. Backend ist Supabase (Postgres, Auth, Storage, eine Edge Function).

**Kein Build-Schritt, kein Paketmanager, keine Tests.** Es gibt weder
`package.json` noch CI. Die Feature-Dateien sind klassische Skripte ohne
Module; alle Funktionen und Zustandsvariablen sind global.

## Befehle

Statisch ausliefern und im Browser prüfen — `file://` funktioniert zwar, aber
Supabase-Auth verhält sich nur über HTTP zuverlässig:

```bash
node -e "const h=require('http'),f=require('fs'),p=require('path'),R=process.cwd(),T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const F=p.join(R,u);if(!F.startsWith(R))return s.writeHead(403),s.end();f.readFile(F,(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200,{'Content-Type':T[p.extname(F)]||'application/octet-stream'}),s.end(d)))}).listen(4173,()=>console.log('http://localhost:4173'))"
```

`python3 -m http.server` scheitert in der Sandbox dieser Umgebung an einem
`PermissionError` beim Import — den Node-Einzeiler oben stattdessen verwenden.

Prüfung vor der Übergabe (aus `AGENTS.md`, Regel 4):

```bash
node --check src/app/knowledge.js && git diff --check
```

Da es keine Tests gibt, wird Verhalten im Browser geprüft: Funktionen direkt
aufrufen und Rückgaben auswerten. Supabase-Schreibaufrufe dabei abfangen statt
wirklich schreiben (siehe „Eine Instanz für alles").

## Architektur

### Ladereihenfolge ist Vertrag

`index.html` enthält nur die Oberfläche und bestimmt die Reihenfolge: erst alle
`src/features/*/index.js`, dann `src/app/knowledge.js`, zuletzt
`src/app/main.js`. Feature-Dateien dürfen globale Funktionen aus `knowledge.js`
benutzen, weil sie zur Laufzeit (nicht beim Laden) aufgerufen werden. Umgekehrt
ruft `knowledge.js` Feature-Funktionen defensiv auf:
`if (typeof notebookRender === 'function')`.

### Ansichten und Rollen

Hauptreiter sind `<section class="view" id="view-*">`; `.active` schaltet um
(`main.js`). Der Adminbereich hat zusätzlich Unterreiter
(`.admin-subtab` / `.admin-subview`, umgeschaltet über `showAdminSubview()`).

Sichtbarkeit läuft rein über CSS und zwei Body-Klassen, gesetzt in
`updateAuthUI()`:

```
body.is-authenticated [data-auth-only]
body.is-admin         [data-admin-only]
```

`showActiveView(name)` wechselt nur, wenn der Reiter sichtbar ist — sonst
landet man auf dem Decoder. Beim Testen mit vorgetäuschtem `currentProfile`
muss die Body-Klasse mitgesetzt werden, sonst schlägt der Wechsel fehl.

### Datenfluss

Eine Ladefunktion, danach zeichnen alle Ansichten neu:

```
loadRemoteKnowledge()
  → remoteKnowledgeEntries          (globaler Zustand)
  → hydrateRemoteImagePreviews()    (signierte URLs als preview_url)
  → kbAdminRender, kbLibraryRender, kbRenderSearch, renderTechDrafts, notebookRender
```

Tabellen: `profiles`, `knowledge_entries`, `knowledge_attachments`,
`knowledge_pdf_edits`, `knowledge_document_chunks`. Storage-Bucket:
`knowledge-files`. Die Edge Function `knowledge-ai` kennt die Aktion `search`
und braucht `OPENAI_API_KEY` als Supabase-Secret.

Supabase-URL und Publishable Key stehen im Klartext oben in
`src/app/knowledge.js` — das ist so gewollt, der Schutz liegt in den
RLS-Regeln in `supabase/schema.sql`.

## Fallstricke

Diese Punkte sind aus dem Code nicht ablesbar und haben schon Fehler erzeugt:

**Die Notizbuch-Markierung wohnt im Feld `command`.** `__itb_notebook__` als
`command` markiert einen Eintrag als Notiz. Zwei Fragen hängen daran und
dürfen nicht vermischt werden:

- `isNotebookEntry(entry)` — gehört in die Liste „Meine Notizen"
- `kbEntryHasPlacedImages(entry)` — Inhalt muss als Rich-Inhalt gezeichnet werden

Wer beim Speichern blind `command: NOTEBOOK_ENTRY_MARKER` setzt, verwandelt
jeden bearbeiteten Wissenseintrag in eine Notiz und überschreibt einen echten
Befehl.

**Platzierte Bilder sind `position: absolute`.** Ihr Container braucht
`position: relative`, sonst richten sie sich an der Seite aus und stehen
außerhalb der Notiz. Betrifft `.notebook-rendered-content`; die Höhe stammt aus
`notebookFitRenderedContent()`, weil die Bilder aus dem Textfluss fallen. In
zugeklappten Bereichen gerendert, haben Bilder noch keine Höhe — ein
ResizeObserver misst nach.

**Gerenderte Notizen entstehen über `innerHTML`.** Listener an den Bildern
gehen dabei verloren. Klick, Tastatur und Ladeereignisse laufen deshalb über
Delegation am Dokument, teils in der Capture-Phase.

**`content` ist auf 3000 Zeichen begrenzt** (Datenbank-Check). Bildplatzierungen
zählen mit, weil sie als `data-notebook-*`-Attribute im Inhalt stehen.

**Der Direkt-Editor behält die Anhang-Kennung**, legt die Datei aber an einem
neuen `storage_path` ab. Offene Ansichten zeigen sonst die alte Fassung —
dafür gibt es `notebookRefreshInlineImageSources()`.

**Eine Instanz für alles.** Entwicklung und Produktion teilen sich dieselbe
Supabase-Instanz, mit echten Einträgen. Beim Testen im Browser keine echten
Schreibaufrufe auslösen, sondern `supabaseClient.from` abfangen und nur das
Ergebnis prüfen.

## Konventionen

- Oberflächentexte auf Deutsch **mit** Umlauten (`Freigegebene Einträge`)
- Code-Kommentare und Commit-Nachrichten **ohne** Umlaute (`ae`, `oe`, `ue`, `ss`)
- Kommentare erklären das Warum, nicht das Was, und stehen nur dort, wo die
  Absicht sonst nicht erkennbar wäre
- Bestehender Stil: `var`, `function`-Deklarationen, keine Module

## Zu den Regel-Dateien

`AGENTS.md` und `docs/ownership.md` beschreiben eine Aufteilung auf mehrere
parallel arbeitende Agenten mit abstimmungspflichtigen Dateien. Dieser
Zuschnitt gilt nicht mehr — die Ordnergrenzen sind heute nur noch eine
Empfehlung. `docs/architecture.md` beschreibt die Laufzeit weiterhin korrekt.
