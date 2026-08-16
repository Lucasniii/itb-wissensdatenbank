var notebookInlineImages = [];
var NOTEBOOK_DRAG_EDGE = 34;
var NOTEBOOK_NUDGE_STEP = 10;
var NOTEBOOK_NUDGE_FINE = 1;
var NOTEBOOK_IMAGE_RESERVE = 24;
var NOTEBOOK_MIN_EDITOR_HEIGHT = 300;
var NOTEBOOK_RESIZE_ZONE = 20;
var NOTEBOOK_MIN_IMAGE_WIDTH = 60;
var NOTEBOOK_RESIZE_STEP = 20;

function notebookEditor() {
  return document.getElementById('notebook-content');
}

function notebookReleaseInlineImages() {
  notebookInlineImages.forEach(function(item) {
    if (item.url && item.url.indexOf('blob:') === 0) URL.revokeObjectURL(item.url);
  });
  notebookInlineImages = [];
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

// 0 ist eine gueltige Position. Nur fehlende oder unlesbare Werte bekommen den
// Standardabstand, sonst schnappt ein Bild am linken oder oberen Rand zurueck.
function notebookCoordinate(value) {
  if (value === undefined || value === null || value === '') return 12;
  var number = Number(value);
  return isFinite(number) ? Math.max(0, number) : 12;
}

function notebookImagePosition(image) {
  return {
    x: notebookCoordinate(image && image.dataset.notebookX),
    y: notebookCoordinate(image && image.dataset.notebookY)
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

function notebookImageHeight(image) {
  return Math.max((image && image.offsetHeight) || 120, 120);
}

// Eine eigene Breite hebt die Vorgaben aus dem Stylesheet auf, die Hoehe folgt
// dem Seitenverhaeltnis. Ohne Breite bleibt es bei den Vorgaben.
function notebookSetImageWidth(image, width) {
  if (!image) return;
  var value = Math.round(Number(width));
  if (!isFinite(value) || value < NOTEBOOK_MIN_IMAGE_WIDTH) {
    delete image.dataset.notebookW;
    image.style.width = '';
    image.style.height = '';
    image.style.maxWidth = '';
    image.style.maxHeight = '';
    return;
  }
  image.dataset.notebookW = String(value);
  image.style.width = value + 'px';
  image.style.height = 'auto';
  image.style.maxWidth = 'none';
  image.style.maxHeight = 'none';
}

function notebookImageWidthAttribute(image) {
  var raw = image && image.dataset.notebookW;
  if (raw === undefined || raw === null || raw === '') return 0;
  var value = Number(raw);
  return isFinite(value) && value >= NOTEBOOK_MIN_IMAGE_WIDTH ? Math.round(value) : 0;
}

function notebookMaxImageWidth(editor, image) {
  return Math.max(NOTEBOOK_MIN_IMAGE_WIDTH, editor.clientWidth - notebookImagePosition(image).x - 2);
}

// Die Ecke unten rechts zieht die Groesse, der Rest verschiebt.
function notebookInResizeZone(image, event) {
  var box = image.getBoundingClientRect();
  return (box.right - event.clientX) <= NOTEBOOK_RESIZE_ZONE
    && (box.bottom - event.clientY) <= NOTEBOOK_RESIZE_ZONE;
}

function notebookKeepImageVisible(image) {
  var editor = notebookEditor();
  if (!editor || !image) return;
  var requiredHeight = NOTEBOOK_MIN_EDITOR_HEIGHT;
  Array.from(editor.querySelectorAll('img.notebook-inline-image')).forEach(function(item) {
    var position = notebookImagePosition(item);
    requiredHeight = Math.max(requiredHeight, position.y + notebookImageHeight(item) + NOTEBOOK_IMAGE_RESERVE);
  });
  editor.style.minHeight = requiredHeight + 'px';
}

// Gespeicherte Notizen zeigen dieselben absolut liegenden Bilder. Der Container
// hat ohne Zutun keine Hoehe, weil die Bilder aus dem Textfluss fallen.
function notebookFitRenderedContent(container) {
  if (!container) return;
  var requiredHeight = 0;
  Array.from(container.querySelectorAll('img.notebook-inline-image')).forEach(function(item) {
    requiredHeight = Math.max(requiredHeight, notebookImagePosition(item).y + notebookImageHeight(item) + NOTEBOOK_IMAGE_RESERVE);
  });
  container.style.minHeight = requiredHeight ? requiredHeight + 'px' : '';
}

function notebookFitAllRenderedContent(root) {
  Array.from((root || document).querySelectorAll('.notebook-rendered-content')).forEach(notebookFitRenderedContent);
  Array.from((root || document).querySelectorAll('.notebook-rendered-content img.notebook-inline-image')).forEach(notebookWatchRenderedImage);
}

// Wird eine Notiz in einem zugeklappten Bereich gezeichnet, hat ihr Bild noch
// keine Hoehe und der Container faellt zu klein aus. Beim Aufklappen misst sonst
// niemand nach, darum meldet sich hier die Groessenaenderung selbst.
var notebookRenderedImageObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(function(entries) {
      var containers = [];
      entries.forEach(function(entry) {
        var container = entry.target.closest && entry.target.closest('.notebook-rendered-content');
        if (container && containers.indexOf(container) < 0) containers.push(container);
      });
      containers.forEach(notebookFitRenderedContent);
    })
  : null;

function notebookWatchRenderedImage(image) {
  if (!notebookRenderedImageObserver || !image || image.dataset.notebookWatched) return;
  image.dataset.notebookWatched = '1';
  notebookRenderedImageObserver.observe(image);
}

function notebookMaxImageLeft(editor, image) {
  return Math.max(0, editor.clientWidth - image.offsetWidth - 2);
}

// Grenzen einmal zu Beginn des Ziehens messen. Waechst das Feld waehrenddessen
// mit, entsteht eine Rueckkopplung: Bild nach unten, Feld waechst, Bild kann
// noch weiter nach unten - das Bild laeuft dann aus dem Feld heraus.
// Die Reserve unter dem Bild gehoert in dieselbe Rechnung wie in
// notebookKeepImageVisible, sonst wandert der untere Rand bei jedem Zug mit.
function notebookMaxImageTop(editor, image) {
  var reach = Math.max(editor.scrollHeight, editor.clientHeight);
  return Math.max(0, reach - notebookImageHeight(image) - NOTEBOOK_IMAGE_RESERVE);
}

function notebookScrollImageIntoView(image) {
  var editor = notebookEditor();
  if (!editor || !image) return;
  var position = notebookImagePosition(image);
  var height = Math.max(image.offsetHeight || 120, 120);
  if (position.y < editor.scrollTop) editor.scrollTop = Math.max(0, position.y - 12);
  else if (position.y + height > editor.scrollTop + editor.clientHeight) {
    editor.scrollTop = position.y + height - editor.clientHeight + 12;
  }
}

function notebookBindInlineImageMovement(image) {
  image.addEventListener('pointerdown', notebookInlineImagePointerDown);
  image.addEventListener('keydown', notebookInlineImageKeyDown);
  image.addEventListener('pointermove', notebookInlineImageHover);
  image.addEventListener('dblclick', notebookInlineImageDoubleClick);
}

function notebookInlineImageDoubleClick(event) {
  event.preventDefault();
  event.stopPropagation();
  notebookOpenImageEditor(event.currentTarget);
}

// Der Direkt-Editor arbeitet auf dem gespeicherten Anhang. Ein gerade
// eingefuegtes Bild liegt noch nicht in der Ablage und hat darum keine Kennung.
function notebookOpenImageEditor(image) {
  var attachmentId = image && image.dataset.notebookImageId;
  if (!attachmentId) {
    notebookSetStatus('Das Bild muss erst mit der Notiz gespeichert werden, bevor es direkt bearbeitet werden kann.', 'error');
    return;
  }
  if (typeof kbOpenDirectImageEditor !== 'function') return;
  notebookSetStatus('');
  kbOpenDirectImageEditor(attachmentId);
}

// Nach dem Direkt-Editor stimmt die Bildadresse nicht mehr: der Anhang behaelt
// seine Kennung, wird aber an einem neuen Ort abgelegt.
function notebookRefreshInlineImageSources() {
  var editor = notebookEditor();
  if (!editor) return;
  var adressen = {};
  (typeof remoteKnowledgeEntries !== 'undefined' && Array.isArray(remoteKnowledgeEntries) ? remoteKnowledgeEntries : [])
    .forEach(function(entry) {
      (entry.knowledge_attachments || []).forEach(function(file) {
        if (file.preview_url) adressen[file.id] = file.preview_url;
      });
    });
  Array.from(editor.querySelectorAll('img.notebook-inline-image')).forEach(function(image) {
    var url = adressen[image.dataset.notebookImageId];
    if (url && image.getAttribute('src') !== url) image.setAttribute('src', url);
  });
}

// Zeigt schon vor dem Klick, was die Ecke tut.
function notebookInlineImageHover(event) {
  var image = event.currentTarget;
  if (image.classList.contains('is-dragging') || image.classList.contains('is-resizing')) return;
  image.style.cursor = notebookInResizeZone(image, event) ? 'nwse-resize' : 'grab';
}

function notebookInlineImagePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  var image = event.currentTarget;
  var editor = notebookEditor();
  if (!editor) return;
  event.preventDefault();
  event.stopPropagation();
  if (notebookInResizeZone(image, event)) {
    notebookInlineImageResizeStart(image, editor, event);
    return;
  }

  var start = notebookImagePosition(image);
  var startX = event.clientX;
  var startY = event.clientY;
  var startScroll = editor.scrollTop;
  var pointerX = event.clientX;
  var pointerY = event.clientY;
  var maxLeft = notebookMaxImageLeft(editor, image);
  var maxTop = notebookMaxImageTop(editor, image);
  var scrollTimer = 0;
  var moved = false;

  image.classList.add('is-dragging');
  editor.classList.add('is-moving-image');
  try { image.setPointerCapture(event.pointerId); } catch (error) {}

  function apply() {
    // Die Position gehoert zum Inhalt, der Zeiger meldet Fensterkoordinaten.
    // Darum muss die inzwischen gescrollte Strecke wieder dazugerechnet werden.
    var scrolled = editor.scrollTop - startScroll;
    var nextX = Math.min(maxLeft, Math.max(0, start.x + pointerX - startX));
    var nextY = Math.min(maxTop, Math.max(0, start.y + (pointerY - startY) + scrolled));
    notebookSetImagePosition(image, nextX, nextY);
  }

  function autoScroll() {
    var box = editor.getBoundingClientRect();
    var step = 0;
    if (pointerY < box.top + NOTEBOOK_DRAG_EDGE) step = -Math.ceil((box.top + NOTEBOOK_DRAG_EDGE - pointerY) / 3);
    else if (pointerY > box.bottom - NOTEBOOK_DRAG_EDGE) step = Math.ceil((pointerY - (box.bottom - NOTEBOOK_DRAG_EDGE)) / 3);
    if (!step) return;
    var before = editor.scrollTop;
    editor.scrollTop = Math.max(0, before + step);
    if (editor.scrollTop !== before) apply();
  }

  function move(moveEvent) {
    moved = true;
    pointerX = moveEvent.clientX;
    pointerY = moveEvent.clientY;
    apply();
  }

  function finish() {
    window.clearInterval(scrollTimer);
    image.classList.remove('is-dragging');
    editor.classList.remove('is-moving-image');
    try { image.releasePointerCapture(event.pointerId); } catch (error) {}
    image.removeEventListener('pointermove', move);
    image.removeEventListener('pointerup', finish);
    image.removeEventListener('pointercancel', finish);
    image.removeEventListener('lostpointercapture', finish);
    notebookKeepImageVisible(image);
    if (moved) image.focus({ preventScroll: true });
  }

  scrollTimer = window.setInterval(autoScroll, 16);
  image.addEventListener('pointermove', move);
  image.addEventListener('pointerup', finish);
  image.addEventListener('pointercancel', finish);
  image.addEventListener('lostpointercapture', finish);
}

function notebookInlineImageResizeStart(image, editor, event) {
  var startWidth = image.offsetWidth;
  var startX = event.clientX;

  image.classList.add('is-resizing');
  editor.classList.add('is-moving-image');
  image.style.cursor = 'nwse-resize';
  try { image.setPointerCapture(event.pointerId); } catch (error) {}

  function resize(moveEvent) {
    notebookSetImageWidth(image, Math.min(
      notebookMaxImageWidth(editor, image),
      Math.max(NOTEBOOK_MIN_IMAGE_WIDTH, startWidth + moveEvent.clientX - startX)));
  }

  function finish() {
    image.classList.remove('is-resizing');
    editor.classList.remove('is-moving-image');
    image.style.cursor = '';
    try { image.releasePointerCapture(event.pointerId); } catch (error) {}
    image.removeEventListener('pointermove', resize);
    image.removeEventListener('pointerup', finish);
    image.removeEventListener('pointercancel', finish);
    image.removeEventListener('lostpointercapture', finish);
    notebookClampImageIntoEditor(image, editor);
    notebookKeepImageVisible(image);
    image.focus({ preventScroll: true });
  }

  image.addEventListener('pointermove', resize);
  image.addEventListener('pointerup', finish);
  image.addEventListener('pointercancel', finish);
  image.addEventListener('lostpointercapture', finish);
}

// Nach einer Groessenaenderung kann das Bild ueber den Rand ragen.
function notebookClampImageIntoEditor(image, editor) {
  var position = notebookImagePosition(image);
  notebookSetImagePosition(image,
    Math.min(notebookMaxImageLeft(editor, image), position.x),
    Math.min(notebookMaxImageTop(editor, image), position.y));
}

function notebookInlineImageKeyDown(event) {
  var image = event.currentTarget;
  var editor = notebookEditor();
  if (!editor) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    notebookOpenImageEditor(image);
    return;
  }
  if (event.key === '+' || event.key === '-' || event.key === '_' || event.key === '=') {
    event.preventDefault();
    event.stopPropagation();
    var richtung = (event.key === '+' || event.key === '=') ? 1 : -1;
    notebookSetImageWidth(image, Math.min(
      notebookMaxImageWidth(editor, image),
      Math.max(NOTEBOOK_MIN_IMAGE_WIDTH, image.offsetWidth + (richtung * NOTEBOOK_RESIZE_STEP))));
    notebookClampImageIntoEditor(image, editor);
    notebookKeepImageVisible(image);
    notebookScrollImageIntoView(image);
    return;
  }
  var step = event.shiftKey ? NOTEBOOK_NUDGE_FINE : NOTEBOOK_NUDGE_STEP;
  var position = notebookImagePosition(image);
  var nextX = position.x;
  var nextY = position.y;
  if (event.key === 'ArrowLeft') nextX = position.x - step;
  else if (event.key === 'ArrowRight') nextX = position.x + step;
  else if (event.key === 'ArrowUp') nextY = position.y - step;
  else if (event.key === 'ArrowDown') nextY = position.y + step;
  else return;
  event.preventDefault();
  event.stopPropagation();
  notebookSetImagePosition(image,
    Math.min(notebookMaxImageLeft(editor, image), nextX),
    Math.min(notebookMaxImageTop(editor, image), nextY));
  notebookKeepImageVisible(image);
  notebookScrollImageIntoView(image);
}

function notebookMakeInlineImage(options, editable) {
  var image = document.createElement('img');
  image.className = 'notebook-inline-image';
  image.src = options.url;
  image.alt = options.name || 'Bild in Notiz';
  image.draggable = false;
  image.contentEditable = 'false';
  // In der gespeicherten Notiz laesst sich das Bild oeffnen, im Editor
  // verschieben. Beides ueber die Tastatur erreichbar, darum immer im Tab-Lauf.
  image.tabIndex = 0;
  if (editable) {
    image.title = 'Ziehen zum Verschieben, Ecke unten rechts fuer die Groesse. Doppelklick oder Enter oeffnet den Direkt-Editor. Pfeiltasten ruecken das Bild, mit Shift feiner.';
  } else {
    image.title = 'Oeffnen: ' + image.alt;
    image.setAttribute('role', 'button');
  }
  if (options.localId) image.dataset.notebookLocalId = options.localId;
  if (options.attachmentId) image.dataset.notebookImageId = options.attachmentId;
  notebookSetImagePosition(image, options.x, options.y);
  if (options.width) notebookSetImageWidth(image, options.width);
  if (editable) {
    image.addEventListener('load', function() { notebookKeepImageVisible(image); }, { once: true });
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
            y: node.getAttribute('data-notebook-y'),
            width: node.getAttribute('data-notebook-w')
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
        image.setAttribute('data-notebook-x', String(Math.round(notebookCoordinate(node.dataset.notebookX))));
        image.setAttribute('data-notebook-y', String(Math.round(notebookCoordinate(node.dataset.notebookY))));
        var width = notebookImageWidthAttribute(node);
        if (width) image.setAttribute('data-notebook-w', String(width));
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

function notebookInlineImageStart(dropEvent, index) {
  var editor = notebookEditor();
  var scrollTop = editor ? editor.scrollTop : 0;
  if (editor && dropEvent) {
    // Abgelegte Bilder gehoeren dorthin, wo sie fallen gelassen wurden.
    var box = editor.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(dropEvent.clientX - box.left + editor.scrollLeft - 30)),
      y: Math.max(0, Math.round(dropEvent.clientY - box.top + scrollTop - 30))
    };
  }
  var offset = 16 + ((index % 5) * 22);
  return { x: offset, y: scrollTop + offset };
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
    var start = notebookInlineImageStart(dropEvent, notebookInlineImages.length);
    var item = {
      localId: 'notebook-image-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      file: file,
      name: file.name,
      url: URL.createObjectURL(file),
      attachmentId: '',
      x: start.x,
      y: start.y
    };
    notebookInlineImages.push(item);
    notebookInsertNode(notebookMakeInlineImage(item, true), dropEvent);
  });
  if (invalid.length) notebookSetStatus('Nur JPG, PNG und WebP bis 25 MB können direkt im Text eingefügt werden: ' + invalid.join(', '), 'error');
  else if (valid.length) notebookSetStatus(valid.length + ' Bild' + (valid.length === 1 ? '' : 'er') + ' eingefügt. Ziehen zum Verschieben, Pfeiltasten für die Feinausrichtung.', 'success');
}

function notebookHandleInlineImageSelection() {
  var input = document.getElementById('notebook-inline-images');
  var files = Array.from(input && input.files || []);
  if (files.length) notebookInsertInlineFiles(files);
  if (input) input.value = '';
}

// Bilder im Feld werden per Pointer verschoben, nicht ueber HTML5-Drag. Hier
// landen daher nur Dateien von ausserhalb.
function notebookEditorDragOver(event) {
  if (!event.dataTransfer || !event.dataTransfer.types) return;
  if (Array.from(event.dataTransfer.types).indexOf('Files') < 0) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  notebookEditor().classList.add('is-file-target');
}

function notebookEditorDragLeave(event) {
  var editor = notebookEditor();
  if (!editor || editor.contains(event.relatedTarget)) return;
  editor.classList.remove('is-file-target');
}

function notebookEditorDrop(event) {
  var editor = notebookEditor();
  if (editor) editor.classList.remove('is-file-target');
  var files = Array.from(event.dataTransfer && event.dataTransfer.files || []);
  if (!files.length) return;
  event.preventDefault();
  notebookInsertInlineFiles(files, event);
}

function notebookSetStatus(message, type) {
  var status = document.getElementById('notebook-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'pdf-template-hint' + (type ? ' ' + type : '');
  // Beim Bearbeiten aus der Bibliothek heraus steht das Formular nach dem
  // Speichern wieder im Notizbuch. Die Meldung gehoert trotzdem dorthin, wo
  // gearbeitet wurde.
  if (typeof kbLibraryMirrorStatus === 'function') kbLibraryMirrorStatus(message, type);
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
  form.removeAttribute('data-kb-command');
  form.removeAttribute('data-kb-notebook');
  document.getElementById('notebook-category').value = NOTEBOOK_CATEGORIES[0];
  notebookSetEditorContent('', null);
  document.getElementById('notebook-file-preview').innerHTML = '';
  notebookSetStatus('', '');
  notebookSetEditState(null);
  // Steht das Formular gerade in einem Bibliothek-Eintrag, gehoert es zurueck
  // ins Notizbuch, sobald die Bearbeitung endet.
  if (typeof kbLibraryReleaseNotebookForm === 'function') kbLibraryReleaseNotebookForm();
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
  notebookFitAllRenderedContent(target);
}

function notebookEdit(id) {
  var entry = (remoteKnowledgeEntries || []).find(function(item) { return item.id === id && isNotebookEntry(item); });
  if (!entry) return;
  notebookLoadIntoEditor(entry);
}

// Auch Wissenseintraege koennen hier bearbeitet werden. Ihr Befehl-Feld darf
// dabei nicht verlorengehen, denn die Notizbuch-Markierung wohnt im selben Feld.
// options.keepView laesst die aktuelle Ansicht stehen. Die Bibliothek holt sich
// das Formular in ihren Eintrag und will nicht ins Notizbuch springen.
function notebookLoadIntoEditor(entry, options) {
  options = options || {};
  var form = document.getElementById('notebook-form');
  form.setAttribute('data-kb-id', entry.id);
  form.setAttribute('data-kb-command', entry.command || '');
  form.setAttribute('data-kb-notebook', isNotebookEntry(entry) ? 'true' : 'false');
  document.getElementById('notebook-title').value = entry.title;
  var select = document.getElementById('notebook-category');
  if (NOTEBOOK_CATEGORIES.indexOf(entry.category) < 0 && entry.category) {
    // Fremde Kategorie erhalten, statt sie still auf die erste zu aendern.
    select.insertAdjacentHTML('beforeend', '<option value="' + zcEsc(entry.category) + '">' + zcEsc(entry.category) + '</option>');
  }
  select.value = entry.category || NOTEBOOK_CATEGORIES[0];
  notebookSetEditorContent(entry.content || '', entry);
  document.getElementById('notebook-files').value = '';
  document.getElementById('notebook-file-preview').innerHTML = '';
  notebookSetEditState(entry);
  notebookSetStatus('', '');
  if (!options.keepView) showActiveView('notebook');
  window.setTimeout(function() { document.getElementById('notebook-title').focus(); }, 0);
}

async function notebookSave() {
  if (!supabaseClient || !currentProfile || currentProfile.role !== 'admin') return;
  var form = document.getElementById('notebook-form');
  var id = form.getAttribute('data-kb-id');
  // Die Notizbuch-Markierung wohnt im Befehl-Feld. Ein Wissenseintrag, der hier
  // nur bearbeitet wird, behaelt darum seinen Befehl und wandert nicht ins
  // Notizbuch. Nur echte Notizen bekommen die Markierung.
  var istWissenseintrag = form.getAttribute('data-kb-notebook') === 'false';
  var vorhandenerBefehl = form.getAttribute('data-kb-command') || '';
  var payload = {
    category: document.getElementById('notebook-category').value.trim(),
    title: document.getElementById('notebook-title').value.trim(),
    content: notebookSerializeEditorContent(),
    command: istWissenseintrag ? vorhandenerBefehl : (vorhandenerBefehl || NOTEBOOK_ENTRY_MARKER)
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
      var contentUpdate = await supabaseClient.from('knowledge_entries').update({ content: storedContent, command: payload.command }).eq('id', response.data.id);
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
// Gerenderte Notizen entstehen ueber innerHTML, dabei gehen Listener an den
// Bildern verloren. Klick und Tastatur laufen darum ueber das Dokument. Das gilt
// auch fuer Notizen, die die Wissensdatenbank zeichnet.
function notebookRenderedImage(target) {
  if (!target || !target.classList || !target.classList.contains('notebook-inline-image')) return null;
  if (!target.closest || !target.closest('.notebook-rendered-content')) return null;
  return target.dataset.notebookImageId ? target : null;
}

function notebookOpenRenderedImage(image) {
  if (typeof kbImageOpenDelayed !== 'function') return;
  kbImageOpenDelayed(image.dataset.notebookImageId);
}

document.addEventListener('click', function(event) {
  var image = notebookRenderedImage(event.target);
  if (!image) return;
  event.preventDefault();
  // Der zweite Klick eines Doppelklicks gehoert dem Direkt-Editor.
  if (event.detail > 1) return;
  notebookOpenRenderedImage(image);
});

// Doppelklick auf ein Bild in einer gerenderten Notiz oeffnet den Direkt-Editor,
// genau wie im Editor selbst.
document.addEventListener('dblclick', function(event) {
  var image = notebookRenderedImage(event.target);
  if (!image || typeof kbImageEditDirect !== 'function') return;
  event.preventDefault();
  kbImageEditDirect(image.dataset.notebookImageId);
});

document.addEventListener('keydown', function(event) {
  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
  var image = notebookRenderedImage(event.target);
  if (!image) return;
  event.preventDefault();
  notebookOpenRenderedImage(image);
});

// Bilder melden ihr Laden nicht nach oben, darum hier in der Capture-Phase: so
// bekommt jeder Container seine Hoehe, ohne dass die gemeinsame Datei etwas davon
// wissen muss.
document.addEventListener('load', function(event) {
  var image = event.target;
  if (!image || !image.classList || !image.classList.contains('notebook-inline-image')) return;
  if (!image.closest) return;
  var container = image.closest('.notebook-rendered-content');
  if (!container) return;
  notebookWatchRenderedImage(image);
  notebookFitRenderedContent(container);
}, true);

document.getElementById('notebook-content').addEventListener('dragover', notebookEditorDragOver);
document.getElementById('notebook-content').addEventListener('dragleave', notebookEditorDragLeave);
document.getElementById('notebook-content').addEventListener('drop', notebookEditorDrop);
