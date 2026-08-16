var FROZEN_THRESHOLD = 20;
var NOTEBOOK_ENTRY_MARKER = '__itb_notebook__';
var NOTEBOOK_CATEGORIES = ['Anschlusspläne', 'Sonderfunktionen', 'Befehle', 'Hardware / Einbau', 'Fehlerbehebung', 'Kundenspezifisch'];

// Gehoert der Eintrag ins Notizbuch? Entscheidet ueber die Liste "Meine Notizen".
function isNotebookEntry(entry) {
  return !!entry && (entry.command === NOTEBOOK_ENTRY_MARKER || entry.category === 'Notizen');
}

// Traegt der Inhalt platzierte Bilder? Entscheidet nur, wie gezeichnet wird.
// Ein bearbeiteter Wissenseintrag bekommt dadurch seine Bilder zu sehen, ohne
// deshalb im Notizbuch aufzutauchen.
function kbEntryHasPlacedImages(entry) {
  return !!entry && /data-notebook-(image|pdf)-id=/.test(String(entry.content || ''));
}

/* ════════════════════════════════════════════════════════════════
   ADMIN – KUNDENSPEZIFISCHE FEATURE-BESCHREIBUNGEN
   Die Einträge werden bewusst lokal im Browser gespeichert und
   können dadurch ohne Server gepflegt werden.
   ════════════════════════════════════════════════════════════════ */
var ADMIN_STORAGE_KEY = 'itb-admin-features-v1';
var ADMIN_TYPES = ['ZCONFIG', 'ZCONFIG2', 'ZCONFIG3', 'ZCONFIG4', 'ZVALUE', 'ZVALUE2', 'DATACONFIG'];
var adminFeatures = adminLoadFeatures();
var KB_STORAGE_KEY = 'itb-knowledge-base-v1';
var kbEntries = kbLoadEntries();
var KB_PDF_DATABASE = 'itb-knowledge-pdfs-v1';
var KB_PDF_STORE = 'pdfs';
var KB_PDF_MAX_SIZE = 25 * 1024 * 1024;
var kbPdfDatabasePromise = null;

function kbEntryId() {
  return 'kb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function kbPdfId() {
  return 'pdf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function kbNormalizePdf(pdf) {
  if (!pdf || !pdf.id || !pdf.name) return null;
  var contentSha256 = String(pdf.contentSha256 || pdf.content_sha256 || '').toLowerCase();
  return {
    id: String(pdf.id),
    name: String(pdf.name).slice(0, 255),
    size: Math.max(0, parseInt(pdf.size, 10) || 0),
    contentSha256: /^[a-f0-9]{64}$/.test(contentSha256) ? contentSha256 : ''
  };
}

function kbNormalizeEntry(entry) {
  if (!entry) return null;
  var category = String(entry.category || '').trim();
  var title = String(entry.title || '').trim();
  var command = String(entry.command || '').trim();
  var content = String(entry.content || '').trim();
  if (!category || !title) return null;
  return {
    id: String(entry.id || kbEntryId()),
    category: category.slice(0, 80),
    title: title.slice(0, 160),
    command: command.slice(0, 200),
    content: content.slice(0, 3000),
    pdfs: (Array.isArray(entry.pdfs) ? entry.pdfs : []).map(kbNormalizePdf).filter(function(pdf) { return pdf !== null; }),
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

function kbOpenPdfDatabase() {
  if (kbPdfDatabasePromise) return kbPdfDatabasePromise;
  kbPdfDatabasePromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error('Der Browser unterstützt keine lokale PDF-Speicherung.'));
      return;
    }
    var request = window.indexedDB.open(KB_PDF_DATABASE, 1);
    request.onupgradeneeded = function() {
      if (!request.result.objectStoreNames.contains(KB_PDF_STORE)) request.result.createObjectStore(KB_PDF_STORE, { keyPath: 'id' });
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error || new Error('PDF-Speicher konnte nicht geöffnet werden.')); };
  });
  return kbPdfDatabasePromise;
}

function kbStorePdf(file, contentSha256) {
  return kbOpenPdfDatabase().then(function(database) {
    return new Promise(function(resolve, reject) {
      var id = kbPdfId();
      var transaction = database.transaction(KB_PDF_STORE, 'readwrite');
      transaction.objectStore(KB_PDF_STORE).put({ id: id, name: file.name, type: file.type || 'application/pdf', data: file });
      transaction.oncomplete = function() { resolve({ id: id, name: file.name, size: file.size, contentSha256: contentSha256 || '' }); };
      transaction.onerror = function() { reject(transaction.error || new Error('PDF konnte nicht gespeichert werden.')); };
    });
  });
}

function kbLoadPdf(id) {
  return kbOpenPdfDatabase().then(function(database) {
    return new Promise(function(resolve, reject) {
      var request = database.transaction(KB_PDF_STORE, 'readonly').objectStore(KB_PDF_STORE).get(id);
      request.onsuccess = function() { resolve(request.result || null); };
      request.onerror = function() { reject(request.error || new Error('PDF konnte nicht gelesen werden.')); };
    });
  });
}

function kbDeletePdf(id) {
  return kbOpenPdfDatabase().then(function(database) {
    return new Promise(function(resolve, reject) {
      var transaction = database.transaction(KB_PDF_STORE, 'readwrite');
      transaction.objectStore(KB_PDF_STORE).delete(id);
      transaction.oncomplete = function() { resolve(); };
      transaction.onerror = function() { reject(transaction.error || new Error('PDF konnte nicht gelöscht werden.')); };
    });
  });
}

function kbFormatFileSize(size) {
  if (size < 1024 * 1024) return Math.max(1, Math.round(size / 1024)) + ' KB';
  return (size / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
}

function kbIsPdfFile(file) {
  return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

async function kbPdfSha256(file) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('Die Duplikatprüfung wird von diesem Browser nicht unterstützt.');
  var digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.prototype.map.call(new Uint8Array(digest), function(byte) { return byte.toString(16).padStart(2, '0'); }).join('');
}

function kbStoredPdfReferences() {
  var references = [];
  kbEntries.forEach(function(entry) {
    (entry.pdfs || []).forEach(function(pdf) {
      references.push({ name: pdf.name, size: pdf.size, contentSha256: pdf.contentSha256 || '' });
    });
  });
  return references;
}

function kbRemotePdfReferences(excludedAttachmentId) {
  var references = [];
  (typeof remoteKnowledgeEntries !== 'undefined' && Array.isArray(remoteKnowledgeEntries) ? remoteKnowledgeEntries : []).forEach(function(entry) {
    (entry.knowledge_attachments || []).forEach(function(file) {
      if (file.id === excludedAttachmentId) return;
      if (file.mime_type === 'application/pdf' && file.content_sha256) {
        references.push({ name: file.original_name, size: file.size_bytes, contentSha256: file.content_sha256 });
      } else if (file.mime_type === 'application/pdf') {
        references.push({ name: file.original_name, size: file.size_bytes, contentSha256: '' });
      }
    });
  });
  return references;
}

function kbNormalizeKnowledgeTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function kbRemoteEntryWithTitle(title, excludedId) {
  var normalizedTitle = kbNormalizeKnowledgeTitle(title);
  if (!normalizedTitle) return null;
  return (typeof remoteKnowledgeEntries !== 'undefined' && Array.isArray(remoteKnowledgeEntries) ? remoteKnowledgeEntries : []).find(function(entry) {
    return entry.id !== excludedId && kbNormalizeKnowledgeTitle(entry.title) === normalizedTitle;
  }) || null;
}

function kbDuplicateTitleError(title, existingEntry) {
  var existingTitle = existingEntry && existingEntry.title ? existingEntry.title : title;
  return 'Der Titel „' + existingTitle + '“ ist bereits in der Wissensdatenbank vorhanden.';
}

async function kbPreparePdfFiles(files, references) {
  var prepared = [];
  var seen = {};
  references = references || [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (!kbIsPdfFile(file)) throw new Error('Nur PDF-Dateien können hinterlegt werden.');
    if (file.size > KB_PDF_MAX_SIZE) throw new Error('„' + file.name + '“ ist größer als 25 MB.');
    var contentSha256 = await kbPdfSha256(file);
    if (seen[contentSha256]) throw new Error('„' + file.name + '“ wurde mehrfach ausgewählt.');
    var existing = references.find(function(reference) { return reference.contentSha256 === contentSha256; });
    if (existing) throw new Error('„' + file.name + '“ ist bereits als „' + existing.name + '“ hinterlegt.');
    var legacyMatch = references.find(function(reference) { return !reference.contentSha256 && reference.name === file.name && Number(reference.size) === Number(file.size); });
    if (legacyMatch) throw new Error('„' + file.name + '“ ist bereits mit gleichem Dateinamen und gleicher Größe hinterlegt.');
    seen[contentSha256] = true;
    prepared.push({ file: file, contentSha256: contentSha256 });
  }
  return prepared;
}

function kbSetPdfTemplateHint(message, type) {
  var hint = document.getElementById('kb-admin-pdf-template-hint');
  if (!hint) return;
  hint.textContent = message || '';
  hint.className = 'pdf-template-hint' + (type ? ' ' + type : '');
}

function kbSetAdminImportStatus(message, type) {
  var status = document.getElementById('kb-admin-import-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'pdf-template-hint' + (type ? ' ' + type : '');
}

function kbAdminImportFileKey(file, index) {
  return [index, file && file.name || '', file && file.size || 0, file && file.lastModified || 0].join('::');
}

function kbAdminImportTitleOverride(file, index) {
  var key = kbAdminImportFileKey(file, index);
  return String(kbAdminImportTitleOverrides[key] || '').trim().slice(0, 160);
}

function kbAdminImportTitleForFile(file, index) {
  return kbAdminImportTitleOverride(file, index) || kbImportTitleFromPdfFilename(file && file.name);
}

function kbAdminImportTitleConflicts(files) {
  var usedTitles = {};
  var conflicts = [];
  for (var index = 0; index < files.length; index++) {
    var file = files[index];
    var title = kbAdminImportTitleForFile(file, index);
    var titleKey = kbNormalizeKnowledgeTitle(title);
    var reasons = [];
    var existingEntry = kbRemoteEntryWithTitle(title);
    if (existingEntry) reasons.push(kbDuplicateTitleError(title, existingEntry));
    if (usedTitles[titleKey]) reasons.push('Der Titel wird auch für „' + usedTitles[titleKey].name + '“ verwendet.');
    if (reasons.length) {
      conflicts.push({
        file: file,
        index: index,
        title: title,
        reason: reasons.join(' ')
      });
    }
    if (!usedTitles[titleKey]) usedTitles[titleKey] = file;
  }
  return conflicts;
}

function kbAdminRenderImportCorrections(conflicts) {
  var container = document.getElementById('kb-admin-import-corrections');
  if (!container) return;
  if (!conflicts || !conflicts.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  container.innerHTML = '<div class="kb-import-corrections-title">Doppelte Titel korrigieren</div>' +
    '<p class="kb-import-corrections-copy">Vergib für die markierten PDFs einen eindeutigen Titel. Anschließend startest du den Import erneut.</p>' +
    conflicts.map(function(conflict) {
      var key = kbAdminImportFileKey(conflict.file, conflict.index);
      return '<label class="kb-import-correction">' +
        '<span class="kb-import-correction-file">' + zcEsc(conflict.file.name) + '</span>' +
        '<span class="kb-import-correction-reason">' + zcEsc(conflict.reason) + '</span>' +
        '<input class="admin-input" type="text" maxlength="160" value="' + zcEsc(conflict.title) + '" data-kb-import-title-key="' + zcEsc(key) + '" oninput="kbAdminUpdateImportTitleCorrection(this)">' +
        '</label>';
    }).join('');
}

function kbAdminUpdateImportTitleCorrection(input) {
  if (!input) return;
  var key = input.getAttribute('data-kb-import-title-key');
  if (!key) return;
  kbAdminImportTitleOverrides[key] = String(input.value || '').slice(0, 160);
  kbSetAdminImportStatus('Titel angepasst. Starte den Import erneut.', '');
}

function kbAdminResetImportCorrections() {
  kbAdminImportTitleOverrides = {};
  kbAdminRenderImportCorrections([]);
  kbSetAdminImportStatus('', '');
}

function kbTitleFromTemplateLine(line) {
  var normalized = String(line || '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  var matches = normalized.matchAll(/([A-ZÄÖÜ][A-Za-zÀ-ÿ0-9./-]*(?:\s+[A-Za-zÀ-ÿ0-9./-]+){0,6})\s*\(\s*((?:19|20)\d{2})\s*-\s*\)/g);
  var candidate = null;
  for (var match of matches) candidate = match;
  if (!candidate) return null;
  var vehicle = candidate[1].replace(/^Setting\s*:\s*["']?\s*/i, '').replace(/["']+$/g, '').trim();
  var year = candidate[2];
  return vehicle.length >= 2 && vehicle.length <= 100 ? vehicle + ' ' + year : null;
}

function kbExtractTemplateVehicleTitle(textItems, pageHeight) {
  var fragments = (textItems || []).map(function(item) {
    return {
      text: String(item.str || '').trim(),
      x: item.transform && typeof item.transform[4] === 'number' ? item.transform[4] : 0,
      y: item.transform && typeof item.transform[5] === 'number' ? item.transform[5] : 0
    };
  }).filter(function(item) { return item.text; });

  // Die Fahrzeugbezeichnung steht bei dieser Einbauanleitungs-Vorlage im unteren Dokumentbereich.
  var lowerFragments = fragments.filter(function(item) { return item.y < pageHeight * 0.32; })
    .sort(function(a, b) { return a.y - b.y || a.x - b.x; });
  var lines = [];
  lowerFragments.forEach(function(fragment) {
    var line = lines.find(function(item) { return Math.abs(item.y - fragment.y) < 3; });
    if (!line) {
      line = { y: fragment.y, fragments: [] };
      lines.push(line);
    }
    line.fragments.push(fragment);
  });
  for (var i = 0; i < lines.length; i++) {
    var lowerLine = lines[i].fragments.sort(function(a, b) { return a.x - b.x; }).map(function(item) { return item.text; }).join(' ');
    var lowerTitle = kbTitleFromTemplateLine(lowerLine);
    if (lowerTitle) return lowerTitle;
  }

  // Fallback: dieselbe Information ist in der Vorlage zusätzlich als „Setting“ hinterlegt.
  var allText = fragments.map(function(item) { return item.text; }).join(' ');
  var settingMatch = allText.match(/Setting\s*:\s*[“”"']?\s*([^()]{2,100}?)\s*\(\s*((?:19|20)\d{2})\s*-\s*\)\s*[“”"']?/i);
  if (!settingMatch) return null;
  var settingVehicle = settingMatch[1].replace(/\s+/g, ' ').trim();
  return settingVehicle ? settingVehicle + ' ' + settingMatch[2] : null;
}

async function kbDetectTemplateVehicleTitle(file) {
  if (!file || !/\.pdf$/i.test(file.name || '') || file.size > KB_PDF_MAX_SIZE || !window.pdfjsLib) return null;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  var documentPdf;
  try {
    documentPdf = await loadingTask.promise;
    var page = await documentPdf.getPage(1);
    var textContent = await page.getTextContent();
    return kbExtractTemplateVehicleTitle(textContent.items, page.getViewport({ scale: 1 }).height);
  } finally {
    if (documentPdf) await documentPdf.destroy();
    else if (loadingTask && typeof loadingTask.destroy === 'function') await loadingTask.destroy();
  }
}

function kbCleanPdfText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function kbSplitPdfText(text) {
  var chunks = [];
  var remaining = kbCleanPdfText(text);
  var maximumLength = 1500;
  while (remaining.length) {
    var cutAt = Math.min(maximumLength, remaining.length);
    if (cutAt < remaining.length) {
      var wordBoundary = remaining.lastIndexOf(' ', cutAt);
      if (wordBoundary > 900) cutAt = wordBoundary;
    }
    var chunk = remaining.slice(0, cutAt).trim();
    if (chunk.length >= 40) chunks.push(chunk);
    remaining = remaining.slice(cutAt).trim();
  }
  return chunks;
}

async function kbExtractPdfSearchChunks(file) {
  if (!window.pdfjsLib) throw new Error('Die PDF-Texterkennung ist nicht verfügbar. Bitte lade die Seite neu.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  var documentPdf;
  var chunks = [];
  try {
    documentPdf = await loadingTask.promise;
    for (var pageNumber = 1; pageNumber <= documentPdf.numPages; pageNumber++) {
      var page = await documentPdf.getPage(pageNumber);
      var textContent = await page.getTextContent();
      var pageText = textContent.items.map(function(item) { return item.str || ''; }).join(' ');
      kbSplitPdfText(pageText).forEach(function(content) {
        chunks.push({ page_number: pageNumber, chunk_index: chunks.length, content: content });
      });
    }
  } finally {
    if (documentPdf) await documentPdf.destroy();
    else if (loadingTask && typeof loadingTask.destroy === 'function') await loadingTask.destroy();
  }
  if (!chunks.length) throw new Error('Die PDF enthält keinen maschinenlesbaren Text.');
  if (chunks.length > 600) throw new Error('Die PDF ist für die automatische KI-Indexierung zu umfangreich.');
  return chunks;
}

async function kbAutofillTitleFromPdfTemplate() {
  var input = document.getElementById('kb-admin-pdfs');
  var titleInput = document.getElementById('kb-admin-title');
  var categoryInput = document.getElementById('kb-admin-category');
  var files = Array.prototype.slice.call(input && input.files || []);
  kbSetPdfTemplateHint('');
  if (!files.length) return;
  try {
    await kbPreparePdfFiles(files, supabaseClient ? kbRemotePdfReferences() : kbStoredPdfReferences());
    var file = files[0];
    var chunks = await kbExtractPdfSearchChunks(file);
    var templateTitle = await kbDetectTemplateVehicleTitle(file);
    var title = templateTitle || kbImportTitleFromPdfFilename(file.name);
    if (!categoryInput.value.trim()) categoryInput.value = 'Anschlusspläne';
    if (!titleInput.value.trim()) titleInput.value = title;
    kbSetPdfTemplateHint('PDF ausgelesen – Kategorie und Titel wurden vorbereitet (' + chunks.length + ' Textabschnitte für die KI-Suche).', 'success');
  } catch (error) {
    kbSetPdfTemplateHint(error && error.message ? error.message : 'PDF konnte nicht ausgelesen werden. Die Felder bleiben unverändert.', 'error');
  }
}

function kbLoadEntries() {
  try {
    var stored = JSON.parse(localStorage.getItem(KB_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map(kbNormalizeEntry).filter(function(entry) { return entry !== null; });
  } catch (err) {
    return [];
  }
}

function kbSaveEntries() {
  localStorage.setItem(KB_STORAGE_KEY, JSON.stringify(kbEntries));
}

function kbGetEntry(id) {
  for (var i = 0; i < kbEntries.length; i++) {
    if (kbEntries[i].id === id) return kbEntries[i];
  }
  return null;
}

function kbMatches(entry, query) {
  return !query || [entry.category, entry.title, entry.command, entry.content].join(' ').toLowerCase().indexOf(query) !== -1;
}

function kbRenderPdfLinks(entry, actions) {
  if (!entry.pdfs || !entry.pdfs.length) return '';
  return '<div class="kb-pdf-list">' + entry.pdfs.map(function(pdf) {
    return '<button class="admin-mini-btn kb-pdf-btn" type="button" onclick="kbOpenPdf(\'' + pdf.id + '\')">PDF: ' + zcEsc(pdf.name) + ' (' + kbFormatFileSize(pdf.size) + ')</button>' +
      (actions ? '<button class="admin-mini-btn delete" type="button" onclick="kbRemovePdf(\'' + entry.id + '\',\'' + pdf.id + '\')" title="PDF entfernen">✕</button>' : '');
  }).join('') + '</div>';
}

function kbRenderEntry(entry, actions) {
  return '<article class="' + (actions ? 'admin-feature' : 'kb-result') + '">' +
    '<div class="admin-feature-head">' +
      '<span class="admin-badge">' + zcEsc(entry.category) + '</span>' +
      (actions ? '<span class="admin-feature-actions">' +
        '<button class="admin-mini-btn" type="button" onclick="kbAdminEdit(\'' + entry.id + '\')">Bearbeiten</button>' +
        '<button class="admin-mini-btn delete" type="button" onclick="kbAdminDelete(\'' + entry.id + '\')">Löschen</button>' +
      '</span>' : '') +
    '</div>' +
    '<div class="' + (actions ? 'admin-feature-desc' : 'kb-result-title') + '">' + zcEsc(entry.title) + '</div>' +
    (entry.command ? '<div class="admin-feature-notes">Befehl: ' + zcEsc(entry.command) + '</div>' : '') +
    '<div class="' + (actions ? 'admin-feature-notes' : 'kb-result-content') + '">' + zcEsc(entry.content) + '</div>' +
    kbRenderPdfLinks(entry, actions) +
  '</article>';
}

async function kbOpenPdf(id) {
  try {
    var pdf = await kbLoadPdf(id);
    if (!pdf || !pdf.data) throw new Error('Die PDF-Datei wurde nicht gefunden.');
    var url = URL.createObjectURL(pdf.data);
    window.open(url, '_blank');
    window.setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  } catch (err) {
    alert('PDF konnte nicht geöffnet werden: ' + err.message);
  }
}

// Das Wissens-Formular ist entfallen; die lokale Fassung ohne Supabase lief
// darueber. Die Funktionen bleiben nur noch als Rueckfall bestehen.
function kbAdminResetForm() {
  var form = document.getElementById('kb-admin-form');
  if (!form) return;
  form.reset();
  form.removeAttribute('data-kb-id');
  delete form.dataset.notebookEntry;
  kbSetPdfTemplateHint('');
  kbSetAdminEditState(null);
}

function kbSetAdminEditState(entry) {
  var state = document.getElementById('kb-admin-edit-state');
  var title = document.getElementById('kb-admin-edit-title');
  var submit = document.getElementById('kb-admin-submit');
  // Das Dateifeld samt Beschriftung gibt es nur noch in der Bibliothek.
  var pdfLabel = document.getElementById('kb-admin-pdfs-label');
  var currentAttachments = document.getElementById('kb-admin-current-attachments');
  var replacementInput = document.getElementById('kb-admin-replace-pdf');
  if (!state || !title || !submit || !currentAttachments || !replacementInput) return;

  replacementInput.value = '';
  delete replacementInput.dataset.attachmentId;
  if (!entry) {
    state.hidden = true;
    title.textContent = '';
    submit.textContent = 'Wissen speichern';
    if (pdfLabel) pdfLabel.textContent = 'PDF-Dokumentation (optional)';
    currentAttachments.hidden = true;
    currentAttachments.innerHTML = '';
    return;
  }

  state.hidden = false;
  title.textContent = entry.title;
  submit.textContent = 'Änderungen speichern';
  if (pdfLabel) pdfLabel.textContent = 'Weitere PDFs anhängen (optional)';
  var attachments = entry.knowledge_attachments || [];
  currentAttachments.hidden = false;
  currentAttachments.innerHTML = attachments.length
    ? attachments.map(function(file) {
      var replace = file.mime_type === 'application/pdf'
        ? '<button type="button" class="admin-mini-btn" onclick="kbOpenDirectPdfEditor(\'' + file.id + '\')">Direkt bearbeiten</button>' +
          '<button type="button" class="admin-mini-btn" onclick="downloadRemoteAttachment(\'' + file.id + '\')">Herunterladen</button>' +
          '<button type="button" class="admin-mini-btn" onclick="kbChooseRemotePdfReplacement(\'' + file.id + '\')">Ersetzen</button>'
        : (remoteImageAttachment(file)
          ? '<button type="button" class="admin-mini-btn" onclick="kbOpenDirectImageEditor(\'' + file.id + '\')">Bild bearbeiten</button>' +
            '<button type="button" class="admin-mini-btn" onclick="downloadRemoteAttachment(\'' + file.id + '\')">Herunterladen</button>'
          : '');
      return '<div class="kb-edit-attachment">' +
        '<span class="kb-edit-attachment-name">' + zcEsc(attachmentKind(file.mime_type)) + ': ' + zcEsc(file.original_name) + ' (' + kbFormatFileSize(file.size_bytes) + ')</span>' +
        '<button type="button" class="admin-mini-btn" onclick="openRemoteAttachment(\'' + file.id + '\')">Öffnen</button>' +
        replace +
        '<button type="button" class="admin-mini-btn delete" onclick="deleteRemoteAttachment(\'' + entry.id + '\',\'' + file.id + '\')">Entfernen</button>' +
      '</div>';
    }).join('')
    : '<div class="kb-edit-attachment">Noch keine Anhänge vorhanden.</div>';
}

function kbChooseRemotePdfReplacement(attachmentId) {
  var form = document.getElementById('kb-admin-form');
  var input = document.getElementById('kb-admin-replace-pdf');
  if (!form || !form.getAttribute('data-kb-id') || !input) return;
  input.value = '';
  input.dataset.attachmentId = attachmentId;
  input.click();
}

async function kbHandleRemotePdfReplacementSelection() {
  var input = document.getElementById('kb-admin-replace-pdf');
  var attachmentId = input && input.dataset.attachmentId;
  var file = input && input.files && input.files[0];
  if (!attachmentId || !file) return;
  if ((input.files || []).length !== 1) {
    kbSetPdfTemplateHint('Bitte wähle genau eine Ersatz-PDF aus.', 'error');
    input.value = '';
    delete input.dataset.attachmentId;
    return;
  }
  var entry = remoteKnowledgeEntries.find(function(item) { return (item.knowledge_attachments || []).some(function(attachment) { return attachment.id === attachmentId; }); });
  var currentAttachment = entry && (entry.knowledge_attachments || []).find(function(attachment) { return attachment.id === attachmentId; });
  try {
    var prepared = await kbPreparePdfFiles([file], kbRemotePdfReferences(attachmentId));
    if (currentAttachment && currentAttachment.content_sha256 && prepared[0].contentSha256 === currentAttachment.content_sha256) {
      kbSetPdfTemplateHint('Diese PDF ist bereits als aktueller Anhang hinterlegt.', 'error');
      input.value = '';
      delete input.dataset.attachmentId;
      return;
    }
    kbSetPdfTemplateHint('Ersatz-PDF ausgewählt: „' + file.name + '“. Sie wird beim Speichern übernommen.', 'success');
  } catch (error) {
    kbSetPdfTemplateHint(error && error.message ? error.message : 'Ersatz-PDF konnte nicht geprüft werden.', 'error');
    input.value = '';
    delete input.dataset.attachmentId;
  }
}

function kbAdminEdit(id) {
  var entry = kbGetEntry(id);
  var form = document.getElementById('kb-admin-form');
  if (!entry || !form) return;
  form.setAttribute('data-kb-id', entry.id);
  document.getElementById('kb-admin-category').value = entry.category;
  document.getElementById('kb-admin-title').value = entry.title;
  document.getElementById('kb-admin-command').value = entry.command || '';
  document.getElementById('kb-admin-content').value = entry.content;
  document.getElementById('kb-admin-title').focus();
}

async function kbAdminDelete(id) {
  var entry = kbGetEntry(id);
  if (!entry || !confirm('Wissenseintrag „' + entry.title + '“ wirklich löschen?')) return;
  kbEntries = kbEntries.filter(function(item) { return item.id !== id; });
  kbSaveEntries();
  try {
    await Promise.all((entry.pdfs || []).map(function(pdf) { return kbDeletePdf(pdf.id); }));
  } catch (err) {
    alert('Der Eintrag wurde gelöscht, einzelne PDF-Dateien konnten aber nicht entfernt werden.');
  }
  kbAdminResetForm();
  kbAdminRender();
  kbRenderSearch();
}

async function kbRemovePdf(entryId, pdfId) {
  var entry = kbGetEntry(entryId);
  var pdf = entry && (entry.pdfs || []).find(function(item) { return item.id === pdfId; });
  if (!entry || !pdf || !confirm('PDF „' + pdf.name + '“ wirklich entfernen?')) return;
  entry.pdfs = entry.pdfs.filter(function(item) { return item.id !== pdfId; });
  entry.updatedAt = new Date().toISOString();
  kbSaveEntries();
  try {
    await kbDeletePdf(pdfId);
  } catch (err) {
    alert('Der PDF-Verweis wurde entfernt, die gespeicherte Datei konnte aber nicht gelöscht werden.');
  }
  kbAdminRender();
  kbRenderSearch();
}

function kbAdminRender() {
  var list = document.getElementById('kb-admin-list');
  // Das Zaehler-Badge ist optional, die Liste wird auch ohne gezeichnet.
  var count = document.getElementById('kb-admin-count');
  if (!list) return;
  var query = (document.getElementById('kb-admin-search').value || '').trim().toLowerCase();
  var entries = kbEntries.slice().sort(function(a, b) { return a.category.localeCompare(b.category) || a.title.localeCompare(b.title); })
    .filter(function(entry) { return kbMatches(entry, query); });
  if (count) count.textContent = kbEntries.length;
  list.innerHTML = entries.length ? entries.map(function(entry) { return kbRenderEntry(entry, true); }).join('') :
    '<div class="zc-empty">' + (kbEntries.length ? 'Keine Wissenseinträge zur Suche gefunden.' : 'Noch keine Wissenseinträge hinterlegt.') + '</div>';
}

function kbRenderSearch() {
  var results = document.getElementById('kb-search-results');
  var input = document.getElementById('kb-search');
  if (!results || !input) return;
  var query = input.value.trim().toLowerCase();
  if (!query) {
    results.innerHTML = '';
    return;
  }
  var entries = kbEntries.filter(function(entry) { return kbMatches(entry, query); });
  results.innerHTML = entries.length ? entries.map(function(entry) { return kbRenderEntry(entry, false); }).join('') :
    '<div class="kb-empty">Keine Informationen zu dieser Suche gefunden.</div>';
}

function adminFeatureKey(type, position) {
  return type + ':' + position;
}

function adminNormalizeFeature(item) {
  if (!item || ADMIN_TYPES.indexOf(item.type) === -1) return null;
  var position = parseInt(item.position, 10);
  var description = String(item.description || '').trim();
  if (!position || position < 1 || position > 999 || !description) return null;
  return {
    type: item.type,
    position: position,
    customer: String(item.customer || '').trim().slice(0, 100),
    description: description.slice(0, 1000),
    notes: String(item.notes || '').trim().slice(0, 1000),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function adminLoadFeatures() {
  try {
    var stored = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    var result = [];
    stored.forEach(function(item) {
      var normalized = adminNormalizeFeature(item);
      if (normalized) result.push(normalized);
    });
    return result;
  } catch (err) {
    return [];
  }
}

function adminSaveFeatures() {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminFeatures));
}

function adminGetFeature(type, position) {
  var key = adminFeatureKey(type, position);
  for (var i = 0; i < adminFeatures.length; i++) {
    if (adminFeatureKey(adminFeatures[i].type, adminFeatures[i].position) === key) return adminFeatures[i];
  }
  return null;
}

function zcTypeForMode() {
  return {
    config: 'ZCONFIG', config2: 'ZCONFIG2', config3: 'ZCONFIG3', config4: 'ZCONFIG4',
    value: 'ZVALUE', value2: 'ZVALUE2', dataconfig: 'DATACONFIG'
  }[zcMode] || '';
}

function zcFeatureDescription(type, position, fallback) {
  var feature = adminGetFeature(type, position);
  if (!feature) return fallback;
  var prefix = feature.customer ? '<small>Kunde: ' + zcEsc(feature.customer) + '</small><br>' : '';
  var notes = feature.notes ? '<br><small>Hinweis: ' + zcEsc(feature.notes) + '</small>' : '';
  return '<span class="custom-feature">' + prefix + zcEsc(feature.description) + notes + '</span>';
}

function zcFeatureSearchText(type, position) {
  var feature = adminGetFeature(type, position);
  return feature ? [feature.customer, feature.description, feature.notes].join(' ') : '';
}

function adminResetForm() {
  document.getElementById('admin-form').reset();
  document.getElementById('admin-form-title').textContent = 'Feature anlegen';
  document.getElementById('admin-position').removeAttribute('data-original-key');
}

function adminEdit(type, position) {
  var feature = adminGetFeature(type, position);
  if (!feature) return;
  document.getElementById('admin-type').value = feature.type;
  document.getElementById('admin-position').value = feature.position;
  document.getElementById('admin-position').setAttribute('data-original-key', adminFeatureKey(feature.type, feature.position));
  document.getElementById('admin-customer').value = feature.customer;
  document.getElementById('admin-description').value = feature.description;
  document.getElementById('admin-notes').value = feature.notes;
  document.getElementById('admin-form-title').textContent = 'Feature bearbeiten';
  document.getElementById('admin-description').focus();
}

function adminDelete(type, position) {
  var feature = adminGetFeature(type, position);
  if (!feature || !confirm(type + ' Position ' + position + ' wirklich löschen?')) return;
  adminFeatures = adminFeatures.filter(function(item) {
    return !(item.type === type && item.position === position);
  });
  adminSaveFeatures();
  adminResetForm();
  adminRender();
  if (zcBits.length) zcRender();
}

function adminRender() {
  var list = document.getElementById('admin-list');
  var count = document.getElementById('admin-count');
  if (!list || !count) return;
  var query = (document.getElementById('admin-search').value || '').trim().toLowerCase();
  var features = adminFeatures.slice().sort(function(a, b) {
    return a.type.localeCompare(b.type) || a.position - b.position;
  }).filter(function(feature) {
    return !query || [feature.type, feature.position, feature.customer, feature.description, feature.notes].join(' ').toLowerCase().indexOf(query) !== -1;
  });
  count.textContent = adminFeatures.length;
  if (!features.length) {
    list.innerHTML = '<div class="zc-empty">' + (adminFeatures.length ? 'Keine Features zur Suche gefunden.' : 'Noch keine Features hinterlegt.') + '</div>';
    return;
  }
  var html = '';
  features.forEach(function(feature) {
    html += '<article class="admin-feature">' +
      '<div class="admin-feature-head">' +
        '<span class="admin-badge">' + zcEsc(feature.type) + ' · ' + feature.position + '</span>' +
        (feature.customer ? '<span class="admin-customer">' + zcEsc(feature.customer) + '</span>' : '') +
        '<span class="admin-feature-actions">' +
          '<button class="admin-mini-btn" type="button" onclick="adminEdit(\'' + feature.type + '\',' + feature.position + ')">Bearbeiten</button>' +
          '<button class="admin-mini-btn delete" type="button" onclick="adminDelete(\'' + feature.type + '\',' + feature.position + ')">Löschen</button>' +
        '</span>' +
      '</div>' +
      '<div class="admin-feature-desc">' + zcEsc(feature.description) + '</div>' +
      (feature.notes ? '<div class="admin-feature-notes">Hinweis: ' + zcEsc(feature.notes) + '</div>' : '') +
    '</article>';
  });
  list.innerHTML = html;
}

document.getElementById('admin-form').addEventListener('submit', function(event) {
  event.preventDefault();
  var feature = adminNormalizeFeature({
    type: document.getElementById('admin-type').value,
    position: document.getElementById('admin-position').value,
    customer: document.getElementById('admin-customer').value,
    description: document.getElementById('admin-description').value,
    notes: document.getElementById('admin-notes').value
  });
  if (!feature) return;
  var originalKey = document.getElementById('admin-position').getAttribute('data-original-key');
  adminFeatures = adminFeatures.filter(function(item) {
    return adminFeatureKey(item.type, item.position) !== adminFeatureKey(feature.type, feature.position) && adminFeatureKey(item.type, item.position) !== originalKey;
  });
  adminFeatures.push(feature);
  adminSaveFeatures();
  adminResetForm();
  adminRender();
  if (zcBits.length) zcRender();
});
