var notebookInlineImages = [];
var NOTEBOOK_DRAG_EDGE = 34;
var NOTEBOOK_NUDGE_STEP = 10;
var NOTEBOOK_NUDGE_FINE = 1;
var NOTEBOOK_IMAGE_RESERVE = 24;
var NOTEBOOK_MIN_EDITOR_HEIGHT = 300;
// Obergrenze fuer das Mitwachsen beim Ziehen. Ohne sie kann ein Zug das Feld
// beliebig lang machen.
var NOTEBOOK_MAX_EDITOR_HEIGHT = 2400;
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
  if (image.dataset.notebookPdfId) return 'attachment:' + image.dataset.notebookPdfId;
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

// Gespeicherte Notizen entstehen ueber innerHTML. Die Elemente, an denen der
// Nachlader haengt, werden dabei verworfen und aus der Zeichenkette neu
// aufgebaut -- die erste Seite muss darum hier noch einmal angefordert werden.
function notebookRefreshPlacedPdfs(root) {
  Array.from((root || document).querySelectorAll('img[data-notebook-pdf-id]')).forEach(function(image) {
    if (image.dataset.notebookPdfLoaded === '1') return;
    image.dataset.notebookPdfLoaded = '1';
    notebookLoadPdfThumbnail(image, image.dataset.notebookPdfId);
  });
}

function notebookFitAllRenderedContent(root) {
  Array.from((root || document).querySelectorAll('.notebook-rendered-content')).forEach(notebookFitRenderedContent);
  Array.from((root || document).querySelectorAll('.notebook-rendered-content img.notebook-inline-image')).forEach(notebookWatchRenderedImage);
  notebookRefreshPlacedPdfs(root);
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
  var isPdf = image && image.dataset.notebookPdf === '1';
  var attachmentId = image && (isPdf ? image.dataset.notebookPdfId : image.dataset.notebookImageId);
  if (!attachmentId) {
    notebookSetStatus((isPdf ? 'Die PDF' : 'Das Bild') + ' muss erst mit der Notiz gespeichert werden, bevor sie direkt bearbeitet werden kann.', 'error');
    return;
  }
  var open = isPdf ? window.kbOpenDirectPdfEditor : window.kbOpenDirectImageEditor;
  if (typeof open !== 'function') return;
  notebookSetStatus('');
  open(attachmentId);
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

  // Zieht der Zeiger tiefer, als das Feld reicht, waechst das Feld mit. Der
  // Zuwachs haengt an der Wunschposition des Zeigers, nicht an der Feldhoehe:
  // sonst schaukeln sich beide auf -- Feld waechst, Bild darf tiefer, Feld
  // waechst. Der Zeiger begrenzt sich selbst, die Feldhoehe nicht.
  function growEditorFor(wishedY) {
    var needed = Math.min(NOTEBOOK_MAX_EDITOR_HEIGHT, wishedY + notebookImageHeight(image) + NOTEBOOK_IMAGE_RESERVE);
    if (needed <= Math.max(editor.scrollHeight, editor.clientHeight)) return;
    editor.style.minHeight = needed + 'px';
    maxTop = notebookMaxImageTop(editor, image);
  }

  function apply() {
    // Die Position gehoert zum Inhalt, der Zeiger meldet Fensterkoordinaten.
    // Darum muss die inzwischen gescrollte Strecke wieder dazugerechnet werden.
    var scrolled = editor.scrollTop - startScroll;
    var nextX = Math.min(maxLeft, Math.max(0, start.x + pointerX - startX));
    var wishedY = Math.max(0, start.y + (pointerY - startY) + scrolled);
    if (wishedY > maxTop) growEditorFor(wishedY);
    notebookSetImagePosition(image, nextX, Math.min(maxTop, wishedY));
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

// Eine platzierte PDF ist dasselbe Element wie ein platziertes Bild, nur mit der
// ersten Seite als Vorschau und einer eigenen Kennung. Dadurch gilt die
// Verschiebe- und Groessenmechanik unveraendert auch fuer sie.
function notebookMakeInlineImage(options, editable) {
  var image = document.createElement('img');
  image.className = 'notebook-inline-image' + (options.isPdf ? ' notebook-inline-pdf' : '');
  image.src = options.url;
  image.alt = options.name || (options.isPdf ? 'PDF in Notiz' : 'Bild in Notiz');
  image.draggable = false;
  image.contentEditable = 'false';
  // In der gespeicherten Notiz laesst sich das Bild oeffnen, im Editor
  // verschieben. Beides ueber die Tastatur erreichbar, darum immer im Tab-Lauf.
  image.tabIndex = 0;
  if (editable) {
    image.title = options.isPdf
      ? 'Ziehen zum Verschieben, Ecke unten rechts fuer die Groesse. Doppelklick oder Enter oeffnet die PDF im Editor. Pfeiltasten ruecken sie, mit Shift feiner.'
      : 'Ziehen zum Verschieben, Ecke unten rechts fuer die Groesse. Doppelklick oder Enter oeffnet den Direkt-Editor. Pfeiltasten ruecken das Bild, mit Shift feiner.';
  } else {
    image.title = 'Oeffnen: ' + image.alt;
    image.setAttribute('role', 'button');
  }
  if (options.isPdf) image.dataset.notebookPdf = '1';
  if (options.localId) image.dataset.notebookLocalId = options.localId;
  if (options.attachmentId) {
    if (options.isPdf) image.dataset.notebookPdfId = options.attachmentId;
    else image.dataset.notebookImageId = options.attachmentId;
  }
  notebookSetImagePosition(image, options.x, options.y);
  if (options.width) notebookSetImageWidth(image, options.width);
  if (editable) {
    image.addEventListener('load', function() { notebookKeepImageVisible(image); }, { once: true });
    notebookBindInlineImageMovement(image);
  }
  return image;
}

// Formatierung aus OneNote und Word soll erhalten bleiben, ihr Markup aber
// nicht: die Notiz darf gespeichert nur 3000 Zeichen lang sein. Darum eine enge
// Auswahl an Elementen, kurze Ersatznamen und keine Klassen oder Fremdattribute.
var NOTEBOOK_RICH_TAGS = {
  b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', s: 's', strike: 's', del: 's',
  code: 'code', kbd: 'code', mark: 'mark', sub: 'sub', sup: 'sup',
  ul: 'ul', ol: 'ol', li: 'li', a: 'a', span: 'span', font: 'span',
  h1: 'h3', h2: 'h3', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4'
};

var NOTEBOOK_DROPPED_TAGS = { script: true, style: true, noscript: true, template: true, iframe: true, object: true, embed: true };

var NOTEBOOK_NAMED_COLORS = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080'
};

function notebookColorValue(value) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'inherit' || raw === 'transparent' || raw === 'initial') return '';
  if (NOTEBOOK_NAMED_COLORS[raw]) return NOTEBOOK_NAMED_COLORS[raw];
  var hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) return raw.length === 4 ? '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3] : raw;
  var rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (!rgb) return '';
  return '#' + [rgb[1], rgb[2], rgb[3]].map(function(part) {
    return ('0' + Math.min(255, parseInt(part, 10)).toString(16)).slice(-2);
  }).join('');
}

function notebookColorBrightness(color) {
  var value = color.slice(1);
  return parseInt(value.slice(0, 2), 16) * 0.299 + parseInt(value.slice(2, 4), 16) * 0.587 + parseInt(value.slice(4, 6), 16) * 0.114;
}

// Die Notiz steht auf dunklem Untergrund, die Vorlage kam von weissem Papier.
// Entscheidend ist der Grund, auf dem der Text am Ende wirklich liegt: eine
// Hervorhebung faerbt den Grund hell, dann braucht der Text dunkle Schrift --
// auch wenn OneNote eine helle mitschickt, etwa aus seinem dunklen Modus.
function notebookContrastColor(color, background) {
  if (background && notebookColorBrightness(background) > 140) {
    return !color || notebookColorBrightness(color) > 140 ? '#111111' : color;
  }
  if (!color) return '';
  return notebookColorBrightness(color) < 50 ? '' : color;
}

// OneNote schickt Punktgroessen, der kleine Editor font-Elemente. Beides landet
// in wenigen festen Stufen, damit das Markup kurz bleibt.
function notebookFontSize(node) {
  var raw = String((node.style || {}).fontSize || '').trim().toLowerCase();
  var match = raw.match(/^([\d.]+)(pt|px|em|rem|%)$/);
  var ratio = 0;
  if (match) {
    var value = parseFloat(match[1]);
    if (match[2] === 'pt') ratio = value / 11;
    else if (match[2] === 'px') ratio = value / 15;
    else if (match[2] === '%') ratio = value / 100;
    else ratio = value;
  } else if (node.tagName.toLowerCase() === 'font') {
    ratio = { '1': 0.8, '2': 0.85, '3': 1, '4': 1.15, '5': 1.4, '6': 1.8, '7': 1.8 }[node.getAttribute('size')] || 0;
  }
  if (!ratio || (ratio >= 0.93 && ratio < 1.1)) return '';
  if (ratio < 0.93) return '0.85em';
  if (ratio < 1.28) return '1.15em';
  if (ratio < 1.6) return '1.4em';
  return '1.8em';
}

// Absaetze und Listen tragen keine bedeutsamen Leerzeichen. Zeilenumbrueche im
// Quelltext wuerden im Editor sonst als Leerzeilen erscheinen.
function notebookIsBlockContainer(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return true;
  return ['body', 'div', 'p', 'ul', 'ol', 'table', 'tbody', 'tr'].indexOf(node.tagName.toLowerCase()) >= 0;
}

function notebookRichStyleOf(node) {
  var style = node.style || {};
  var decoration = String(style.textDecoration || style.textDecorationLine || '') + ' ' + String(node.getAttribute('data-decoration') || '');
  var weight = String(style.fontWeight || '');
  var tag = node.tagName.toLowerCase();
  return {
    color: notebookColorValue(style.color || (tag === 'font' ? node.getAttribute('color') : '')),
    background: notebookColorValue(style.backgroundColor || style.background),
    size: notebookFontSize(node),
    bold: weight === 'bold' || weight === 'bolder' || parseInt(weight, 10) >= 600,
    italic: String(style.fontStyle || '') === 'italic',
    underline: decoration.indexOf('underline') >= 0,
    strike: decoration.indexOf('line-through') >= 0
  };
}

function notebookSafeHref(value) {
  var raw = String(value || '').trim();
  // Netzwerkpfade (file:) kann der Browser von einer Webseite aus nicht oeffnen.
  // Der Pfad bleibt als Text stehen, nur ohne Verweis.
  return /^(https?:|mailto:)/i.test(raw) ? raw.slice(0, 300) : '';
}

// Liefert das Ersatzelement fuer einen Knoten: outer kommt in die Ausgabe,
// inner nimmt die Kinder auf. null heisst: Element weglassen, Kinder behalten.
// context beschreibt, was der Knoten von oben erbt: den Grund, auf dem er
// liegt, und die Schriftfarbe, die dort schon gilt. Beides wandert weiter nach
// unten -- sonst wird eine tiefer gesetzte Schriftfarbe gegen den falschen Grund
// geprueft, und schon gesetzte Farben werden unnoetig wiederholt.
var NOTEBOOK_ROOT_CONTEXT = { background: '', color: '' };

function notebookStyleFor(node, context) {
  context = context || NOTEBOOK_ROOT_CONTEXT;
  var style = notebookRichStyleOf(node);
  var background = style.background || context.background;
  var color = notebookContrastColor(style.color, background);
  // Ein heller Grund ohne eigene Schriftfarbe braucht trotzdem dunkle Schrift.
  if (style.background && !color && notebookColorBrightness(style.background) > 140) color = '#111111';
  var declarations = [];
  if (color && color !== context.color) declarations.push('color:' + color);
  if (style.background) declarations.push('background:' + style.background);
  if (style.size) declarations.push('font-size:' + style.size);
  return {
    style: style,
    declarations: declarations,
    context: { background: background, color: color || context.color }
  };
}

function notebookRichElementFor(node, context) {
  var tag = NOTEBOOK_RICH_TAGS[node.tagName.toLowerCase()];
  if (!tag) return null;
  var resolved = notebookStyleFor(node, context);
  var style = resolved.style;
  var inner = document.createElement(tag);
  if (tag === 'a') {
    var href = notebookSafeHref(node.getAttribute('href'));
    if (href) {
      inner.setAttribute('href', href);
      inner.setAttribute('target', '_blank');
      inner.setAttribute('rel', 'noopener');
    }
  }
  if (resolved.declarations.length) inner.setAttribute('style', resolved.declarations.join(';'));
  var outer = inner;
  function wrap(name) { var element = document.createElement(name); element.appendChild(outer); outer = element; }
  if (style.strike && tag !== 's') wrap('s');
  if (style.underline && tag !== 'u' && tag !== 'a') wrap('u');
  if (style.italic && tag !== 'i') wrap('i');
  if (style.bold && tag !== 'b') wrap('b');
  // Ein span ohne Wirkung kostet nur Zeichen.
  if (tag === 'span' && outer === inner && !inner.hasAttribute('style')) return null;
  return { outer: outer, inner: inner, context: resolved.context };
}

// Absaetze tragen in OneNote oft die Hervorhebung der ganzen Zeile.
function notebookRichBlockFor(node, context) {
  var resolved = notebookStyleFor(node, context);
  var block = document.createElement('div');
  if (resolved.declarations.length) block.setAttribute('style', resolved.declarations.join(';'));
  return { block: block, context: resolved.context };
}

function notebookRichElementIsEmpty(element) {
  return !element.firstChild && !element.textContent.trim();
}

// Laeuft nach dem Zeichnen weiter. Schlaegt es fehl, bleibt das Ersatzbild
// stehen -- die Notiz ist dann trotzdem vollstaendig.
function notebookLoadPdfThumbnail(element, attachmentId) {
  if (typeof kbPdfThumbnailUrl !== 'function') return;
  kbPdfThumbnailUrl(attachmentId).then(function(url) {
    if (!url || !element.isConnected) return;
    element.src = url;
  }).catch(function() {});
}

function notebookSafeContentElement(content, entry, editable) {
  var result = document.createElement('div');
  var source = new DOMParser().parseFromString(String(content || ''), 'text/html');
  function appendNodes(nodes, target, context) {
    Array.from(nodes || []).forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var value = String(node.nodeValue || '').replace(/[\r\n\t]+/g, ' ');
        if (!value.trim() && notebookIsBlockContainer(node.parentNode)) return;
        target.appendChild(document.createTextNode(value));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var tag = node.tagName.toLowerCase();
      // Sonst landet der Inhalt dieser Elemente als Text in der Notiz.
      if (NOTEBOOK_DROPPED_TAGS[tag]) return;
      if (tag === 'br') {
        target.appendChild(document.createElement('br'));
        return;
      }
      if (tag === 'img') {
        var pdfId = node.getAttribute('data-notebook-pdf-id') || '';
        var attachmentId = pdfId || node.getAttribute('data-notebook-image-id') || '';
        var attachment = notebookAttachmentById(entry, attachmentId);
        // Bilder haben eine fertige Adresse, PDFs bekommen ihre erste Seite
        // nachgereicht -- das Zeichnen selbst darf nicht darauf warten.
        if (attachment && (pdfId || attachment.preview_url)) {
          var element = notebookMakeInlineImage({
            attachmentId: attachment.id,
            isPdf: !!pdfId,
            url: pdfId ? NOTEBOOK_PDF_FALLBACK_URL : attachment.preview_url,
            name: attachment.original_name,
            x: node.getAttribute('data-notebook-x'),
            y: node.getAttribute('data-notebook-y'),
            width: node.getAttribute('data-notebook-w')
          }, editable);
          target.appendChild(element);
          if (pdfId) notebookLoadPdfThumbnail(element, attachment.id);
        } else if (attachmentId) {
          var placeholder = document.createElement('span');
          placeholder.className = 'notebook-inline-image-placeholder';
          placeholder.textContent = pdfId ? 'PDF nicht verfügbar' : 'Bild nicht verfügbar';
          target.appendChild(placeholder);
        }
        return;
      }
      if (tag === 'div' || tag === 'p') {
        var wrapper = notebookRichBlockFor(node, context);
        appendNodes(node.childNodes, wrapper.block, wrapper.context);
        // Eine Leerzeile aus der Vorlage hat ohne Inhalt keine Hoehe.
        if (!wrapper.block.firstChild) wrapper.block.appendChild(document.createElement('br'));
        target.appendChild(wrapper.block);
        return;
      }
      var rich = notebookRichElementFor(node, context);
      if (rich) {
        appendNodes(node.childNodes, rich.inner, rich.context);
        if (!notebookRichElementIsEmpty(rich.inner)) target.appendChild(rich.outer);
        return;
      }
      appendNodes(node.childNodes, target, context);
    });
  }
  appendNodes(source.body.childNodes, result, NOTEBOOK_ROOT_CONTEXT);
  return result;
}

function notebookSetEditorContent(content, entry) {
  var editor = notebookEditor();
  if (!editor) return;
  notebookReleaseInlineImages();
  editor.innerHTML = '';
  var safe = notebookSafeContentElement(content, entry, true);
  while (safe.firstChild) editor.appendChild(safe.firstChild);
  notebookUpdateLengthHint();
}

// Ein Screenshot aus Windows oder macOS liegt als Bilddatei in der
// Zwischenablage, nicht als Text.
function notebookClipboardImageFiles(data) {
  var files = Array.from(data.files || []);
  if (!files.length && data.items) {
    files = Array.from(data.items).filter(function(item) { return item.kind === 'file'; })
      .map(function(item) { return item.getAsFile(); }).filter(Boolean);
  }
  return files.filter(function(file) { return String(file.type || '').indexOf('image/') === 0; })
    .map(notebookNamedImageFile);
}

// Aus der Zwischenablage kommt ein Bild oft ohne Dateinamen. Ablagepfad und
// Anzeige brauchen aber einen.
function notebookNamedImageFile(file) {
  if (file.name && /\.[a-z0-9]+$/i.test(file.name)) return file;
  var extension = String(file.type || '').split('/')[1] || 'png';
  var name = 'screenshot-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.' + extension.replace(/[^a-z0-9]/gi, '');
  try { return new File([file], name, { type: file.type || 'image/png' }); } catch (error) { return file; }
}

// Der Farbwaehler nimmt den Fokus aus dem Textfeld und damit die Auswahl mit.
// Sie wird darum vorher gemerkt und vor dem Anwenden zurueckgesetzt.
var notebookSavedRange = null;

function notebookRememberSelection() {
  var editor = notebookEditor();
  var selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  if (editor.contains(selection.anchorNode)) notebookSavedRange = selection.getRangeAt(0).cloneRange();
}

function notebookRestoreSelection() {
  var editor = notebookEditor();
  if (!notebookSavedRange || !editor || !editor.contains(notebookSavedRange.startContainer)) return;
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(notebookSavedRange);
}

// execCommand gilt als veraltet, ist aber der einzige Weg, der ohne
// Fremdbibliothek in jedem Browser auf einer Auswahl arbeitet. styleWithCSS aus
// heisst: b, i und font statt langer style-Attribute, das spart Zeichen.
function notebookFormatCommand(command, value) {
  var editor = notebookEditor();
  if (!editor) return;
  editor.focus();
  notebookRestoreSelection();
  try {
    document.execCommand('styleWithCSS', false, false);
    document.execCommand(command, false, value);
  } catch (error) {
    return;
  }
  notebookRememberSelection();
  notebookUpdateLengthHint();
}

// Formatierung aus OneNote kommt als HTML in der Zwischenablage. Der Browser
// wuerde das komplette Fremdmarkup einsetzen; hier laeuft es durch dieselbe
// Auswahl wie eine gespeicherte Notiz.
function notebookHandlePaste(event) {
  var data = event.clipboardData;
  if (!data) return;
  var images = notebookClipboardImageFiles(data);
  if (images.length) {
    event.preventDefault();
    notebookInsertInlineFiles(images);
    notebookUpdateLengthHint();
    return;
  }
  var html = data.getData('text/html');
  var text = data.getData('text/plain');
  if (!html && !text) return;
  event.preventDefault();
  var fragment = document.createDocumentFragment();
  if (html) {
    var safe = notebookSafeContentElement(html, null, false);
    while (safe.firstChild) fragment.appendChild(safe.firstChild);
  } else {
    String(text).split(/\r?\n/).forEach(function(line, index) {
      if (index) fragment.appendChild(document.createElement('br'));
      fragment.appendChild(document.createTextNode(line));
    });
  }
  notebookInsertFragmentAtCaret(fragment);
}

function notebookInsertFragmentAtCaret(fragment) {
  var editor = notebookEditor();
  if (!editor || !fragment.firstChild) return;
  var last = fragment.lastChild;
  var selection = window.getSelection();
  if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
    var range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(fragment);
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    editor.appendChild(fragment);
  }
  notebookUpdateLengthHint();
}

// Formatierung zaehlt beim Speichern mit. Ohne Anzeige merkt man erst beim
// Speichern, dass die 3000 Zeichen voll sind.
function notebookUpdateLengthHint() {
  var hint = document.getElementById('notebook-length');
  if (!hint) return;
  var length = notebookSerializeEditorContent().length;
  hint.textContent = length + ' / 3000 Zeichen';
  hint.classList.toggle('error', length > 3000);
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
  function copyNodes(nodes, target, context) {
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
        var isPdf = node.dataset.notebookPdf === '1';
        var attachmentId = (isPdf ? node.dataset.notebookPdfId : node.dataset.notebookImageId) || '';
        if (!attachmentId && node.dataset.notebookLocalId) {
          var pending = notebookInlineImages.find(function(item) { return item.localId === node.dataset.notebookLocalId; });
          attachmentId = pending && pending.attachmentId || '';
        }
        if (!attachmentId) return;
        var image = document.createElement('img');
        image.setAttribute(isPdf ? 'data-notebook-pdf-id' : 'data-notebook-image-id', attachmentId);
        image.setAttribute('alt', String(node.alt || (isPdf ? 'PDF in Notiz' : 'Bild in Notiz')).slice(0, 160));
        image.setAttribute('data-notebook-x', String(Math.round(notebookCoordinate(node.dataset.notebookX))));
        image.setAttribute('data-notebook-y', String(Math.round(notebookCoordinate(node.dataset.notebookY))));
        var width = notebookImageWidthAttribute(node);
        if (width) image.setAttribute('data-notebook-w', String(width));
        target.appendChild(image);
        return;
      }
      if (tag === 'div' || tag === 'p') {
        var wrapper = notebookRichBlockFor(node, context);
        copyNodes(node.childNodes, wrapper.block, wrapper.context);
        // Eine Leerzeile bleibt nur sichtbar, wenn der Block etwas enthaelt.
        if (!wrapper.block.firstChild) wrapper.block.appendChild(document.createElement('br'));
        target.appendChild(wrapper.block);
        return;
      }
      var rich = notebookRichElementFor(node, context);
      if (rich) {
        copyNodes(node.childNodes, rich.inner, rich.context);
        if (!notebookRichElementIsEmpty(rich.inner)) target.appendChild(rich.outer);
        return;
      }
      copyNodes(node.childNodes, target, context);
    });
  }
  copyNodes(editor.childNodes, result, NOTEBOOK_ROOT_CONTEXT);
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

function notebookIsPdfFile(file) {
  return String(file.type || '') === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

// Die abgelegte Datei liegt noch nicht in der Ablage. Die Vorschau entsteht
// darum aus der Datei selbst, ohne Umweg ueber das Netz.
async function notebookPdfPlaceholderUrl(file) {
  try {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var rendered = await kbPdfFirstPageCanvas(bytes, 480);
    return rendered.canvas.toDataURL('image/png');
  } catch (error) {
    return NOTEBOOK_PDF_FALLBACK_URL;
  }
}

var NOTEBOOK_PDF_FALLBACK_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 155">' +
  '<rect x="1" y="1" width="118" height="153" rx="4" fill="#f4f4f4" stroke="#bbb"/>' +
  '<path d="M84 1v26h35" fill="none" stroke="#bbb"/>' +
  '<text x="60" y="92" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#c0392b" text-anchor="middle">PDF</text>' +
  '</svg>');

function notebookInsertInlineFiles(files, dropEvent) {
  var valid = [];
  var invalid = [];
  Array.from(files || []).forEach(function(file) {
    var isImage = remoteImageAttachment({ mime_type: file.type || '' }) || /\.(jpe?g|png|webp)$/i.test(file.name || '');
    if ((!isImage && !notebookIsPdfFile(file)) || file.size > REMOTE_ATTACHMENT_MAX_SIZE) {
      invalid.push(file.name);
      return;
    }
    valid.push(file);
  });
  valid.forEach(function(file) {
    var start = notebookInlineImageStart(dropEvent, notebookInlineImages.length);
    var isPdf = notebookIsPdfFile(file);
    var item = {
      localId: 'notebook-image-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      file: file,
      name: file.name,
      url: isPdf ? NOTEBOOK_PDF_FALLBACK_URL : URL.createObjectURL(file),
      isPdf: isPdf,
      attachmentId: '',
      x: start.x,
      y: start.y
    };
    notebookInlineImages.push(item);
    var element = notebookMakeInlineImage(item, true);
    notebookInsertNode(element, dropEvent);
    // Die erste Seite braucht einen Augenblick. Bis dahin steht das Ersatzbild.
    if (isPdf) {
      notebookPdfPlaceholderUrl(file).then(function(url) {
        item.url = url;
        element.src = url;
      });
    }
  });
  if (invalid.length) notebookSetStatus('Nur JPG, PNG, WebP und PDF bis 25 MB können direkt im Text eingefügt werden: ' + invalid.join(', '), 'error');
  else if (valid.length) notebookSetStatus(valid.length + (valid.length === 1 ? ' Datei' : ' Dateien') + ' eingefügt. Ziehen zum Verschieben, Pfeiltasten für die Feinausrichtung.', 'success');
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
      if (!uploaded || !uploaded.attachment) throw new Error('Die Datei konnte nicht in die Notiz eingefügt werden.');
      item.attachmentId = uploaded.attachment.id;
      var image = notebookFindInlineImage('local:' + item.localId);
      if (image) {
        if (item.isPdf) image.dataset.notebookPdfId = item.attachmentId;
        else image.dataset.notebookImageId = item.attachmentId;
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
notebookEditor().addEventListener('paste', notebookHandlePaste);
notebookEditor().addEventListener('input', notebookUpdateLengthHint);
notebookEditor().addEventListener('keyup', notebookRememberSelection);
notebookEditor().addEventListener('mouseup', notebookRememberSelection);

(function bindNotebookFormatTools() {
  var tools = document.getElementById('notebook-format-tools');
  if (!tools) return;
  // Ohne das bliebe die Auswahl im Textfeld nicht bestehen, sobald ein Knopf
  // den Fokus bekommt.
  tools.addEventListener('mousedown', function(event) {
    if (event.target.closest('button, label')) event.preventDefault();
  });
  tools.addEventListener('click', function(event) {
    var button = event.target.closest('[data-command]');
    if (button) notebookFormatCommand(button.dataset.command);
  });
  document.getElementById('notebook-format-size').addEventListener('change', function() {
    notebookFormatCommand('fontSize', this.value);
  });
  // Der Waehler selbst ist unsichtbar, darum traegt sein Knopf die Farbe.
  function bindColorTool(id, command) {
    var input = document.getElementById(id);
    if (!input) return;
    function showSwatch() { input.parentElement.style.borderBottomColor = input.value; }
    input.parentElement.classList.add('has-swatch');
    showSwatch();
    input.addEventListener('input', function() {
      showSwatch();
      notebookFormatCommand(command, input.value);
    });
  }
  bindColorTool('notebook-format-color', 'foreColor');
  bindColorTool('notebook-format-highlight', 'hiliteColor');
})();
// Gerenderte Notizen entstehen ueber innerHTML, dabei gehen Listener an den
// Bildern verloren. Klick und Tastatur laufen darum ueber das Dokument. Das gilt
// auch fuer Notizen, die die Wissensdatenbank zeichnet.
function notebookRenderedImage(target) {
  if (!target || !target.classList || !target.classList.contains('notebook-inline-image')) return null;
  if (!target.closest || !target.closest('.notebook-rendered-content')) return null;
  return target.dataset.notebookImageId || target.dataset.notebookPdfId ? target : null;
}

function notebookOpenRenderedImage(image) {
  // Eine platzierte PDF gehoert in den Betrachter, nicht in den Bild-Editor.
  if (image.dataset.notebookPdfId) {
    if (typeof openRemoteAttachment === 'function') openRemoteAttachment(image.dataset.notebookPdfId);
    return;
  }
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
  if (!image) return;
  event.preventDefault();
  if (image.dataset.notebookPdfId) {
    if (typeof kbOpenDirectPdfEditor === 'function') kbOpenDirectPdfEditor(image.dataset.notebookPdfId);
    return;
  }
  if (typeof kbImageEditDirect === 'function') kbImageEditDirect(image.dataset.notebookImageId);
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
