var SUPABASE_URL = 'https://fcqmkmlrpppbogjigoti.supabase.co';
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8FNuN7cG4W0royNbZqcn5A_QucUqzxM';
var supabaseClient = null;
var currentSession = null;
var currentProfile = null;
var remoteKnowledgeEntries = [];
var kbAdminImportTitleOverrides = {};
var kbAdminHtmlImportPackage = null;
var authSignUpMode = false;
var REMOTE_ATTACHMENT_MAX_SIZE = 25 * 1024 * 1024;
var kbAiSearchInProgress = false;

function authMessage(message, type) {
  var target = document.getElementById('auth-message');
  target.textContent = message || '';
  target.className = 'auth-message' + (type ? ' ' + type : '');
}

function setAuthOverlay(visible) {
  document.getElementById('auth-overlay').classList.toggle('visible', visible);
  if (visible) authMessage('', '');
}

function setAuthMode(signUp) {
  authSignUpMode = signUp;
  document.getElementById('auth-title').textContent = signUp ? 'Techniker-Konto anlegen' : 'Anmelden';
  document.getElementById('auth-copy').textContent = signUp ? 'Neue Konten erhalten automatisch die Techniker-Rolle.' : 'Melde dich mit deinem Techniker- oder Admin-Konto an.';
  document.getElementById('auth-name-field').style.display = signUp ? 'grid' : 'none';
  document.getElementById('auth-submit').textContent = signUp ? 'Konto anlegen' : 'Anmelden';
  document.getElementById('auth-switch').textContent = signUp ? 'Ich habe bereits ein Konto' : 'Neues Techniker-Konto anlegen';
  document.getElementById('auth-password').autocomplete = signUp ? 'new-password' : 'current-password';
  authMessage('', '');
}

function showActiveView(name) {
  var tab = document.querySelector('.tab[data-view="' + name + '"]');
  if (tab && getComputedStyle(tab).display !== 'none') tab.click();
  else document.querySelector('.tab[data-view="zconfig"]').click();
}

function updateAuthUI() {
  var loggedIn = !!(currentSession && currentProfile);
  var isAdmin = loggedIn && currentProfile.role === 'admin';
  document.body.classList.toggle('is-authenticated', loggedIn);
  document.body.classList.toggle('is-admin', isAdmin);
  var status = document.getElementById('account-status');
  status.className = 'account-status' + (loggedIn ? ' signed-in' : '');
  status.textContent = loggedIn ? (currentProfile.display_name || currentProfile.email || 'Angemeldet') + ' · ' + (isAdmin ? 'Admin' : 'Techniker') : 'Nicht angemeldet';
  document.getElementById('auth-open').style.display = loggedIn ? 'none' : 'inline-flex';
  document.getElementById('auth-signout').style.display = loggedIn ? 'inline-flex' : 'none';
  if (loggedIn) {
    loadRemoteKnowledge();
    renderTechDrafts();
  }
}

async function loadCurrentProfile() {
  currentProfile = null;
  if (!currentSession) return;
  var response = await supabaseClient.from('profiles').select('id,email,display_name,role').eq('id', currentSession.user.id).maybeSingle();
  if (response.error) {
    console.warn(response.error.message);
    return;
  }
  currentProfile = response.data || { id: currentSession.user.id, email: currentSession.user.email, display_name: '', role: 'technician' };
}

async function refreshAuthState() {
  var response = await supabaseClient.auth.getSession();
  currentSession = response.data.session;
  await loadCurrentProfile();
  updateAuthUI();
}

function authOpen() {
  setAuthMode(false);
  setAuthOverlay(true);
  document.getElementById('auth-email').focus();
}

async function initializeSupabase() {
  if (!window.supabase) {
    console.warn('Supabase-Bibliothek wurde nicht geladen.');
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  supabaseClient.auth.onAuthStateChange(function() { window.setTimeout(refreshAuthState, 0); });
  await refreshAuthState();
}

function setKbAiStatus(targetId, message, type) {
  var target = document.getElementById(targetId);
  if (!target) return;
  target.textContent = message || '';
  target.className = 'kb-ai-status' + (type ? ' ' + type : '');
}

function setKbAiAnswer(message) {
  var target = document.getElementById('kb-ai-answer');
  if (!target) return;
  target.textContent = message || '';
  target.classList.toggle('visible', !!message);
}

async function functionErrorMessage(error) {
  if (error && error.context && typeof error.context.clone === 'function') {
    try {
      var payload = await error.context.clone().json();
      if (payload && payload.error) return payload.error;
    } catch (ignored) {}
  }
  return error && error.message ? error.message : 'Unbekannter Fehler';
}

async function indexRemoteKnowledgeEntry(entryId) {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return false;
  var response = await supabaseClient.functions.invoke('knowledge-ai', {
    body: { action: 'index_entry', entry_id: entryId }
  });
  if (response.error || response.data && response.data.error) {
    console.warn('KI-Suchindex konnte nicht aktualisiert werden.', response.error || response.data.error);
    return false;
  }
  return true;
}

async function indexRemoteKnowledgeDocuments(entryId) {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return false;
  var response = await supabaseClient.functions.invoke('knowledge-ai', {
    body: { action: 'index_entry_documents', entry_id: entryId }
  });
  if (response.error || response.data && response.data.error) {
    console.warn('PDF-Suchindex konnte nicht aktualisiert werden.', response.error || response.data.error);
    return false;
  }
  return true;
}

async function kbAiSearch() {
  if (kbAiSearchInProgress || !currentSession) return;
  var input = document.getElementById('kb-ai-query');
  var results = document.getElementById('kb-ai-results');
  var submit = document.getElementById('kb-ai-submit');
  var query = input.value.trim();
  if (query.length < 3) return;

  kbAiSearchInProgress = true;
  submit.disabled = true;
  setKbAiStatus('kb-ai-status', 'KI durchsucht die Wissensdatenbank …');
  setKbAiAnswer('');
  results.innerHTML = '';
  try {
    var response = await supabaseClient.functions.invoke('knowledge-ai', { body: { action: 'search', query: query } });
    if (response.error) throw response.error;
    if (response.data && response.data.error) throw new Error(response.data.error);
    var byId = {};
    remoteKnowledgeEntries.forEach(function(entry) { byId[entry.id] = entry; });
    var matches = (response.data && response.data.results) || [];
    var entries = matches.map(function(match) {
      var entry = byId[match.id];
      return entry ? Object.assign({}, entry, { ai_similarity: match.similarity }) : null;
    }).filter(Boolean);
    var documentMatches = (response.data && response.data.documents) || [];
    var matchCount = entries.length + documentMatches.length;
    setKbAiAnswer(response.data && response.data.answer || '');
    setKbAiStatus('kb-ai-status', matchCount ? matchCount + ' passende Quellen gefunden.' : 'Keine passenden Wissenseinträge oder PDF-Stellen gefunden.', matchCount ? 'success' : '');
    results.innerHTML = matchCount
      ? entries.map(function(entry) { return remoteEntryHtml(entry, {}); }).join('') + documentMatches.map(kbAiDocumentResultHtml).join('')
      : '';
  } catch (error) {
    setKbAiStatus('kb-ai-status', 'KI-Suche nicht verfügbar: ' + await functionErrorMessage(error), 'error');
  } finally {
    kbAiSearchInProgress = false;
    submit.disabled = false;
  }
}

async function kbAiIndexAll() {
  if (!currentProfile || currentProfile.role !== 'admin') return;
  var button = document.getElementById('kb-ai-index');
  button.disabled = true;
  setKbAiStatus('kb-ai-index-status', 'KI-Suchindex wird aktualisiert …');
  try {
    var response = await supabaseClient.functions.invoke('knowledge-ai', { body: { action: 'index_all' } });
    if (response.error) throw response.error;
    if (response.data && response.data.error) throw new Error(response.data.error);
    var entryCount = (response.data && response.data.indexed) || 0;
    var documentChunkCount = (response.data && response.data.document_chunks_indexed) || 0;
    setKbAiStatus('kb-ai-index-status', entryCount + ' freigegebene Einträge und ' + documentChunkCount + ' PDF-Textabschnitte wurden indexiert.', 'success');
  } catch (error) {
    setKbAiStatus('kb-ai-index-status', 'Indexierung nicht verfügbar: ' + await functionErrorMessage(error), 'error');
  } finally {
    button.disabled = false;
  }
}

function attachmentTypeAllowed(file) {
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) >= 0 || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
}

function attachmentKind(mimeType) {
  return mimeType && mimeType.indexOf('image/') === 0 ? 'Foto' : 'PDF';
}

function remoteEntryMatches(entry, query) {
  return !query || [entry.category, entry.title, entry.command, entry.content].join(' ').toLowerCase().indexOf(query) >= 0;
}

function remoteEntryStatus(entry) {
  return entry.status === 'published' ? '<span class="admin-badge" style="color:var(--green);border-color:rgba(68,255,136,.4)">Freigegeben</span>' : '<span class="admin-badge" style="color:var(--orange);border-color:rgba(255,153,68,.4)">Entwurf</span>';
}

function remoteImageAttachment(file) {
  return !!(file && file.mime_type && file.mime_type.indexOf('image/') === 0);
}

function remoteEntryDate(entry) {
  var timestamp = entry.updated_at || entry.created_at;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return '';
  return new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

// Einfacher Klick oeffnet die Datei, Doppelklick den Direkt-Editor. Fuer Admins
// wartet der einfache Klick kurz, sonst oeffnet der Doppelklick zusaetzlich einen
// Tab. Alle anderen sehen die Datei ohne Verzoegerung.
var kbImageClickTimer = null;

function kbImageOpenDelayed(attachmentId) {
  window.clearTimeout(kbImageClickTimer);
  if (!currentProfile || currentProfile.role !== 'admin') { openRemoteAttachment(attachmentId); return; }
  kbImageClickTimer = window.setTimeout(function() { openRemoteAttachment(attachmentId); }, 250);
}

function kbImageEditDirect(attachmentId) {
  window.clearTimeout(kbImageClickTimer);
  // Ohne Adminrechte hat der einfache Klick die Datei schon geoeffnet.
  if (!currentProfile || currentProfile.role !== 'admin') return;
  if (typeof kbOpenDirectImageEditor === 'function') kbOpenDirectImageEditor(attachmentId);
}

function remoteImageGalleryHtml(entry, editable, excludedAttachmentIds, imageEditable) {
  excludedAttachmentIds = excludedAttachmentIds || {};
  var images = (entry.knowledge_attachments || []).filter(function(file) {
    return remoteImageAttachment(file) && file.preview_url && !excludedAttachmentIds[file.id];
  });
  if (!images.length) return '';
  return '<div class="kb-gallery">' + images.map(function(file) {
    return '<div class="kb-image-tile">' +
      '<button class="kb-image-open" type="button" onclick="kbImageOpenDelayed(\'' + file.id + '\')" ondblclick="kbImageEditDirect(\'' + file.id + '\')" title="' + (imageEditable ? 'Foto öffnen, Doppelklick zum Bearbeiten: ' : 'Foto öffnen: ') + zcEsc(file.original_name) + '">' +
        '<img src="' + zcEsc(file.preview_url) + '" alt="Vorschau: ' + zcEsc(file.original_name) + '" loading="lazy">' +
      '</button>' +
      (imageEditable ? '<button class="admin-mini-btn kb-image-edit" type="button" onclick="kbOpenDirectImageEditor(\'' + file.id + '\')" title="Bild direkt bearbeiten">Bearbeiten</button>' : '') +
      (editable ? '<button class="admin-mini-btn delete kb-image-remove" type="button" onclick="deleteRemoteAttachment(\'' + entry.id + '\',\'' + file.id + '\')" title="Foto entfernen">✕</button>' : '') +
    '</div>';
  }).join('') + '</div>';
}

function remoteAttachmentHtml(entry, editable) {
  var attachments = (entry.knowledge_attachments || []).filter(function(file) { return !remoteImageAttachment(file) || !file.preview_url; });
  if (!attachments.length) return '';
  return '<div class="kb-pdf-list kb-attachment-list">' + attachments.map(function(file) {
    return '<div class="kb-attachment-row">' +
      '<div class="kb-attachment-actions">' +
        '<button class="admin-mini-btn kb-pdf-btn" type="button" onclick="openRemoteAttachment(\'' + file.id + '\')">' + attachmentKind(file.mime_type) + ': ' + zcEsc(file.original_name) + ' (' + kbFormatFileSize(file.size_bytes) + ')</button>' +
        (kbAttachmentPreviewable(file) ? '<button class="admin-mini-btn kb-preview-toggle" type="button" aria-expanded="false" onclick="kbToggleAttachmentPreview(this,\'' + file.id + '\')">Vorschau</button>' : '') +
        '<button class="admin-mini-btn" type="button" onclick="downloadRemoteAttachment(\'' + file.id + '\')" title="Herunterladen: ' + zcEsc(file.original_name) + '">Herunterladen</button>' +
        (editable ? '<button class="admin-mini-btn delete" type="button" onclick="deleteRemoteAttachment(\'' + entry.id + '\',\'' + file.id + '\')" title="Anhang entfernen">✕</button>' : '') +
      '</div>' +
      '<div class="kb-preview" hidden></div>' +
    '</div>';
  }).join('') + '</div>';
}

function kbAiDocumentResultHtml(match) {
  var excerpt = String(match.content || '').replace(/\s+/g, ' ').trim();
  if (excerpt.length > 900) excerpt = excerpt.slice(0, 897).replace(/\s+\S*$/, '') + ' …';
  return '<article class="admin-feature kb-card">' +
    '<div class="admin-feature-head"><span class="admin-badge">PDF-Treffer</span><span class="admin-badge">Seite ' + zcEsc(match.page_number) + '</span></div>' +
    '<div class="kb-card-body">' +
      '<div class="kb-card-title">' + zcEsc(match.document_name || 'PDF-Dokumentation') + '</div>' +
      (match.entry_title ? '<div class="kb-card-meta">Wissenseintrag: ' + zcEsc(match.entry_title) + '</div>' : '') +
      '<div class="admin-feature-notes" style="white-space:pre-wrap">' + zcEsc(excerpt) + '</div>' +
      '<div class="kb-pdf-list"><button class="admin-mini-btn kb-pdf-btn" type="button" onclick="openRemoteAttachment(\'' + match.attachment_id + '\',' + Number(match.page_number || 1) + ')">PDF auf Seite ' + zcEsc(match.page_number) + ' öffnen</button></div>' +
    '</div>' +
  '</article>';
}

function remoteEntryHtml(entry, options) {
  options = options || {};
  var actions = '';
  var aiBadge = typeof entry.ai_similarity === 'number' ? '<span class="admin-badge">KI-Treffer</span>' : '';
  if (options.admin) {
    actions = '<span class="admin-feature-actions">' +
      // In der Wissensdatenbank-Bibliothek gibt es eigene Bearbeiten-Knoepfe.
      // Der Sprung ins Admin-Formular waere dort nur verwirrend.
      (options.hideEdit ? '' : '<button class="admin-mini-btn" type="button" onclick="kbAdminEdit(\'' + entry.id + '\')">Bearbeiten</button>') +
      (entry.status === 'draft' ? '<button class="admin-mini-btn" type="button" onclick="publishRemoteEntry(\'' + entry.id + '\')">Freigeben</button>' : '') +
      '<button class="admin-mini-btn delete" type="button" onclick="kbAdminDelete(\'' + entry.id + '\')">Löschen</button>' +
    '</span>';
  }
  var date = remoteEntryDate(entry);
  var richContent = isNotebookEntry(entry) || kbEntryHasPlacedImages(entry);
  var inlineAttachmentIds = richContent ? notebookInlineAttachmentIds(entry) : null;
  var contentHtml = richContent ? notebookStoredContentHtml(entry) : zcEsc(entry.content);
  var imageEditable = !!(currentProfile && currentProfile.role === 'admin');
  return '<article class="admin-feature kb-card">' +
    '<div class="admin-feature-head"><span class="admin-badge">' + zcEsc(entry.category) + '</span>' + remoteEntryStatus(entry) + aiBadge + actions + '</div>' +
    '<div class="kb-card-body">' +
      '<div class="kb-card-title">' + zcEsc(entry.title) + '</div>' +
      (date ? '<div class="kb-card-meta">' + (entry.status === 'draft' ? 'Eingereicht ' : 'Aktualisiert ') + zcEsc(date) + '</div>' : '') +
      (entry.command && !isNotebookEntry(entry) ? '<div class="admin-feature-notes">Befehl: ' + zcEsc(entry.command) + '</div>' : '') +
      '<div class="' + (richContent ? 'notebook-rendered-content' : 'admin-feature-notes') + '"' + (richContent ? '' : ' style="white-space:pre-wrap"') + '>' + contentHtml + '</div>' +
      remoteImageGalleryHtml(entry, options.editable, inlineAttachmentIds, imageEditable) +
      remoteAttachmentHtml(entry, options.editable) +
    '</div>' +
  '</article>';
}

async function hydrateRemoteImagePreviews(entries) {
  var images = [];
  entries.forEach(function(entry) {
    (entry.knowledge_attachments || []).forEach(function(file) {
      if (remoteImageAttachment(file)) images.push(file);
    });
  });
  await Promise.all(images.map(async function(file) {
    try {
      var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(file.storage_path, 900);
      if (!signed.error && signed.data) file.preview_url = signed.data.signedUrl;
    } catch (error) {
      console.warn('Bildvorschau konnte nicht geladen werden.', error);
    }
  }));
}

async function loadRemoteKnowledge() {
  if (!supabaseClient || !currentSession) return;
  var response = await supabaseClient.from('knowledge_entries')
    .select('id,category,title,command,content,status,submitted_by,created_at,updated_at,knowledge_attachments(id,storage_path,original_name,mime_type,size_bytes,content_sha256,knowledge_pdf_edits(base_storage_path,annotations,updated_at))')
    .order('updated_at', { ascending: false });
  if (response.error) {
    console.warn(response.error.message);
    return;
  }
  remoteKnowledgeEntries = response.data || [];
  await hydrateRemoteImagePreviews(remoteKnowledgeEntries);
  kbAdminRender();
  kbLibraryRender();
  kbRenderSearch();
  renderTechDrafts();
  if (typeof notebookRender === 'function') notebookRender();
}

async function uploadRemoteAttachments(entryId, files) {
  var preparedPdfs = await kbPreparePdfFiles(Array.from(files).filter(kbIsPdfFile), kbRemotePdfReferences());
  var uploadedAttachments = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (!attachmentTypeAllowed(file)) throw new Error('Nur JPG, PNG, WebP und PDF können hochgeladen werden.');
    if (file.size > REMOTE_ATTACHMENT_MAX_SIZE) throw new Error('„' + file.name + '“ ist größer als 25 MB.');
    var isPdf = kbIsPdfFile(file);
    var resolvedMimeType = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');
    var preparedPdf = isPdf ? preparedPdfs.find(function(item) { return item.file === file; }) : null;
    var contentSha256 = preparedPdf ? preparedPdf.contentSha256 : null;
    var cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = currentSession.user.id + '/' + entryId + '/' + crypto.randomUUID() + '-' + cleanName;
    var upload = await supabaseClient.storage.from('knowledge-files').upload(path, file, { contentType: resolvedMimeType, upsert: false });
    if (upload.error) throw upload.error;
    var metadata = await supabaseClient.from('knowledge_attachments').insert({
      entry_id: entryId, storage_path: path, original_name: file.name, mime_type: resolvedMimeType, size_bytes: file.size, content_sha256: contentSha256, uploaded_by: currentSession.user.id
    }).select('id,original_name,mime_type').single();
    if (metadata.error) {
      await supabaseClient.storage.from('knowledge-files').remove([path]);
      if (metadata.error.code === '23505') throw new Error('„' + file.name + '“ ist bereits in der Wissensdatenbank hinterlegt.');
      throw metadata.error;
    }
    uploadedAttachments.push({ attachment: metadata.data, file: file, isPdf: isPdf });
  }
  return uploadedAttachments;
}

// Reiner Text wird zu Zeilen-Elementen. Sobald eine Datei im Inhalt steht, liest
// ihn das Notizbuch als HTML -- ohne diesen Schritt gingen die Zeilenumbrueche
// verloren.
function kbContentAsRichHtml(content) {
  var text = String(content || '');
  if (/<(div|p|img|br|b|i|u|s|span|ul|ol|h3|h4)[\s>/]/i.test(text)) return text;
  if (!text) return '';
  return text.split(/\r?\n/).map(function(line) {
    return '<div>' + (line.trim() ? zcEsc(line) : '<br>') + '</div>';
  }).join('');
}

// Hochgeladene Dateien gehoeren in den Text und nicht nur an den Eintrag: erst
// dort lassen sie sich verschieben, in der Groesse aendern und per Doppelklick
// oeffnen. Die Platzierung entsteht nach dem Upload, weil sie die Kennung des
// fertigen Anhangs braucht.
function kbPlacementMarkup(uploadedAttachments, startY, startIndex) {
  return uploadedAttachments.map(function(uploaded, index) {
    if (!uploaded || !uploaded.attachment) return '';
    var attribute = uploaded.isPdf ? 'data-notebook-pdf-id' : 'data-notebook-image-id';
    // Untereinander mit Abstand: die Vorgabe im Stylesheet laesst 260 px Hoehe zu.
    var y = startY + (startIndex + index) * 280;
    return '<img ' + attribute + '="' + uploaded.attachment.id + '"' +
      ' alt="' + zcEsc(uploaded.attachment.original_name || '') + '"' +
      ' data-notebook-x="16" data-notebook-y="' + y + '">';
  }).join('');
}

async function kbPlaceUploadsInContent(entryId, content, uploadedAttachments) {
  var placeable = (uploadedAttachments || []).filter(function(uploaded) { return uploaded && uploaded.attachment; });
  if (!placeable.length) return '';
  var rich = kbContentAsRichHtml(content);
  var alreadyPlaced = (rich.match(/data-notebook-(image|pdf)-id/g) || []).length;
  var textLines = String(content || '').split(/\r?\n/).length;
  var next = rich + kbPlacementMarkup(placeable, 12 + textLines * 20, alreadyPlaced);
  // Das Inhaltsfeld fasst 3000 Zeichen. Passt die Platzierung nicht mehr hinein,
  // bleibt die Datei als Anhang erhalten, statt das Speichern scheitern zu lassen.
  if (next.length > 3000) return 'zu lang';
  var update = await supabaseClient.from('knowledge_entries').update({ content: next }).eq('id', entryId);
  return update.error ? update.error.message : '';
}

async function kbStorePdfSearchChunks(entryId, attachment, chunks) {
  var remove = await supabaseClient.from('knowledge_document_chunks').delete().eq('attachment_id', attachment.id);
  if (remove.error) throw remove.error;
  for (var offset = 0; offset < chunks.length; offset += 50) {
    var batch = chunks.slice(offset, offset + 50).map(function(chunk) {
      return {
        attachment_id: attachment.id,
        entry_id: entryId,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        content: chunk.content
      };
    });
    var stored = await supabaseClient.from('knowledge_document_chunks').insert(batch);
    if (stored.error) throw stored.error;
  }
  return chunks.length;
}

async function kbIndexPdfForSearch(entryId, attachment, file) {
  kbSetPdfTemplateHint('PDF wird für die KI-Suche aufbereitet …');
  var chunks = await kbExtractPdfSearchChunks(file);
  await kbStorePdfSearchChunks(entryId, attachment, chunks);
  var indexed = await supabaseClient.functions.invoke('knowledge-ai', { body: { action: 'index_document', attachment_id: attachment.id } });
  if (indexed.error) throw indexed.error;
  if (indexed.data && indexed.data.error) throw new Error(indexed.data.error);
  return (indexed.data && indexed.data.document_chunks_indexed) || chunks.length;
}

async function kbStoreOrIndexRemotePdf(entry, attachment, file) {
  if (entry.status === 'published') return kbIndexPdfForSearch(entry.id, attachment, file);
  var chunks = await kbExtractPdfSearchChunks(file);
  return kbStorePdfSearchChunks(entry.id, attachment, chunks);
}

function kbRemoteAttachmentStoragePaths(attachment) {
  var layer = kbPdfEditorStoredLayer(attachment);
  return [attachment && attachment.storage_path, layer && layer.base_storage_path].filter(function(path, index, values) {
    return !!path && values.indexOf(path) === index;
  });
}

async function kbReplaceRemotePdf(entry, attachmentId, file) {
  var previous = (entry.knowledge_attachments || []).find(function(attachment) { return attachment.id === attachmentId; });
  if (!previous || previous.mime_type !== 'application/pdf') throw new Error('Die zu ersetzende PDF wurde nicht gefunden.');

  var uploadedAttachments = await uploadRemoteAttachments(entry.id, [file]);
  var uploaded = uploadedAttachments[0];
  if (!uploaded || !uploaded.isPdf) throw new Error('Die neue PDF konnte nicht gespeichert werden.');
  var chunkCount = await kbStoreOrIndexRemotePdf(entry, uploaded.attachment, uploaded.file);

  var storageDelete = await supabaseClient.storage.from('knowledge-files').remove(kbRemoteAttachmentStoragePaths(previous));
  if (storageDelete.error) throw storageDelete.error;
  var metadataDelete = await supabaseClient.from('knowledge_attachments').delete().eq('id', previous.id);
  if (metadataDelete.error) throw metadataDelete.error;
  return chunkCount;
}

async function kbSaveEditablePdf(entry, attachment, file, baseStoragePath, annotations) {
  if (!attachment || attachment.mime_type !== 'application/pdf') throw new Error('Die zu bearbeitende PDF wurde nicht gefunden.');
  var prepared = await kbPreparePdfFiles([file], kbRemotePdfReferences(attachment.id));
  var cleanName = attachment.original_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var newPath = currentSession.user.id + '/' + entry.id + '/' + crypto.randomUUID() + '-editor-' + cleanName;
  var upload = await supabaseClient.storage.from('knowledge-files').upload(newPath, file, { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw upload.error;

  var savedAnnotations = kbPdfEditorStoredAnnotationsForSave(annotations);
  var layer = await supabaseClient.from('knowledge_pdf_edits').upsert({
    attachment_id: attachment.id,
    base_storage_path: baseStoragePath || attachment.storage_path,
    annotations: savedAnnotations,
    updated_by: currentSession.user.id
  }, { onConflict: 'attachment_id' });
  if (layer.error) {
    await supabaseClient.storage.from('knowledge-files').remove([newPath]);
    throw layer.error;
  }

  var updated = await supabaseClient.from('knowledge_attachments').update({
    storage_path: newPath,
    original_name: attachment.original_name,
    mime_type: 'application/pdf',
    size_bytes: file.size,
    content_sha256: prepared[0].contentSha256
  }).eq('id', attachment.id).select('id,storage_path,original_name,mime_type,size_bytes,content_sha256').single();
  if (updated.error) {
    await supabaseClient.storage.from('knowledge-files').remove([newPath]);
    throw updated.error;
  }

  var chunkCount = await kbStoreOrIndexRemotePdf(entry, updated.data, file);
  if (attachment.storage_path !== (baseStoragePath || attachment.storage_path)) {
    var removePrevious = await supabaseClient.storage.from('knowledge-files').remove([attachment.storage_path]);
    if (removePrevious.error) console.warn('Vorherige gerenderte PDF konnte nicht entfernt werden.', removePrevious.error);
  }
  return chunkCount;
}

async function kbSaveEditableImage(entry, attachment, file, baseStoragePath, annotations) {
  if (!attachment || !remoteImageAttachment(attachment)) throw new Error('Das zu bearbeitende Bild wurde nicht gefunden.');
  if (!file || !remoteImageAttachment({ mime_type: file.type })) throw new Error('Das bearbeitete Bild hat kein unterstütztes Format.');
  if (file.size > REMOTE_ATTACHMENT_MAX_SIZE) throw new Error('Das bearbeitete Bild ist größer als 25 MB.');

  var cleanName = String(file.name || attachment.original_name || 'bild').replace(/[^a-zA-Z0-9._-]/g, '_');
  var newPath = currentSession.user.id + '/' + entry.id + '/' + crypto.randomUUID() + '-editor-' + cleanName;
  var upload = await supabaseClient.storage.from('knowledge-files').upload(newPath, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;

  var savedAnnotations = kbPdfEditorStoredAnnotationsForSave(annotations);
  var layer = await supabaseClient.from('knowledge_pdf_edits').upsert({
    attachment_id: attachment.id,
    base_storage_path: baseStoragePath || attachment.storage_path,
    annotations: savedAnnotations,
    updated_by: currentSession.user.id
  }, { onConflict: 'attachment_id' });
  if (layer.error) {
    await supabaseClient.storage.from('knowledge-files').remove([newPath]);
    throw layer.error;
  }

  var contentSha256 = await kbPdfSha256(file);
  var updated = await supabaseClient.from('knowledge_attachments').update({
    storage_path: newPath,
    original_name: file.name || attachment.original_name,
    mime_type: file.type,
    size_bytes: file.size,
    content_sha256: contentSha256
  }).eq('id', attachment.id).select('id,storage_path,original_name,mime_type,size_bytes,content_sha256').single();
  if (updated.error) {
    await supabaseClient.storage.from('knowledge-files').remove([newPath]);
    throw updated.error;
  }

  if (attachment.storage_path !== (baseStoragePath || attachment.storage_path)) {
    var removePrevious = await supabaseClient.storage.from('knowledge-files').remove([attachment.storage_path]);
    if (removePrevious.error) console.warn('Vorheriges bearbeitetes Bild konnte nicht entfernt werden.', removePrevious.error);
  }
  return updated.data;
}

function kbImportTitleFromPdfFilename(filename) {
  var title = String(filename || '')
    .replace(/\.pdf$/i, '')
    .replace(/^\s*\d+(?:\s*[-–]\s*\d+)?\s+/, '')
    .replace(/\s*[-–]\s*$/, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (title || 'Unbenannter Anschlussplan').slice(0, 160);
}

function kbSetAdminHtmlImportStatus(message, type) {
  var status = document.getElementById('kb-admin-html-import-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'pdf-template-hint' + (type ? ' ' + type : '');
}

function kbHtmlImportNormalizePath(path) {
  var raw = String(path || '').trim().replace(/\\/g, '/').replace(/[?#].*$/, '');
  try { raw = decodeURIComponent(raw); } catch (ignored) {}
  var parts = [];
  raw.split('/').forEach(function(part) {
    if (!part || part === '.') return;
    if (part === '..') { parts.pop(); return; }
    parts.push(part);
  });
  return parts.join('/');
}

function kbHtmlImportDirname(path) {
  var normalized = kbHtmlImportNormalizePath(path);
  var position = normalized.lastIndexOf('/');
  return position < 0 ? '' : normalized.slice(0, position);
}

function kbHtmlImportJoinPath(base, relative) {
  return kbHtmlImportNormalizePath((base ? base + '/' : '') + String(relative || ''));
}

function kbHtmlImportIsExternalReference(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(reference || '').trim());
}

function kbHtmlImportPackageTitle(file) {
  var title = String(file && file.name || '')
    .replace(/\.html?$/i, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (title || 'Unbenannte Web-Anleitung').slice(0, 160);
}

function kbHtmlImportFilePath(file) {
  return kbHtmlImportNormalizePath(file && (file.webkitRelativePath || file.name));
}

function kbHtmlImportFindPackage(files) {
  var htmlFiles = files.filter(function(file) { return /\.html?$/i.test(file.name || ''); });
  var candidates = htmlFiles.map(function(htmlFile) {
    var htmlPath = kbHtmlImportFilePath(htmlFile);
    var parentPath = kbHtmlImportDirname(htmlPath);
    var expectedDirectory = kbHtmlImportJoinPath(parentPath, String(htmlFile.name || '').replace(/\.html?$/i, '') + '_files');
    var assets = files.filter(function(file) {
      var path = kbHtmlImportFilePath(file).toLowerCase();
      return path.indexOf(expectedDirectory.toLowerCase() + '/') === 0;
    });
    return { htmlFile: htmlFile, htmlPath: htmlPath, sourceDirectory: parentPath, resourceDirectory: expectedDirectory, assets: assets };
  }).filter(function(candidate) { return candidate.assets.length > 0; });

  if (!candidates.length) throw new Error('Keine passende Kombination aus .htm-Datei und _files-Ordner gefunden.');
  if (candidates.length > 1) throw new Error('Mehrere Web-Anleitungen gefunden. Wähle bitte einen Ordner mit genau einer .htm-Datei und dem passenden _files-Ordner.');
  return candidates[0];
}

function kbHtmlImportBuildAssetMap(files) {
  var exact = {};
  var basename = {};
  var urls = new Map();
  var dataUrls = new Map();
  files.forEach(function(file) {
    var fullPath = kbHtmlImportFilePath(file);
    if (!fullPath) return;
    var segments = fullPath.split('/');
    for (var index = 0; index < segments.length; index++) {
      var suffix = segments.slice(index).join('/').toLowerCase();
      if (!exact[suffix]) exact[suffix] = file;
    }
    var name = String(file.name || '').toLowerCase();
    if (!basename[name]) basename[name] = file;
    else if (basename[name] !== file) basename[name] = null;
  });
  return { exact: exact, basename: basename, urls: urls, dataUrls: dataUrls };
}

function kbHtmlImportResolveAsset(reference, assetMap, basePath) {
  var raw = String(reference || '').trim();
  if (!raw || kbHtmlImportIsExternalReference(raw)) return null;
  var normalized = kbHtmlImportNormalizePath(raw).toLowerCase();
  var candidates = [normalized, kbHtmlImportJoinPath(basePath, raw).toLowerCase()];
  for (var index = 0; index < candidates.length; index++) {
    if (assetMap.exact[candidates[index]]) return assetMap.exact[candidates[index]];
  }
  var filename = normalized.split('/').pop();
  return assetMap.basename[filename] || null;
}

function kbHtmlImportAssetUrl(file, assetMap) {
  if (!file) return '';
  if (!assetMap.urls.has(file)) assetMap.urls.set(file, URL.createObjectURL(file));
  return assetMap.urls.get(file);
}

function kbHtmlImportAssetDataUrl(file, assetMap) {
  if (!file) return Promise.resolve('');
  if (assetMap.dataUrls.has(file)) return assetMap.dataUrls.get(file);
  var readerPromise = new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || '')); };
    reader.onerror = function() { reject(new Error('Ein Bild der Web-Anleitung konnte nicht eingebettet werden.')); };
    reader.readAsDataURL(file);
  });
  assetMap.dataUrls.set(file, readerPromise);
  return readerPromise;
}

function kbHtmlImportRewriteCss(css, assetMap, basePath) {
  return String(css || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function(match, quote, reference) {
    var file = kbHtmlImportResolveAsset(reference, assetMap, basePath);
    return file ? 'url("' + kbHtmlImportAssetUrl(file, assetMap) + '")' : match;
  });
}

function kbHtmlImportRewriteSrcset(srcset, assetMap, basePath) {
  return String(srcset || '').split(',').map(function(candidate) {
    var trimmed = candidate.trim();
    if (!trimmed) return '';
    var parts = trimmed.split(/\s+/);
    var file = kbHtmlImportResolveAsset(parts[0], assetMap, basePath);
    if (file) parts[0] = kbHtmlImportAssetUrl(file, assetMap);
    return parts.join(' ');
  }).join(', ');
}

async function kbHtmlImportCleanMarkup(root, assetMap, basePath, unresolved) {
  root.querySelectorAll('script,noscript,iframe,object,embed,form,button,input,select,textarea').forEach(function(element) { element.remove(); });
  var elements = Array.prototype.slice.call(root.querySelectorAll('*'));
  for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
    var element = elements[elementIndex];
    Array.prototype.slice.call(element.attributes || []).forEach(function(attribute) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    });
    var sourceAttributes = ['src', 'data-src', 'poster'];
    for (var attributeIndex = 0; attributeIndex < sourceAttributes.length; attributeIndex++) {
      var attributeName = sourceAttributes[attributeIndex];
      var reference = element.getAttribute(attributeName);
      if (!reference) continue;
      var file = kbHtmlImportResolveAsset(reference, assetMap, basePath);
      if (file) {
        // img-Elemente bekommen eingebettete Daten statt Blob-URLs. Dadurch
        // werden große Bilder beim html2canvas-Export zuverlässig gezeichnet.
        if (attributeName === 'src' && element.tagName === 'IMG') {
          element.setAttribute(attributeName, await kbHtmlImportAssetDataUrl(file, assetMap));
        } else {
          element.setAttribute(attributeName, kbHtmlImportAssetUrl(file, assetMap));
        }
      }
      else if (!kbHtmlImportIsExternalReference(reference) && /^(IMG|SOURCE|VIDEO)$/i.test(element.tagName)) unresolved.push(reference);
    }
    if (element.hasAttribute('srcset')) element.setAttribute('srcset', kbHtmlImportRewriteSrcset(element.getAttribute('srcset'), assetMap, basePath));
    if (element.hasAttribute('style')) element.setAttribute('style', kbHtmlImportRewriteCss(element.getAttribute('style'), assetMap, basePath));
    if (element.tagName === 'A') element.removeAttribute('href');
  }
}

function kbHtmlImportSimplifyCarGalleries(root) {
  var galleries = Array.prototype.slice.call(root.querySelectorAll('.car-images-wrapper'));
  galleries.forEach(function(gallery) {
    var pictures = Array.prototype.slice.call(gallery.querySelectorAll('.car-img-wrapper img'));
    if (!pictures.length) return;
    // Die Original-Galerie verwendet für große Fahrzeugbilder einen schwarzen
    // Container. Diese spezielle Kombination wird von html2canvas nicht
    // zuverlässig übernommen. Als neutrale Export-Galerie bleiben die exakt
    // gleichen Bilder erhalten, aber ohne die interaktive Website-Hülle.
    var replacement = root.ownerDocument.createElement('div');
    replacement.className = 'kb-html-import-gallery';
    pictures.forEach(function(picture) {
      var item = root.ownerDocument.createElement('div');
      var image = picture.cloneNode(true);
      image.removeAttribute('style');
      item.appendChild(image);
      replacement.appendChild(item);
    });
    gallery.replaceWith(replacement);
  });
}

async function kbHtmlImportBuildDocument(packageInfo) {
  var sourceText = await packageInfo.htmlFile.text();
  var source = new DOMParser().parseFromString(sourceText, 'text/html');
  var assetMap = kbHtmlImportBuildAssetMap(packageInfo.assets);
  var unresolved = [];
  var styleTexts = [];
  var stylesheetLinks = Array.prototype.slice.call(source.querySelectorAll('link[rel~="stylesheet"][href]'));

  for (var linkIndex = 0; linkIndex < stylesheetLinks.length; linkIndex++) {
    var link = stylesheetLinks[linkIndex];
    var stylesheet = kbHtmlImportResolveAsset(link.getAttribute('href'), assetMap, packageInfo.sourceDirectory);
    if (!stylesheet) continue;
    try {
      styleTexts.push(kbHtmlImportRewriteCss(await stylesheet.text(), assetMap, kbHtmlImportDirname(kbHtmlImportFilePath(stylesheet))));
    } catch (error) {
      console.warn('Stylesheet konnte nicht eingebettet werden.', error);
    }
  }
  source.querySelectorAll('style').forEach(function(style) {
    styleTexts.push(kbHtmlImportRewriteCss(style.textContent, assetMap, packageInfo.sourceDirectory));
  });

  var main = source.querySelector('#maincontent') || source.querySelector('main') || source.body;
  var content = main.cloneNode(true);
  await kbHtmlImportCleanMarkup(content, assetMap, packageInfo.sourceDirectory, unresolved);
  kbHtmlImportSimplifyCarGalleries(content);
  var detectedTitle = String(source.title || '').replace(/\s+/g, ' ').trim();
  if (!detectedTitle || detectedTitle.length > 160) {
    var heading = content.querySelector('h1, h2');
    detectedTitle = heading ? String(heading.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }
  var title = (detectedTitle || kbHtmlImportPackageTitle(packageInfo.htmlFile)).slice(0, 160);
  var cleanup = function() {
    assetMap.urls.forEach(function(url) { URL.revokeObjectURL(url); });
  };
  var exportStyle = [
    'html,body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;overflow:visible!important;background:#fff!important;color:#111!important}',
    '#webber-mobile-menu-background-wrapper,#mobile-menu-wrapper,#header-three-blocks-wrapper,#largeImgWrapper,.grecaptcha-badge,.modal-popup,.page-footer,.page-header .panel.wrapper,.page-header .panel.header{display:none!important}',
    '.page-wrapper,.page-main,.columns,.column.main,#maincontent,main{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;float:none!important}',
    'a{color:inherit!important;text-decoration:none!important}',
    'img{max-width:100%!important;height:auto!important}',
    '.kb-html-import-gallery{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;margin:0 0 24px!important;padding:0!important;background:#fff!important;overflow:visible!important}.kb-html-import-gallery>div{display:block!important;min-width:0!important;background:#fff!important}.kb-html-import-gallery img{display:block!important;width:100%!important;height:auto!important;max-width:100%!important;max-height:none!important;margin:0!important;object-fit:contain!important;opacity:1!important;visibility:visible!important;background:#fff!important}',
    '@media print{*{display:initial}.page-footer,.page-header{display:none!important}}'
  ].join('');
  return {
    title: title,
    html: '<!doctype html><html><head><meta charset="utf-8"><style>' + styleTexts.join('\n') + '</style><style>' + exportStyle + '</style></head><body class="' + zcEsc(source.body.className || '') + '">' + content.outerHTML + '</body></html>',
    searchText: String(content.textContent || '').replace(/\s+/g, ' ').trim(),
    unresolved: unresolved,
    cleanup: cleanup
  };
}

function kbHtmlImportWaitForFrame(frame) {
  return new Promise(function(resolve, reject) {
    var timeout = window.setTimeout(function() { reject(new Error('Die Web-Anleitung konnte nicht geladen werden.')); }, 25000);
    frame.onload = function() { window.clearTimeout(timeout); resolve(); };
  });
}

async function kbHtmlImportWaitForImages(documentInFrame) {
  var images = Array.prototype.slice.call(documentInFrame.images || []);
  await Promise.all(images.map(function(image) {
    // Große Fahrzeugbilder können bereits als „complete“ gelten, obwohl sie
    // noch nicht fertig dekodiert sind. html2canvas würde sie dann schwarz
    // übernehmen. decode() wartet auf die tatsächlich zeichnungsbereite Fläche.
    if (typeof image.decode === 'function') {
      return image.decode().catch(function() {
        return new Promise(function(resolve) {
          if (image.complete) { resolve(); return; }
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      });
    }
    if (image.complete && image.naturalWidth) return Promise.resolve();
    return new Promise(function(resolve) {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
}

function kbHtmlImportFileName(title) {
  var normalized = String(title || 'Web-Anleitung').replace(/[^a-zA-Z0-9äöüÄÖÜß._ -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return (normalized || 'Web-Anleitung').slice(0, 120) + '.pdf';
}

function kbHtmlImportSearchChunks(text, pageCount) {
  var chunks = kbSplitPdfText(text);
  if (!chunks.length) return [];
  return chunks.map(function(content, index) {
    return {
      page_number: Math.min(Math.max(1, pageCount || 1), Math.floor(index * Math.max(1, pageCount || 1) / chunks.length) + 1),
      chunk_index: index,
      content: content
    };
  });
}

async function kbHtmlImportCreatePdf(packageInfo, onProgress) {
  if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) throw new Error('Der PDF-Konverter wurde nicht geladen. Bitte prüfe deine Internetverbindung und lade die Seite neu.');
  var prepared = await kbHtmlImportBuildDocument(packageInfo);
  var frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:1200px;border:0;pointer-events:none;';
  var frameLoaded = kbHtmlImportWaitForFrame(frame);
  frame.srcdoc = prepared.html;
  document.body.appendChild(frame);
  try {
    if (onProgress) onProgress('Anleitung und Bilder werden vollständig geladen …');
    await frameLoaded;
    var frameDocument = frame.contentDocument;
    await kbHtmlImportWaitForImages(frameDocument);
    await new Promise(function(resolve) { window.setTimeout(resolve, 700); });
    var target = frameDocument.querySelector('#maincontent') || frameDocument.querySelector('main') || frameDocument.body;
    var cssWidth = Math.max(target.scrollWidth, target.offsetWidth, 900);
    var cssHeight = Math.max(target.scrollHeight, target.offsetHeight, 1);
    if (cssHeight > 30000) throw new Error('Die Web-Anleitung ist zu lang für den Browser-Import. Bitte teile sie zuerst auf.');
    if (onProgress) onProgress('Komplette Seite wird als PDF aufgebaut …');
    var canvas = await window.html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 1,
      useCORS: false,
      allowTaint: false,
      logging: false,
      width: cssWidth,
      height: cssHeight,
      windowWidth: cssWidth,
      windowHeight: cssHeight,
      scrollX: 0,
      scrollY: 0
    });
    var pageWidthMm = 210;
    var pageHeightMm = 297;
    var marginMm = 8;
    var printableWidthMm = pageWidthMm - (marginMm * 2);
    var printableHeightMm = pageHeightMm - (marginMm * 2);
    var pageHeightPx = Math.max(1, Math.floor(canvas.width * printableHeightMm / printableWidthMm));
    var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    var pages = 0;
    for (var sourceY = 0; sourceY < canvas.height; sourceY += pageHeightPx) {
      var sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
      if (pages) pdf.addPage('a4', 'portrait');
      var slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      var context = slice.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, slice.width, sliceHeight);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', marginMm, marginMm, printableWidthMm, printableWidthMm * sliceHeight / slice.width, undefined, 'FAST');
      pages += 1;
      if (onProgress) onProgress('PDF-Seite ' + pages + ' wird erstellt …');
    }
    var blob = pdf.output('blob');
    return { file: new File([blob], kbHtmlImportFileName(prepared.title), { type: 'application/pdf', lastModified: Date.now() }), title: prepared.title, pages: pages, chunks: kbHtmlImportSearchChunks(prepared.searchText, pages), unresolved: prepared.unresolved };
  } finally {
    frame.remove();
    prepared.cleanup();
  }
}

function kbAdminSelectHtmlPackage() {
  var input = document.getElementById('kb-admin-import-html-folder');
  var submit = document.getElementById('kb-admin-html-import-submit');
  kbAdminHtmlImportPackage = null;
  if (submit) submit.disabled = true;
  var files = Array.prototype.slice.call(input && input.files || []);
  if (!files.length) {
    kbSetAdminHtmlImportStatus('', '');
    return;
  }
  try {
    kbAdminHtmlImportPackage = kbHtmlImportFindPackage(files);
    if (submit) submit.disabled = false;
    kbSetAdminHtmlImportStatus('Erkannt: „' + kbHtmlImportPackageTitle(kbAdminHtmlImportPackage.htmlFile) + '“ mit ' + kbAdminHtmlImportPackage.assets.length + ' zugehörigen Dateien. Bereit zum Import.', 'success');
  } catch (error) {
    kbSetAdminHtmlImportStatus(error && error.message ? error.message : 'Der Ordner konnte nicht geprüft werden.', 'error');
  }
}

async function kbAdminImportHtmlPackage() {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return;
  var submit = document.getElementById('kb-admin-html-import-submit');
  var input = document.getElementById('kb-admin-import-html-folder');
  var packageInfo = kbAdminHtmlImportPackage;
  if (!packageInfo) {
    kbSetAdminHtmlImportStatus('Bitte wähle zuerst einen Ordner mit der HTML-Datei und dem passenden _files-Ordner.', 'error');
    return;
  }
  submit.disabled = true;
  try {
    var converted = await kbHtmlImportCreatePdf(packageInfo, function(message) { kbSetAdminHtmlImportStatus(message); });
    if (converted.file.size > REMOTE_ATTACHMENT_MAX_SIZE) throw new Error('Die erzeugte PDF ist größer als 25 MB. Bitte teile die Anleitung auf.');
    var duplicate = kbRemoteEntryWithTitle(converted.title);
    if (duplicate) throw new Error(kbDuplicateTitleError(converted.title, duplicate));
    kbSetAdminHtmlImportStatus('PDF wird in der Wissensdatenbank gespeichert …');
    var created = await supabaseClient.from('knowledge_entries').insert({
      category: 'Anschlusspläne',
      title: converted.title,
      command: null,
      content: '',
      status: 'draft',
      submitted_by: currentSession.user.id
    }).select('id').single();
    if (created.error) throw created.error;
    var attachment;
    try {
      var uploads = await uploadRemoteAttachments(created.data.id, [converted.file]);
      attachment = uploads[0] && uploads[0].attachment;
      if (!attachment) throw new Error('Die erzeugte PDF konnte nicht gespeichert werden.');
    } catch (error) {
      await supabaseClient.from('knowledge_entries').delete().eq('id', created.data.id);
      throw error;
    }
    var chunkCount = 0;
    if (converted.chunks.length) chunkCount = await kbStorePdfSearchChunks(created.data.id, attachment, converted.chunks);
    await loadRemoteKnowledge();
    input.value = '';
    kbAdminHtmlImportPackage = null;
    kbSetAdminHtmlImportStatus('„' + converted.title + '“ wurde als Entwurf angelegt (' + converted.pages + ' PDF-Seiten, ' + chunkCount + ' Textabschnitte für die KI-Suche).' + (converted.unresolved.length ? ' Hinweis: ' + converted.unresolved.length + ' Medien-Datei(en) konnten nicht zugeordnet werden.' : ''), 'success');
  } catch (error) {
    kbSetAdminHtmlImportStatus(error && error.message ? error.message : 'Die Web-Anleitung konnte nicht importiert werden.', 'error');
  } finally {
    if (submit) submit.disabled = !kbAdminHtmlImportPackage;
  }
}

async function kbAdminImportPdfs() {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return;
  var input = document.getElementById('kb-admin-import-pdfs');
  var submit = document.getElementById('kb-admin-import-submit');
  var files = Array.from(input && input.files || []);
  if (!files.length) {
    kbSetAdminImportStatus('Bitte wähle mindestens eine PDF-Datei aus.', 'error');
    return;
  }
  var titleConflicts = kbAdminImportTitleConflicts(files);
  if (titleConflicts.length) {
    kbAdminRenderImportCorrections(titleConflicts);
    kbSetAdminImportStatus('Einige PDF-Titel sind doppelt. Bitte korrigiere sie vor dem Import.', 'error');
    return;
  }
  kbAdminRenderImportCorrections([]);
  try {
    await kbPreparePdfFiles(files, kbRemotePdfReferences());
  } catch (error) {
    kbSetAdminImportStatus(error && error.message ? error.message : 'Die PDF-Prüfung ist fehlgeschlagen.', 'error');
    return;
  }

  submit.disabled = true;
  var imported = 0;
  var storedChunks = 0;
  var failures = [];
  var importedTitles = {};
  try {
    for (var index = 0; index < files.length; index++) {
      var file = files[index];
      kbSetAdminImportStatus('PDF ' + (index + 1) + ' von ' + files.length + ' wird ausgelesen: „' + file.name + '“ …');
      try {
        var chunks = await kbExtractPdfSearchChunks(file);
        var manuallyCorrectedTitle = kbAdminImportTitleOverride(file, index);
        var title = manuallyCorrectedTitle || (await kbDetectTemplateVehicleTitle(file)) || kbImportTitleFromPdfFilename(file.name);
        var titleKey = kbNormalizeKnowledgeTitle(title);
        var existingEntry = kbRemoteEntryWithTitle(title);
        if (existingEntry) throw new Error(kbDuplicateTitleError(title, existingEntry));
        if (importedTitles[titleKey]) throw new Error('Der Titel „' + title + '“ wurde in diesem Import bereits verwendet.');
        var created = await supabaseClient.from('knowledge_entries').insert({
          category: 'Anschlusspläne',
          title: title,
          command: null,
          content: '',
          status: 'draft',
          submitted_by: currentSession.user.id
        }).select('id').single();
        if (created.error) throw created.error;

        var attachments = await uploadRemoteAttachments(created.data.id, [file]);
        if (!attachments.length || !attachments[0].isPdf) throw new Error('Die PDF konnte nicht als Anhang gespeichert werden.');
        storedChunks += await kbStorePdfSearchChunks(created.data.id, attachments[0].attachment, chunks);
        importedTitles[titleKey] = true;
        imported += 1;
      } catch (error) {
        failures.push('„' + file.name + '“: ' + (error && error.message ? error.message : 'Import fehlgeschlagen.'));
      }
    }
  } finally {
    submit.disabled = false;
  }

  input.value = '';
  kbAdminImportTitleOverrides = {};
  kbAdminRenderImportCorrections([]);
  await loadRemoteKnowledge();
  if (!failures.length) {
    kbSetAdminImportStatus(imported + ' PDF' + (imported === 1 ? '' : 's') + ' als Entwurf vorbereitet (' + storedChunks + ' Textabschnitte). Bitte in der Freigabe-Inbox prüfen.', 'success');
  } else {
    kbSetAdminImportStatus(imported + ' importiert, ' + failures.length + ' fehlgeschlagen. ' + failures.join(' '), 'error');
  }
}

async function submitTechnicianEntry() {
  var status = document.getElementById('tech-status');
  var payload = {
    category: document.getElementById('tech-category').value.trim(), title: document.getElementById('tech-title').value.trim(),
    command: document.getElementById('tech-command').value.trim() || null, content: document.getElementById('tech-content').value.trim(),
    status: 'draft', submitted_by: currentSession.user.id
  };
  if (!payload.category || !payload.title || !payload.content) return;
  status.textContent = 'Entwurf wird gespeichert …';
  var created = await supabaseClient.from('knowledge_entries').insert(payload).select().single();
  if (created.error) {
    status.textContent = created.error.code === '23505'
      ? 'Dieser Titel ist bereits in der Wissensdatenbank vorhanden.'
      : 'Fehler: ' + created.error.message;
    return;
  }
  var placementNote = '';
  try {
    var uploaded = await uploadRemoteAttachments(created.data.id, Array.from(document.getElementById('tech-files').files || []));
    placementNote = await kbPlaceUploadsInContent(created.data.id, payload.content, uploaded);
  } catch (err) {
    status.textContent = 'Entwurf gespeichert, Anhang fehlgeschlagen: ' + err.message;
    await loadRemoteKnowledge();
    return;
  }
  document.getElementById('tech-entry-form').reset();
  status.textContent = placementNote === 'zu lang'
    ? 'Entwurf wurde eingereicht. Die Datei hängt am Eintrag, im Text war kein Platz mehr (3.000 Zeichen).'
    : 'Entwurf wurde eingereicht und wartet auf Freigabe.';
  await loadRemoteKnowledge();
}

async function kbAdminSubmitRemote() {
  if (!currentProfile || currentProfile.role !== 'admin') return;
  var form = document.getElementById('kb-admin-form');
  var id = form.getAttribute('data-kb-id');
  var payload = {
    category: document.getElementById('kb-admin-category').value.trim(), title: document.getElementById('kb-admin-title').value.trim(),
    command: document.getElementById('kb-admin-command').value.trim() || null, content: document.getElementById('kb-admin-content').value.trim()
  };
  if (form.dataset.notebookEntry === 'true') payload.command = NOTEBOOK_ENTRY_MARKER;
  if (!payload.category || !payload.title) return;
  var duplicateTitle = kbRemoteEntryWithTitle(payload.title, id);
  if (duplicateTitle) {
    var duplicateTitleMessage = kbDuplicateTitleError(payload.title, duplicateTitle);
    kbSetPdfTemplateHint(duplicateTitleMessage, 'error');
    alert(duplicateTitleMessage);
    return;
  }
  var files = Array.from(document.getElementById('kb-admin-pdfs').files || []);
  var replacementInput = document.getElementById('kb-admin-replace-pdf');
  var replacementAttachmentId = replacementInput && replacementInput.dataset.attachmentId || '';
  var replacementFile = replacementInput && replacementInput.files && replacementInput.files[0];
  if (replacementFile && (!id || !replacementAttachmentId)) {
    kbSetPdfTemplateHint('Bitte wähle die zu ersetzende PDF erneut aus.', 'error');
    return;
  }
  try {
    await kbPreparePdfFiles(replacementFile ? files.concat([replacementFile]) : files, kbRemotePdfReferences(replacementAttachmentId || undefined));
  } catch (err) {
    kbSetPdfTemplateHint(err.message, 'error');
    alert('PDF konnte nicht gespeichert werden: ' + err.message);
    return;
  }
  var response;
  if (id) {
    response = await supabaseClient.from('knowledge_entries').update(payload).eq('id', id).select().maybeSingle();
    if (!response.error && !response.data) {
      form.removeAttribute('data-kb-id');
      kbSetAdminEditState(null);
      await loadRemoteKnowledge();
      var staleEntryMessage = 'Dieser Eintrag wurde bereits gelöscht oder ist nicht mehr verfügbar. Deine Eingaben bleiben im Formular erhalten – klicke nochmals auf „Wissen speichern“, um ihn neu anzulegen.';
      kbSetPdfTemplateHint(staleEntryMessage, 'error');
      alert(staleEntryMessage);
      return;
    }
  } else {
    payload.status = 'published';
    payload.submitted_by = currentSession.user.id;
    payload.reviewed_by = currentSession.user.id;
    payload.reviewed_at = new Date().toISOString();
    response = await supabaseClient.from('knowledge_entries').insert(payload).select().single();
  }
  if (response.error) {
    alert(response.error.code === '23505'
      ? 'Speichern nicht möglich: Dieser Titel ist bereits in der Wissensdatenbank vorhanden.'
      : 'Speichern fehlgeschlagen: ' + response.error.message);
    return;
  }
  try {
    var previousEntry = id && remoteKnowledgeEntries.find(function(entry) { return entry.id === id; });
    var entryForAttachments = Object.assign({}, previousEntry || {}, response.data);
    if (previousEntry) entryForAttachments.knowledge_attachments = previousEntry.knowledge_attachments || [];
    var uploadedAttachments = await uploadRemoteAttachments(response.data.id, files);
    var placementNote = await kbPlaceUploadsInContent(response.data.id, payload.content, uploadedAttachments);
    if (placementNote === 'zu lang') kbSetPdfTemplateHint('Die Datei hängt am Eintrag. Für die Platzierung im Text war kein Platz mehr (3.000 Zeichen).', 'error');
    var indexedChunks = 0;
    for (var attachmentIndex = 0; attachmentIndex < uploadedAttachments.length; attachmentIndex++) {
      var uploaded = uploadedAttachments[attachmentIndex];
      if (uploaded.isPdf) indexedChunks += await kbStoreOrIndexRemotePdf(entryForAttachments, uploaded.attachment, uploaded.file);
    }
    if (replacementFile) indexedChunks += await kbReplaceRemotePdf(entryForAttachments, replacementAttachmentId, replacementFile);
    if (indexedChunks) kbSetPdfTemplateHint(entryForAttachments.status === 'published'
      ? 'PDF für die KI-Suche indexiert: ' + indexedChunks + ' Textabschnitte.'
      : 'PDF für die spätere Freigabe vorbereitet: ' + indexedChunks + ' Textabschnitte.', 'success');
  } catch (err) {
    kbSetPdfTemplateHint('PDF wurde gespeichert, konnte aber nicht vollständig indexiert werden: ' + err.message, 'error');
    alert('Eintrag gespeichert, Anhang oder PDF-Index fehlgeschlagen: ' + err.message);
  }
  if (response.data.status === 'published' && !await indexRemoteKnowledgeEntry(response.data.id)) {
    alert('Eintrag gespeichert. Der KI-Suchindex konnte noch nicht aktualisiert werden. Bitte prüfe die KI-Konfiguration im Admin-Bereich.');
  }
  kbAdminResetForm();
  await loadRemoteKnowledge();
}

async function kbAdminEdit(id) {
  var entry = remoteKnowledgeEntries.find(function(item) { return item.id === id; });
  if (!entry) return;
  var form = document.getElementById('kb-admin-form');
  form.setAttribute('data-kb-id', entry.id);
  if (isNotebookEntry(entry)) form.dataset.notebookEntry = 'true';
  else delete form.dataset.notebookEntry;
  document.getElementById('kb-admin-category').value = entry.category;
  document.getElementById('kb-admin-title').value = entry.title;
  document.getElementById('kb-admin-command').value = isNotebookEntry(entry) ? '' : (entry.command || '');
  document.getElementById('kb-admin-content').value = entry.content;
  kbSetAdminEditState(entry);
  // Das Formular liegt im Unterreiter Freigaben & Upload. Aus der Bibliothek
  // heraus muss der Reiter darum mitwechseln, sonst scrollt es ins Verborgene.
  if (typeof showAdminSubview === 'function') showAdminSubview('freigaben');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('kb-admin-title').focus();
}

async function publishRemoteEntry(id) {
  var entry = remoteKnowledgeEntries.find(function(item) { return item.id === id; });
  if (!entry) return;
  var response = await supabaseClient.from('knowledge_entries').update({ status: 'published', reviewed_by: currentSession.user.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (response.error) { alert('Freigabe fehlgeschlagen: ' + response.error.message); return; }
  var entryIndexed = await indexRemoteKnowledgeEntry(id);
  var documentsIndexed = await indexRemoteKnowledgeDocuments(id);
  if (!entryIndexed || !documentsIndexed) {
    alert('Eintrag wurde freigegeben. Der KI-Suchindex konnte noch nicht aktualisiert werden. Bitte prüfe die KI-Konfiguration im Admin-Bereich.');
  }
  await loadRemoteKnowledge();
}

async function kbAdminDelete(id) {
  if (!confirm('Wissenseintrag wirklich löschen?')) return;
  var editingId = document.getElementById('kb-admin-form').getAttribute('data-kb-id');
  var entry = remoteKnowledgeEntries.find(function(item) { return item.id === id; });
  if (entry) {
    for (var i = 0; i < (entry.knowledge_attachments || []).length; i++) await supabaseClient.storage.from('knowledge-files').remove(kbRemoteAttachmentStoragePaths(entry.knowledge_attachments[i]));
  }
  var response = await supabaseClient.from('knowledge_entries').delete().eq('id', id);
  if (response.error) { alert('Löschen fehlgeschlagen: ' + response.error.message); return; }
  if (editingId === id) kbAdminResetForm();
  await loadRemoteKnowledge();
}

async function deleteRemoteAttachment(entryId, attachmentId) {
  var entry = remoteKnowledgeEntries.find(function(item) { return item.id === entryId; });
  var attachment = entry && (entry.knowledge_attachments || []).find(function(item) { return item.id === attachmentId; });
  if (!attachment || !confirm('Anhang wirklich entfernen?')) return;
  var editingId = document.getElementById('kb-admin-form').getAttribute('data-kb-id');
  await supabaseClient.storage.from('knowledge-files').remove(kbRemoteAttachmentStoragePaths(attachment));
  var response = await supabaseClient.from('knowledge_attachments').delete().eq('id', attachmentId);
  if (response.error) { alert('Anhang konnte nicht entfernt werden: ' + response.error.message); return; }
  await loadRemoteKnowledge();
  if (editingId === entryId) {
    var refreshedEntry = remoteKnowledgeEntries.find(function(item) { return item.id === entryId; });
    if (refreshedEntry) kbSetAdminEditState(refreshedEntry);
  }
}

function kbRemoteAttachmentById(id) {
  var attachment = null;
  (remoteKnowledgeEntries || []).some(function(entry) {
    attachment = (entry.knowledge_attachments || []).find(function(item) { return item.id === id; });
    return !!attachment;
  });
  return attachment || null;
}

function kbAttachmentPreviewable(file) {
  return !!file && (remoteImageAttachment(file) || file.mime_type === 'application/pdf');
}

// Die Schnellvorschau ist bewusst zugeklappt: erst der Klick laedt die Datei.
async function kbToggleAttachmentPreview(button, attachmentId) {
  var row = button.closest('.kb-attachment-row');
  var panel = row ? row.querySelector('.kb-preview') : null;
  if (!panel) return;
  if (!panel.hidden) {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Vorschau';
    return;
  }
  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.textContent = 'Vorschau schließen';
  if (panel.dataset.previewLoaded === '1') return;
  panel.innerHTML = '<div class="kb-preview-status">Vorschau wird geladen …</div>';
  try {
    await kbRenderAttachmentPreview(panel, attachmentId);
    panel.dataset.previewLoaded = '1';
  } catch (error) {
    panel.innerHTML = '<div class="kb-preview-status">Vorschau nicht möglich: ' + zcEsc(error && error.message ? error.message : 'Unbekannter Fehler') + '</div>';
  }
}

async function kbRenderAttachmentPreview(panel, attachmentId) {
  var attachment = kbRemoteAttachmentById(attachmentId);
  if (!attachment) throw new Error('Der Anhang wurde nicht gefunden.');
  var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(attachment.storage_path, 900);
  if (signed.error) throw signed.error;
  if (remoteImageAttachment(attachment)) {
    panel.innerHTML = '<img class="kb-preview-image" src="' + zcEsc(signed.data.signedUrl) + '" alt="Vorschau: ' + zcEsc(attachment.original_name) + '">';
    return;
  }
  if (attachment.mime_type !== 'application/pdf') throw new Error('Für diesen Dateityp gibt es keine Vorschau.');
  await kbRenderPdfPreview(panel, signed.data.signedUrl);
}

// Zeichnet die erste Seite auf ein Canvas. Genutzt von der Schnellvorschau und
// von platzierten PDFs im Notizbuch.
async function kbPdfFirstPageCanvas(bytes, targetWidth) {
  if (!window.pdfjsLib) throw new Error('Die PDF-Vorschau ist nicht verfügbar.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  var page = await pdf.getPage(1);
  var unscaled = page.getViewport({ scale: 1 });
  var viewport = page.getViewport({ scale: Math.min(Math.max(targetWidth || 0, 320) / unscaled.width, 2) });
  var canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  return { canvas: canvas, pageCount: pdf.numPages };
}

async function kbPdfBytesFromUrl(url) {
  var response = await fetch(url);
  if (!response.ok) throw new Error('Die PDF konnte nicht geladen werden.');
  return new Uint8Array(await response.arrayBuffer());
}

async function kbRenderPdfPreview(panel, url) {
  // Das Panel ist beim Aufklappen schon sichtbar, seine Breite gibt die Aufloesung vor.
  var rendered = await kbPdfFirstPageCanvas(await kbPdfBytesFromUrl(url), panel.clientWidth);
  rendered.canvas.className = 'kb-preview-canvas';
  panel.innerHTML = '';
  panel.appendChild(rendered.canvas);
  var hint = document.createElement('div');
  hint.className = 'kb-preview-status';
  hint.textContent = rendered.pageCount > 1 ? 'Seite 1 von ' + rendered.pageCount + ' — zum Blättern die PDF öffnen.' : 'Seite 1 von 1';
  panel.appendChild(hint);
}

// Vorschaubild einer abgelegten PDF, nach Anhang-Kennung gemerkt. Ohne den
// Zwischenspeicher laedt jede Neuzeichnung der Notiz die Datei erneut.
var kbPdfThumbnails = {};

async function kbPdfThumbnailUrl(attachmentId) {
  if (kbPdfThumbnails[attachmentId]) return kbPdfThumbnails[attachmentId];
  var attachment = kbRemoteAttachmentById(attachmentId);
  if (!attachment || attachment.mime_type !== 'application/pdf') return '';
  var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(attachment.storage_path, 300);
  if (signed.error) throw signed.error;
  var rendered = await kbPdfFirstPageCanvas(await kbPdfBytesFromUrl(signed.data.signedUrl), 480);
  kbPdfThumbnails[attachmentId] = rendered.canvas.toDataURL('image/png');
  return kbPdfThumbnails[attachmentId];
}

async function openRemoteAttachment(id, pageNumber) {
  var attachment = kbRemoteAttachmentById(id);
  if (!attachment) return;
  var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(attachment.storage_path, 60);
  if (signed.error) { alert('Anhang konnte nicht geöffnet werden: ' + signed.error.message); return; }
  window.open(signed.data.signedUrl + (pageNumber ? '#page=' + encodeURIComponent(pageNumber) : ''), '_blank');
}

async function downloadRemoteAttachment(id) {
  var attachment;
  remoteKnowledgeEntries.some(function(entry) { attachment = (entry.knowledge_attachments || []).find(function(item) { return item.id === id; }); return !!attachment; });
  if (!attachment) return;
  try {
    var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(attachment.storage_path, 60);
    if (signed.error) throw signed.error;
    var response = await fetch(signed.data.signedUrl);
    if (!response.ok) throw new Error('Die Datei konnte nicht geladen werden.');
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = attachment.original_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  } catch (error) {
    alert('Anhang konnte nicht heruntergeladen werden: ' + (error && error.message ? error.message : 'Unbekannter Fehler'));
  }
}

function kbAdminRender() {
  var list = document.getElementById('kb-admin-list');
  // Das Zaehler-Badge ist optional, die Liste wird auch ohne gezeichnet.
  var count = document.getElementById('kb-admin-count');
  if (!list) return;
  if (!currentProfile || currentProfile.role !== 'admin') { list.innerHTML = '<div class="zc-empty">Admin-Anmeldung erforderlich.</div>'; if (count) count.textContent = '0'; return; }
  var query = (document.getElementById('kb-admin-search').value || '').trim().toLowerCase();
  // Freigegebene Eintraege stehen im Unterreiter Bibliothek, hier nur die offenen.
  var drafts = remoteKnowledgeEntries.filter(function(entry) {
    return entry.status === 'draft' && remoteEntryMatches(entry, query);
  });
  if (count) count.textContent = remoteKnowledgeEntries.length;
  list.innerHTML =
    '<section class="kb-inbox">' +
      '<div class="kb-inbox-heading"><h3>Freigabe-Inbox</h3><span class="admin-badge kb-inbox-count">' + drafts.length + ' offen</span></div>' +
      (drafts.length ? drafts.map(function(entry) { return remoteEntryHtml(entry, { admin: true, editable: true }); }).join('') : '<div class="kb-inbox-empty">Keine Entwürfe warten auf Freigabe.</div>') +
    '</section>';
  notebookFitAllRenderedContent(list);
}

function kbLibraryEntryMatches(entry, query) {
  if (!query) return true;
  var attachmentNames = (entry.knowledge_attachments || []).map(function(file) { return file.original_name || ''; });
  return [entry.category, entry.title, entry.command, entry.content].concat(attachmentNames).join(' ').toLowerCase().indexOf(query) >= 0;
}

// Die Bibliothek im Adminbereich: nur freigegebene Eintraege, mit allen Wegen zum
// Bearbeiten in einer Zeile.
function kbLibraryEntryHtml(entry) {
  var attachments = entry.knowledge_attachments || [];
  var date = remoteEntryDate(entry);
  var meta = [entry.category, date, attachments.length ? attachments.length + ' Anhang' + (attachments.length === 1 ? '' : 'e') : '']
    .filter(Boolean).map(zcEsc).join(' · ');
  return '<details class="kb-library-entry">' +
    '<summary>' +
      '<span class="kb-library-entry-main">' +
        '<span class="kb-library-entry-title">' + zcEsc(entry.title) + '</span>' +
        '<span class="kb-library-entry-meta">' + meta + '</span>' +
      '</span>' +
      remoteEntryStatus(entry) +
    '</summary>' +
    '<div class="kb-library-entry-content">' +
      '<div class="kb-library-actions">' +
        '<button class="admin-btn primary" type="button" onclick="kbLibraryEditInline(\'' + entry.id + '\')">Text und Bilder bearbeiten</button>' +
        // Titel, Kategorie und vor allem das Feld Befehl gibt es nur im Formular.
        '<button class="admin-mini-btn" type="button" onclick="kbAdminEdit(\'' + entry.id + '\')">Im Formular bearbeiten</button>' +
        kbLibraryAttachmentButtons(attachments) +
      '</div>' +
      '<div class="kb-library-editor" data-entry-id="' + entry.id + '"></div>' +
      remoteEntryHtml(entry, { admin: true, editable: true, hideEdit: true }) +
    '</div>' +
  '</details>';
}

// Den Editor gibt es nur einmal im Dokument, samt fester Kennungen. Statt ihn ein
// zweites Mal zu bauen, wandert das Formular in den Bibliothek-Eintrag und
// spaeter an seinen Platz zurueck. So bleiben alle Notizbuch-Funktionen gueltig.
function kbLibraryNotebookAnchor() {
  var anchor = document.getElementById('notebook-form-anchor');
  if (anchor) return anchor;
  var form = document.getElementById('notebook-form');
  if (!form || !form.parentNode) return null;
  anchor = document.createElement('div');
  anchor.id = 'notebook-form-anchor';
  anchor.hidden = true;
  form.parentNode.insertBefore(anchor, form);
  return anchor;
}

// Merkt sich, dass gerade aus der Bibliothek heraus bearbeitet wird. Nach dem
// Speichern steht das Formular wieder im Notizbuch, seine Erfolgsmeldung waere
// hier sonst nicht zu sehen.
var kbLibraryInlineActive = false;

function kbLibraryMirrorStatus(message, type) {
  if (!kbLibraryInlineActive) return;
  var form = document.getElementById('notebook-form');
  // Steht das Formular noch im Eintrag, zeigt es seine Meldung selbst.
  if (form && form.classList.contains('notebook-editor-inline')) return;
  var target = document.getElementById('kb-library-status');
  if (!target) return;
  target.textContent = message || '';
  target.className = 'pdf-template-hint' + (type ? ' ' + type : '');
  if (type === 'success') kbLibraryInlineActive = false;
}

// Beendet die Bearbeitung endgueltig, etwa beim Verlassen der Ansicht.
function kbLibraryEndInlineEditing() {
  kbLibraryInlineActive = false;
  kbLibraryReleaseNotebookForm();
  var target = document.getElementById('kb-library-status');
  if (target) { target.textContent = ''; target.className = 'pdf-template-hint'; }
}

function kbLibraryEditInline(id) {
  if (!currentProfile || currentProfile.role !== 'admin') return;
  var entry = (remoteKnowledgeEntries || []).find(function(item) { return item.id === id; });
  var mount = document.querySelector('.kb-library-editor[data-entry-id="' + id + '"]');
  var form = document.getElementById('notebook-form');
  if (!entry || !mount || !form || typeof notebookLoadIntoEditor !== 'function') return;
  if (!kbLibraryNotebookAnchor()) return;
  notebookLoadIntoEditor(entry, { keepView: true });
  form.classList.add('notebook-editor-inline');
  mount.appendChild(form);
  var details = mount.closest('details');
  if (details) details.open = true;
  kbLibraryInlineActive = true;
  var status = document.getElementById('kb-library-status');
  if (status) { status.textContent = ''; status.className = 'pdf-template-hint'; }
}

// Muss vor jedem Neuzeichnen der Bibliothek laufen: sonst raeumt innerHTML das
// einzige Editor-Formular aus dem Dokument.
function kbLibraryReleaseNotebookForm() {
  var form = document.getElementById('notebook-form');
  if (!form || !form.classList.contains('notebook-editor-inline')) return;
  var anchor = document.getElementById('notebook-form-anchor');
  form.classList.remove('notebook-editor-inline');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(form, anchor);
}

function kbLibraryAttachmentButtons(attachments) {
  return attachments.map(function(file) {
    var isImage = remoteImageAttachment(file);
    var opener = isImage ? 'kbOpenDirectImageEditor' : (file.mime_type === 'application/pdf' ? 'kbOpenDirectPdfEditor' : '');
    if (!opener) return '';
    return '<button class="admin-mini-btn" type="button" onclick="' + opener + '(\'' + file.id + '\')">' +
      (isImage ? 'Bild' : 'PDF') + ' direkt bearbeiten: ' + zcEsc(file.original_name) + '</button>';
  }).join('');
}

function kbLibraryRender() {
  var list = document.getElementById('kb-library-list');
  var count = document.getElementById('kb-library-count');
  var search = document.getElementById('kb-library-search');
  var category = document.getElementById('kb-library-category');
  if (!list || !count || !search || !category) return;
  kbLibraryReleaseNotebookForm();
  if (!currentProfile || currentProfile.role !== 'admin') {
    count.textContent = '0';
    list.innerHTML = '<div class="kb-inbox-empty">Admin-Anmeldung erforderlich.</div>';
    return;
  }
  var published = remoteKnowledgeEntries.filter(function(entry) { return entry.status === 'published'; });
  var selectedCategory = category.value;
  var categories = published.map(function(entry) { return entry.category || ''; })
    .filter(Boolean)
    .filter(function(value, index, values) { return values.indexOf(value) === index; })
    .sort(function(a, b) { return a.localeCompare(b, 'de'); });
  category.innerHTML = '<option value="">Alle Kategorien</option>' + categories.map(function(value) {
    return '<option value="' + zcEsc(value) + '">' + zcEsc(value) + '</option>';
  }).join('');
  category.value = categories.indexOf(selectedCategory) >= 0 ? selectedCategory : '';
  var query = search.value.trim().toLowerCase();
  var entries = published.filter(function(entry) {
    return (!category.value || entry.category === category.value) && kbLibraryEntryMatches(entry, query);
  });
  count.textContent = entries.length;
  list.innerHTML = entries.length
    ? entries.map(kbLibraryEntryHtml).join('')
    : '<div class="kb-inbox-empty">Keine freigegebenen Eintraege fuer diese Auswahl gefunden.</div>';
  notebookFitAllRenderedContent(list);
}

function kbRenderSearch() {
  var results = document.getElementById('kb-search-results');
  var input = document.getElementById('kb-search');
  if (!results || !input) return;
  var query = input.value.trim().toLowerCase();
  if (!query) { results.innerHTML = ''; return; }
  var entries = remoteKnowledgeEntries.filter(function(entry) { return entry.status === 'published' && remoteEntryMatches(entry, query); });
  results.innerHTML = entries.length ? entries.map(function(entry) { return remoteEntryHtml(entry, {}); }).join('') : '<div class="kb-empty">Keine Informationen zu dieser Suche gefunden.</div>';
  // Platzierte Bilder fallen aus dem Textfluss, ihr Container braucht eine
  // gemessene Hoehe. Platzierte PDFs holen hier ihre erste Seite nach.
  notebookFitAllRenderedContent(results);
}

function renderTechDrafts() {
  var list = document.getElementById('tech-draft-list');
  var count = document.getElementById('tech-draft-count');
  if (!list || !count || !currentSession) return;
  var entries = remoteKnowledgeEntries.filter(function(entry) { return entry.submitted_by === currentSession.user.id && entry.status === 'draft'; });
  count.textContent = entries.length;
  list.innerHTML = entries.length ? entries.map(function(entry) { return remoteEntryHtml(entry, { editable: false }); }).join('') : '<div class="zc-empty">Keine offenen Entwürfe.</div>';
}
