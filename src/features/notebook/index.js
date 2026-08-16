var notebookInlineImages = [];
var notebookInlineDragKey = '';

function notebookEditor() {
  return document.getElementById('notebook-content');
}

function notebookReleaseInlineImages() {
  notebookInlineImages.forEach(function(item) {
    if (item.url && item.url.indexOf('blob:') === 0) URL.revokeObjectURL(item.url);
  });
  notebookInlineImages = [];
  notebookInlineDragKey = '';
}

function notebookInlineImageKey(image) {
  if (!image) return '';
  if (image.dataset.notebookLocalId) return 'local:' + image.dataset.notebookLocalId;
  if (image.dataset.notebookImageId) return 'attachment:' + image.dataset.notebookImageId;
  return '';
}

function notebookFindInlineImage(key) {
  var editor = notebookEditor();
  if (!editor || !key) return null;
  return Array.from(editor.querySelectorAll('img.notebook-inline-image')).find(function(image) {
    return notebookInlineImageKey(image) === key;
  }) || null;
}

function notebookAttachmentById(entry, attachmentId) {
  return (entry && entry.knowledge_attachments || []).find(function(file) { return file.id === attachmentId; }) || null;
}

function notebookImagePosition(image) {
  return {
    x: Math.max(0, Number(image && image.dataset.notebookX) || 12),
    y: Math.max(0, Number(image && image.dataset.notebookY) || 12)
  };
}

function notebookSetImagePosition(image, x, y) {
  if (!image) return;
  var rawX = Number(x);
  var rawY = Number(y);
  var position = {
    x: Math.max(0, Math.round(isFinite(rawX) ? rawX : 12)),
    y: Math.max(0, Math.round(isFinite(rawY) ? rawY : 12))
  };
  image.dataset.notebookX = String(position.x);
  image.dataset.notebookY = String(position.y);
  image.style.left = position.x + 'px';
  image.style.top = position.y + 'px';
}

function notebookKeepImageVisible(image) {
  var editor = notebookEditor();
  if (!editor || !image) return;
  var requiredHeight = 300;
  Array.from(editor.querySelectorAll('img.notebook-inline-image')).forEach(function(item) {
    var position = notebookImagePosition(item);
    requiredHeight = Math.max(requiredHeight, position.y + Math.max(item.offsetHeight || 120, 120) + 24);
  });
  editor.style.minHeight = requiredHeight + 'px';
}

function notebookBindInlineImageMovement(image) {
  image.addEventListener('pointerdown', function(event) {
    if (event.button !== undefined && event.button !== 0) return;
    var editor = notebookEditor();
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    var start = notebookImagePosition(image);
    var startX = event.clientX;
    var startY = event.clientY;
    image.classList.add('is-dragging');
    image.setPointerCapture(event.pointerId);
    function move(moveEvent) {
      var maxX = Math.max(0, editor.clientWidth - image.offsetWidth - 2);
      var maxY = Math.max(0, editor.clientHeight - image.offsetHeight - 2);
      var nextX = Math.min(maxX, Math.max(0, start.x + moveEvent.clientX - startX));
      var nextY = Math.min(maxY, Math.max(0, start.y + moveEvent.clientY - startY));
      notebookSetImagePosition(image, nextX, nextY);
    }
    function finish() {
      image.classList.remove('is-dragging');
      notebookKeepImageVisible(image);
      image.removeEventListener('pointermove', move);
      image.removeEventListener('pointerup', finish);
      image.removeEventListener('pointercancel', finish);
    }
    image.addEventListener('pointermove', move);
    image.addEventListener('pointerup', finish);
    image.addEventListener('pointercancel', finish);
  });
}

function notebookMakeInlineImage(options, editable) {
  var image = document.createElement('img');
  image.className = 'notebook-inline-image';
  image.src = options.url;
  image.alt = options.name || 'Bild in Notiz';
  image.title = editable ? 'Bild im Notizfeld verschieben' : image.alt;
  image.draggable = false;
  image.contentEditable = 'false';
  image.tabIndex = editable ? 0 : -1;
  if (options.localId) image.dataset.notebookLocalId = options.localId;
  if (options.attachmentId) image.dataset.notebookImageId = options.attachmentId;
  notebookSetImagePosition(image, options.x, options.y);
  image.addEventListener('load', function() { notebookKeepImageVisible(image); }, { once: true });
  if (editable) {
    notebookBindInlineImageMovement(image);
  }
  return image;
}

function notebookSafeContentElement(content, entry, editable) {
  var result = document.createElement('div');
  var source = new DOMParser().parseFromString(String(content || ''), 'text/html');
  function appendNodes(nodes, target) {
    Array.from(nodes || []).forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        target.appendChild(document.createElement('br'));
        return;
      }
      if (tag === 'img') {
        var attachmentId = node.getAttribute('data-notebook-image-id') || '';
        var attachment = notebookAttachmentById(entry, attachmentId);
        if (attachment && attachment.preview_url) {
          target.appendChild(notebookMakeInlineImage({
            attachmentId: attachment.id,
            url: attachment.preview_url,
            name: attachment.original_name,
            x: node.getAttribute('data-notebook-x'),
            y: node.getAttribute('data-notebook-y')
          }, editable));
        } else if (attachmentId) {
          var placeholder = document.createElement('span');
          placeholder.className = 'notebook-inline-image-placeholder';
          placeholder.textContent = 'Bild nicht verfügbar';
          target.appendChild(placeholder);
        }
        return;
      }
      if (tag === 'div' || tag === 'p') {
        var block = document.createElement('div');
        appendNodes(node.childNodes, block);
        target.appendChild(block);
        return;
      }
      appendNodes(node.childNodes, target);
    });
  }
  appendNodes(source.body.childNodes, result);
  return result;
}

function notebookSetEditorContent(content, entry) {
  var editor = notebookEditor();
  if (!editor) return;
  notebookReleaseInlineImages();
  editor.innerHTML = '';
  var safe = notebookSafeContentElement(content, entry, true);
  while (safe.firstChild) editor.appendChild(safe.firstChild);
}

function notebookInlineAttachmentIds(entry) {
  var ids = {};
  var source = new DOMParser().parseFromString(String(entry && entry.content || ''), 'text/html');
  Array.from(source.querySelectorAll('img[data-notebook-image-id]')).forEach(function(image) {
    var id = image.getAttribute('data-notebook-image-id');
    if (id) ids[id] = true;
  });
  return ids;
}

function notebookStoredContentHtml(entry) {
  return notebookSafeContentElement(entry && entry.content, entry, false).innerHTML;
}

function notebookSerializeEditorContent() {
  var editor = notebookEditor();
  var result = document.createElement('div');
  if (!editor) return '';
  function copyNodes(nodes, target) {
    Array.from(nodes || []).forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        target.appendChild(document.createElement('br'));
        return;
      }
      if (tag === 'img') {
        var attachmentId = node.dataset.notebookImageId || '';
        if (!attachmentId && node.dataset.notebookLocalId) {
          var pending = notebookInlineImages.find(function(item) { return item.localId === node.dataset.notebookLocalId; });
          attachmentId = pending && pending.attachmentId || '';
        }
        if (!attachmentId) return;
        var image = document.createElement('img');
        image.setAttribute('data-notebook-image-id', attachmentId);
        image.setAttribute('alt', String(node.alt || 'Bild in Notiz').slice(0, 160));
        image.setAttribute('data-notebook-x', String(Math.max(0, Number(node.dataset.notebookX) || 12)));
        image.setAttribute('data-notebook-y', String(Math.max(0, Number(node.dataset.notebookY) || 12)));
        target.appendChild(image);
        return;
      }
      if (tag === 'div' || tag === 'p') {
        var block = document.createElement('div');
        copyNodes(node.childNodes, block);
        target.appendChild(block);
        return;
      }
      copyNodes(node.childNodes, target);
    });
  }
  copyNodes(editor.childNodes, result);
  return result.innerHTML.trim();
}

function notebookRangeAtPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    var position = document.caretPositionFromPoint(x, y);
    if (!position) return null;
    var range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function notebookInsertNode(node, dropEvent) {
  var editor = notebookEditor();
  if (!editor) return;
  var range = dropEvent ? notebookRangeAtPoint(dropEvent.clientX, dropEvent.clientY) : null;
  if (!range) {
    var selection = window.getSelection();
    if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) range = selection.getRangeAt(0);
  }
  if (range && editor.contains(range.startContainer)) {
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    var newSelection = window.getSelection();
    newSelection.removeAllRanges();
    newSelection.addRange(range);
  } else {
    editor.appendChild(node);
  }
  editor.focus();
}

function notebookInsertInlineFiles(files, dropEvent) {
  var valid = [];
  var invalid = [];
  Array.from(files || []).forEach(function(file) {
    var isImage = remoteImageAttachment({ mime_type: file.type || '' }) || /\.(jpe?g|png|webp)$/i.test(file.name || '');
    if (!isImage || file.size > REMOTE_ATTACHMENT_MAX_SIZE) {
      invalid.push(file.name);
      return;
    }
    valid.push(file);
  });
  valid.forEach(function(file) {
    var item = {
      localId: 'notebook-image-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      file: file,
      name: file.name,
      url: URL.createObjectURL(file),
      attachmentId: '',
      x: 16 + ((notebookInlineImages.length % 5) * 22),
      y: 16 + ((notebookInlineImages.length % 5) * 22)
    };
    notebookInlineImages.push(item);
    notebookInsertNode(notebookMakeInlineImage(item, true), dropEvent);
  });
  if (invalid.length) notebookSetStatus('Nur JPG, PNG und WebP bis 25 MB können direkt im Text eingefügt werden: ' + invalid.join(', '), 'error');
  else if (valid.length) notebookSetStatus(valid.length + ' Bild' + (valid.length === 1 ? '' : 'er') + ' in den Text eingefügt. Zum Verschieben einfach ziehen.', 'success');
}

function notebookHandleInlineImageSelection() {
  var input = document.getElementById('notebook-inline-images');
  var files = Array.from(input && input.files || []);
  if (files.length) notebookInsertInlineFiles(files);
  if (input) input.value = '';
}

function notebookEditorDragOver(event) {
  if (notebookInlineDragKey || (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length)) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = notebookInlineDragKey ? 'move' : 'copy';
  }
}

function notebookEditorDrop(event) {
  var files = Array.from(event.dataTransfer && event.dataTransfer.files || []);
  if (files.length && !notebookInlineDragKey) {
    event.preventDefault();
    notebookInsertInlineFiles(files, event);
    return;
  }
  var image = notebookFindInlineImage(notebookInlineDragKey);
  if (!image) return;
  event.preventDefault();
  notebookInsertNode(image, event);
  image.classList.remove('is-dragging');
  notebookInlineDragKey = '';
}

function notebookSetStatus(message, type) {
  var status = document.getElementById('notebook-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'pdf-template-hint' + (type ? ' ' + type : '');
}

function notebookEntries() {
  return (remoteKnowledgeEntries || []).filter(isNotebookEntry);
}

function notebookRenderSelectedFiles() {
  var input = document.getElementById('notebook-files');
  var preview = document.getElementById('notebook-file-preview');
  if (!preview) return;
  var files = Array.from(input && input.files || []);
  preview.innerHTML = files.map(function(file) {
    return '<span class="notebook-file-chip">' + zcEsc(attachmentKind(kbIsPdfFile(file) ? 'application/pdf' : (file.type || 'image/jpeg'))) + ': ' + zcEsc(file.name) + '</span>';
  }).join('');
}

function notebookSetEditState(entry) {
  var state = document.getElementById('notebook-edit-state');
  var title = document.getElementById('notebook-edit-title');
  var submit = document.getElementById('notebook-submit');
  if (!state || !title || !submit) return;
  if (entry) {
    title.textContent = entry.title;
    state.classList.add('visible');
    submit.textContent = 'Änderungen speichern';
  } else {
    title.textContent = '';
    state.classList.remove('visible');
    submit.textContent = 'Als Entwurf speichern';
  }
}

function notebookResetForm() {
  var form = document.getElementById('notebook-form');
  if (!form) return;
  form.reset();
  form.removeAttribute('data-kb-id');
  document.getElementById('notebook-category').value = NOTEBOOK_CATEGORIES[0];
  notebookSetEditorContent('', null);
  document.getElementById('notebook-file-preview').innerHTML = '';
  notebookSetStatus('', '');
  notebookSetEditState(null);
}

function notebookRender() {
  var count = document.getElementById('notebook-count');
  var target = document.getElementById('notebook-list-content');
  if (!count || !target) return;
  var entries = notebookEntries();
  count.textContent = entries.length;
  if (!entries.length) {
    target.innerHTML = '<div class="notebook-list-empty">Noch keine Notizen gespeichert.</div>';
    return;
  }
  target.innerHTML = '<div class="admin-feature-list">' + entries.map(function(entry) {
    var inlineAttachmentIds = notebookInlineAttachmentIds(entry);
    return '<article class="admin-feature kb-card">' +
      '<div class="admin-feature-head"><span class="admin-badge">' + zcEsc(entry.category) + '</span>' + remoteEntryStatus(entry) +
        '<span class="admin-feature-actions"><button class="admin-mini-btn" type="button" onclick="notebookEdit(\'' + entry.id + '\')">Bearbeiten</button></span></div>' +
      '<div class="kb-card-body"><div class="kb-card-title">' + zcEsc(entry.title) + '</div>' +
        (remoteEntryDate(entry) ? '<div class="kb-card-meta">Aktualisiert ' + zcEsc(remoteEntryDate(entry)) + '</div>' : '') +
        '<div class="notebook-rendered-content">' + notebookStoredContentHtml(entry) + '</div>' +
        remoteImageGalleryHtml(entry, false, inlineAttachmentIds) + remoteAttachmentHtml(entry, false) +
      '</div></article>';
  }).join('') + '</div>';
}

function notebookEdit(id) {
  var entry = (remoteKnowledgeEntries || []).find(function(item) { return item.id === id && isNotebookEntry(item); });
  if (!entry) return;
  var form = document.getElementById('notebook-form');
  form.setAttribute('data-kb-id', entry.id);
  document.getElementById('notebook-title').value = entry.title;
  document.getElementById('notebook-category').value = NOTEBOOK_CATEGORIES.indexOf(entry.category) >= 0 ? entry.category : NOTEBOOK_CATEGORIES[0];
  notebookSetEditorContent(entry.content || '', entry);
  document.getElementById('notebook-files').value = '';
  document.getElementById('notebook-file-preview').innerHTML = '';
  notebookSetEditState(entry);
  notebookSetStatus('', '');
  showActiveView('notebook');
  window.setTimeout(function() { document.getElementById('notebook-title').focus(); }, 0);
}

async function notebookSave() {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return;
  var form = document.getElementById('notebook-form');
  var id = form.getAttribute('data-kb-id');
  var payload = {
    category: document.getElementById('notebook-category').value.trim(),
    title: document.getElementById('notebook-title').value.trim(),
    content: notebookSerializeEditorContent(),
    command: NOTEBOOK_ENTRY_MARKER
  };
  if (!payload.category || !payload.title) return;
  if (payload.content.length > 3000) {
    notebookSetStatus('Die Notiz ist zu lang. Text und Bildplatzierungen dürfen zusammen höchstens 3.000 Zeichen speichern.', 'error');
    return;
  }
  var duplicate = kbRemoteEntryWithTitle(payload.title, id);
  if (duplicate) {
    notebookSetStatus(kbDuplicateTitleError(payload.title, duplicate), 'error');
    return;
  }
  var submit = document.getElementById('notebook-submit');
  submit.disabled = true;
  notebookSetStatus('Notiz wird gespeichert …');
  try {
    var response = id
      ? await supabaseClient.from('knowledge_entries').update(payload).eq('id', id).select('id,status').single()
      : await supabaseClient.from('knowledge_entries').insert(Object.assign({}, payload, { status: 'draft', submitted_by: currentSession.user.id })).select('id,status').single();
    if (response.error) throw response.error;

    var files = Array.from(document.getElementById('notebook-files').files || []);
    var pendingInlineImages = notebookInlineImages.filter(function(item) { return !item.attachmentId; });
    var uploadedAttachments = await uploadRemoteAttachments(response.data.id, files.concat(pendingInlineImages.map(function(item) { return item.file; })));
    pendingInlineImages.forEach(function(item, index) {
      var uploaded = uploadedAttachments[files.length + index];
      if (!uploaded || !uploaded.attachment) throw new Error('Bild konnte nicht in die Notiz eingefügt werden.');
      item.attachmentId = uploaded.attachment.id;
      var image = notebookFindInlineImage('local:' + item.localId);
      if (image) {
        image.dataset.notebookImageId = item.attachmentId;
        delete image.dataset.notebookLocalId;
      }
    });
    var entryForAttachments = { id: response.data.id, status: response.data.status };
    for (var attachmentIndex = 0; attachmentIndex < uploadedAttachments.length; attachmentIndex++) {
      var uploaded = uploadedAttachments[attachmentIndex];
      if (uploaded.isPdf) await kbStoreOrIndexRemotePdf(entryForAttachments, uploaded.attachment, uploaded.file);
    }
    var storedContent = notebookSerializeEditorContent();
    if (storedContent.length > 3000) throw new Error('Die Notiz ist nach dem Einfügen der Bilder zu lang.');
    if (storedContent !== payload.content) {
      var contentUpdate = await supabaseClient.from('knowledge_entries').update({ content: storedContent, command: NOTEBOOK_ENTRY_MARKER }).eq('id', response.data.id);
      if (contentUpdate.error) throw contentUpdate.error;
    }
    if (response.data.status === 'published') await indexRemoteKnowledgeEntry(response.data.id);
    notebookResetForm();
    await loadRemoteKnowledge();
    notebookSetStatus('Notiz wurde gespeichert.', 'success');
  } catch (error) {
    notebookSetStatus(error && error.message ? error.message : 'Notiz konnte nicht gespeichert werden.', 'error');
  } finally {
    submit.disabled = false;
  }
}


// Event bindings live with the Notebook feature so this area can evolve independently.
document.getElementById('notebook-form').addEventListener('submit', async function(event) { event.preventDefault(); await notebookSave(); });
document.getElementById('notebook-inline-images').addEventListener('change', notebookHandleInlineImageSelection);
document.getElementById('notebook-content').addEventListener('dragover', notebookEditorDragOver);
document.getElementById('notebook-content').addEventListener('drop', notebookEditorDrop);
