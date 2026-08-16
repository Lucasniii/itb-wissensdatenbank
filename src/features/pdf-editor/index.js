var kbPdfEditorState = null;

function kbPdfEditorPageView(pageNumber) {
  var state = kbPdfEditorState;
  return state && state.pageViews ? state.pageViews[pageNumber] || null : null;
}

function kbPdfEditorCanvasForPage(pageNumber) {
  var view = kbPdfEditorPageView(pageNumber);
  return view ? view.canvas : null;
}

function kbFindRemoteAttachment(id) {
  var found = null;
  remoteKnowledgeEntries.some(function(entry) {
    var attachment = (entry.knowledge_attachments || []).find(function(item) { return item.id === id; });
    if (attachment) found = { entry: entry, attachment: attachment };
    return !!found;
  });
  return found;
}

function kbPdfEditorStoredLayer(attachment) {
  var layers = attachment && attachment.knowledge_pdf_edits;
  return Array.isArray(layers) ? (layers[0] || null) : (layers || null);
}

// Farben, die auf einem Anschlussplan oder Foto tragen. Der Waehler daneben
// bleibt fuer alles andere.
var KB_PDF_EDITOR_SWATCHES = ['#cc0000', '#ff7700', '#ffd400', '#22aa44', '#0066cc', '#000000', '#ffffff'];

function kbPdfEditorRenderSwatches() {
  var target = document.getElementById('kb-pdf-editor-swatches');
  var input = document.getElementById('kb-pdf-editor-color');
  if (!target || !input) return;
  var current = String(input.value || '').toLowerCase();
  // Wie im Notizbuch traegt der Knopf selbst die gewaehlte Farbe.
  if (input.parentElement) input.parentElement.style.borderBottomColor = input.value;
  target.innerHTML = KB_PDF_EDITOR_SWATCHES.map(function(color) {
    return '<button type="button" class="kb-pdf-editor-swatch' + (color === current ? ' active' : '') +
      '" style="background:' + color + '" data-kb-pdf-color="' + color + '" title="' + color + '" aria-label="Farbe ' + color + '"></button>';
  }).join('');
}

function kbPdfEditorPickColor(color) {
  var input = document.getElementById('kb-pdf-editor-color');
  if (!input) return;
  input.value = color;
  kbPdfEditorRenderSwatches();
  kbPdfEditorApplySelectedColor(true);
}

// Pfeilstaerke aus der Seitenleiste. Die Grenzen sind dieselben wie beim
// Einlesen gespeicherter Zeiger.
function kbPdfEditorLineWidth() {
  var input = document.getElementById('kb-pdf-editor-line');
  return kbPdfEditorClamp(input && input.value, 1.5, 10, 2.5);
}

function kbPdfEditorStoredColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#000000';
}

function kbPdfEditorStoredAnnotations(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 120).map(function(item) {
    if (!item || typeof item !== 'object') return null;
    var pageNumber = Math.max(1, Math.min(2000, Number(item.pageNumber) || 1));
    var x = kbPdfEditorClamp(item.x, 0, 1, 0.1);
    var y = kbPdfEditorClamp(item.y, 0, 1, 0.1);
    if (item.type === 'text') {
      return { type: 'text', pageNumber: pageNumber, x: x, y: y, text: String(item.text || '').slice(0, 800), fontSize: kbPdfEditorClamp(item.fontSize, 8, 48, 14), color: kbPdfEditorStoredColor(item.color) };
    }
    if (item.type === 'marker') {
      return { type: 'marker', pageNumber: pageNumber, x: x, y: y, width: kbPdfEditorClamp(item.width, 0.005, 1, 0.1), height: kbPdfEditorClamp(item.height, 0.005, 1, 0.1), color: kbPdfEditorStoredColor(item.color) };
    }
    if (item.type === 'arrow') {
      return { type: 'arrow', pageNumber: pageNumber, x: x, y: y, endX: kbPdfEditorClamp(item.endX, 0, 1, x), endY: kbPdfEditorClamp(item.endY, 0, 1, y), color: kbPdfEditorStoredColor(item.color), lineWidth: kbPdfEditorClamp(item.lineWidth, 1.5, 10, 2.5) };
    }
    if (item.type === 'image' && /^data:image\/(?:png|jpeg);base64,/i.test(String(item.dataUrl || ''))) {
      return { type: 'image', pageNumber: pageNumber, x: x, y: y, width: kbPdfEditorClamp(item.width, 0.02, 1, 0.28), height: kbPdfEditorClamp(item.height, 0.02, 1, 0.28), dataUrl: String(item.dataUrl).slice(0, 36000000), mimeType: item.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
    }
    return null;
  }).filter(Boolean);
}

function kbPdfEditorStoredAnnotationsForSave(annotations) {
  return kbPdfEditorStoredAnnotations(annotations).map(function(annotation) {
    return Object.assign({}, annotation);
  });
}

function kbPdfEditorStatus(message, type) {
  var target = document.getElementById('kb-pdf-editor-status');
  if (!target) return;
  target.textContent = message || '';
  target.className = 'kb-pdf-editor-status' + (type ? ' ' + type : '');
}

function kbPdfEditorPageCount(state) {
  if (!state) return 0;
  return state.sourceType === 'image' ? 1 : (state.pdfDocument ? state.pdfDocument.numPages : 0);
}

function kbPdfEditorSetDocumentLabels(kind, filename) {
  var isImage = kind === 'Bild';
  var title = document.getElementById('kb-pdf-editor-title');
  var text = document.getElementById('kb-pdf-editor-text');
  var help = document.getElementById('kb-pdf-editor-help');
  var footer = document.getElementById('kb-pdf-editor-footer-copy');
  var save = document.getElementById('kb-pdf-editor-save');
  if (title) title.textContent = kind + ' bearbeiten: ' + (filename || 'Unbenannter Anhang');
  if (text) text.placeholder = 'Hinweis eingeben, Werkzeug Text wählen und auf ' + (isImage ? 'das Bild' : 'die PDF') + ' klicken …';
  if (help) help.textContent = 'Text auf die gewünschte Position klicken. Bei Markieren und Zeiger mit gedrückter Maustaste ziehen. Mit Auswahl kannst du Elemente verschieben, ihren Text ändern oder löschen. Beim ausgewählten Zeiger drehen oder verlängern die runden Griffe an seinen Enden den Pfeil.';
  if (footer) footer.textContent = 'Das bearbeitete ' + kind + ' wird ersetzt; Text, Markierungen und Zeiger bleiben als editierbare Ebenen erhalten.';
  if (save) save.textContent = kind + ' speichern & ersetzen';
}

function kbPdfEditorSelectedAnnotation() {
  var state = kbPdfEditorState;
  if (!state || typeof state.selectedAnnotationIndex !== 'number' || state.selectedAnnotationIndex < 0) return null;
  return state.annotations[state.selectedAnnotationIndex] || null;
}

function kbPdfEditorAnnotationBounds(annotation, pageNumber) {
  var view = kbPdfEditorPageView(pageNumber || annotation && annotation.pageNumber);
  var canvas = view && view.canvas;
  if (!annotation) return null;
  if (annotation.type === 'arrow') {
    var left = Math.min(annotation.x, annotation.endX);
    var top = Math.min(annotation.y, annotation.endY);
    return { x: left, y: top, width: Math.max(0.015, Math.abs(annotation.endX - annotation.x)), height: Math.max(0.015, Math.abs(annotation.endY - annotation.y)) };
  }
  if (annotation.type === 'text') {
    var scale = kbPdfEditorDrawUnit(canvas, view);
    var lines = String(annotation.text || '').split(/\r?\n/);
    var longest = lines.reduce(function(length, line) { return Math.max(length, line.length); }, 0);
    var width = canvas ? Math.max(0.12, Math.min(0.75, longest * Math.max(8, annotation.fontSize || 14) * scale * 0.62 / canvas.width)) : 0.3;
    var height = canvas ? Math.max(0.035, lines.length * Math.max(8, annotation.fontSize || 14) * scale * 1.3 / canvas.height) : 0.08;
    return { x: annotation.x, y: annotation.y, width: width, height: height };
  }
  return { x: annotation.x, y: annotation.y, width: annotation.width || 0.1, height: annotation.height || 0.08 };
}

function kbPdfEditorPointNearSegment(point, start, end, threshold) {
  var dx = end.x - start.x;
  var dy = end.y - start.y;
  var lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y) <= threshold;
  var projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  projection = Math.max(0, Math.min(1, projection));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy)) <= threshold;
}

function kbPdfEditorHitAnnotation(point) {
  var state = kbPdfEditorState;
  if (!state) return -1;
  for (var index = state.annotations.length - 1; index >= 0; index--) {
    var annotation = state.annotations[index];
    if (annotation.pageNumber !== point.pageNumber) continue;
    if (annotation.type === 'arrow') {
      if (kbPdfEditorPointNearSegment(point, { x: annotation.x, y: annotation.y }, { x: annotation.endX, y: annotation.endY }, 0.035)) return index;
      continue;
    }
    var bounds = kbPdfEditorAnnotationBounds(annotation);
    if (bounds && point.x >= bounds.x - 0.015 && point.x <= bounds.x + bounds.width + 0.015 && point.y >= bounds.y - 0.015 && point.y <= bounds.y + bounds.height + 0.015) return index;
  }
  return -1;
}

function kbPdfEditorHitSelectedArrowHandle(point) {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected || selected.type !== 'arrow' || selected.pageNumber !== point.pageNumber) return '';
  var radius = 0.028;
  if (Math.hypot(point.x - selected.x, point.y - selected.y) <= radius) return 'start';
  if (Math.hypot(point.x - selected.endX, point.y - selected.endY) <= radius) return 'end';
  return '';
}

function kbPdfEditorUpdateSelectionUI() {
  var state = kbPdfEditorState;
  var selected = kbPdfEditorSelectedAnnotation();
  var target = document.getElementById('kb-pdf-editor-selection');
  var apply = document.getElementById('kb-pdf-editor-apply-selection');
  var remove = document.getElementById('kb-pdf-editor-delete-selection');
  var text = document.getElementById('kb-pdf-editor-text');
  if (!selected) {
    if (target) target.textContent = 'Keine Auswahl. Mit „Auswahl“ ein Element anklicken, gedrückt halten und verschieben.';
    if (apply) apply.disabled = true;
    if (remove) remove.disabled = true;
    return;
  }
  var labels = { text: 'Text', marker: 'Markierung', arrow: 'Zeiger', image: 'Foto' };
  if (target) target.textContent = selected.type === 'arrow'
    ? 'Auswahl: Zeiger. Linie ziehen zum Verschieben; runde Griffe ziehen zum Drehen oder Verlängern.'
    : 'Auswahl: ' + (labels[selected.type] || 'Element') + '. Gedrückt halten und direkt auf der PDF verschieben.';
  if (remove) remove.disabled = false;
  if (apply) apply.disabled = selected.type === 'image';
  if (selected.type === 'text') {
    text.value = selected.text || '';
    document.getElementById('kb-pdf-editor-size').value = selected.fontSize || 14;
    document.getElementById('kb-pdf-editor-color').value = selected.color || '#000000';
    kbPdfEditorRenderSwatches();
  } else if (selected.type === 'marker' || selected.type === 'arrow') {
    document.getElementById('kb-pdf-editor-color').value = selected.color || '#000000';
    kbPdfEditorRenderSwatches();
    // Beim Auswaehlen zeigt das Feld die Staerke des Zeigers, statt sie zu ueberschreiben.
    if (selected.type === 'arrow') document.getElementById('kb-pdf-editor-line').value = selected.lineWidth || 2.5;
  }
}

function kbPdfEditorClearSelection() {
  if (!kbPdfEditorState) return;
  kbPdfEditorState.selectedAnnotationIndex = -1;
  kbPdfEditorState.selectionDrag = null;
  kbPdfEditorUpdateSelectionUI();
}

function kbPdfEditorApplySelectedStyle() {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected) return;
  var text = document.getElementById('kb-pdf-editor-text').value.trim();
  var color = document.getElementById('kb-pdf-editor-color').value;
  if (selected.type === 'text') {
    if (!text) { kbPdfEditorStatus('Ein Textfeld darf nicht leer sein.', 'error'); return; }
    selected.text = text;
    selected.fontSize = Math.max(8, Math.min(48, Number(document.getElementById('kb-pdf-editor-size').value) || 14));
    selected.color = color;
  } else if (selected.type === 'marker' || selected.type === 'arrow') {
    selected.color = color;
    if (selected.type === 'arrow') selected.lineWidth = kbPdfEditorLineWidth();
  } else {
    return;
  }
  kbPdfEditorRedraw();
  kbPdfEditorStatus('Auswahl aktualisiert.', 'success');
}

function kbPdfEditorApplySelectedColor(showStatus) {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected || (selected.type !== 'text' && selected.type !== 'marker' && selected.type !== 'arrow')) return;
  selected.color = document.getElementById('kb-pdf-editor-color').value;
  kbPdfEditorRedraw();
  if (showStatus) kbPdfEditorStatus('Farbe der Auswahl aktualisiert.', 'success');
}

function kbPdfEditorApplySelectedLineWidth(showStatus) {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected || selected.type !== 'arrow') return;
  selected.lineWidth = kbPdfEditorLineWidth();
  kbPdfEditorRedraw();
  if (showStatus) kbPdfEditorStatus('Stärke des Zeigers aktualisiert.', 'success');
}

function kbPdfEditorApplySelectedText(showStatus) {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected || selected.type !== 'text') return;
  selected.text = document.getElementById('kb-pdf-editor-text').value;
  kbPdfEditorRedraw();
  if (showStatus) kbPdfEditorStatus('Text der Auswahl aktualisiert.', 'success');
}

function kbPdfEditorApplySelectedFontSize(showStatus) {
  var selected = kbPdfEditorSelectedAnnotation();
  if (!selected || selected.type !== 'text') return;
  selected.fontSize = Math.max(8, Math.min(48, Number(document.getElementById('kb-pdf-editor-size').value) || 14));
  kbPdfEditorRedraw();
  if (showStatus) kbPdfEditorStatus('Schriftgröße der Auswahl aktualisiert.', 'success');
}

function kbPdfEditorDeleteSelected() {
  var state = kbPdfEditorState;
  var selected = kbPdfEditorSelectedAnnotation();
  if (!state || !selected || !confirm('Dieses Element wirklich aus der PDF-Vorschau entfernen?')) return;
  state.annotations.splice(state.selectedAnnotationIndex, 1);
  kbPdfEditorClearSelection();
  kbPdfEditorRedraw();
  kbPdfEditorStatus('Auswahl entfernt.', 'success');
}

function kbPdfEditorHexToRgba(hex, opacity) {
  var clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) clean = '000000';
  return 'rgba(' + parseInt(clean.slice(0, 2), 16) + ',' + parseInt(clean.slice(2, 4), 16) + ',' + parseInt(clean.slice(4, 6), 16) + ',' + opacity + ')';
}

function kbPdfEditorRgb(hex) {
  var clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) clean = '000000';
  return window.PDFLib.rgb(parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255);
}

function kbPdfEditorSetTool(tool) {
  if (!kbPdfEditorState) return;
  kbPdfEditorState.tool = tool;
  Array.prototype.forEach.call(document.querySelectorAll('[data-kb-pdf-tool]'), function(button) {
    button.classList.toggle('active', button.getAttribute('data-kb-pdf-tool') === tool);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.kb-pdf-editor-canvas'), function(canvas) {
    canvas.classList.remove('kb-pdf-editor-dragging');
    canvas.style.cursor = tool === 'select' ? 'default' : (tool === 'marker' || tool === 'arrow' ? 'crosshair' : 'copy');
  });
}

function kbPdfEditorUpdateCanvasCursor(point, canvas) {
  var state = kbPdfEditorState;
  canvas = canvas || kbPdfEditorCanvasForPage(point && point.pageNumber || state && state.pageNumber);
  if (!state || !canvas || state.tool !== 'select') return;
  if (state.selectionDrag) {
    canvas.classList.add('kb-pdf-editor-dragging');
    return;
  }
  canvas.classList.remove('kb-pdf-editor-dragging');
  canvas.style.cursor = point && kbPdfEditorHitSelectedArrowHandle(point) ? 'crosshair' : (point && kbPdfEditorHitAnnotation(point) >= 0 ? 'grab' : 'default');
}

function kbPdfEditorUpdatePageControls() {
  var state = kbPdfEditorState;
  if (!state) return;
  var label = document.getElementById('kb-pdf-editor-page');
  var count = kbPdfEditorPageCount(state);
  if (!label) return;
  if (state.sourceType === 'image') {
    label.textContent = 'Bild wird angezeigt';
  } else {
    label.textContent = count === 1
      ? '1 Seite wird angezeigt'
      : count + ' Seiten werden vollständig untereinander angezeigt';
  }
}

function kbPdfEditorClamp(value, minimum, maximum, fallback) {
  var number = Number(value);
  if (!isFinite(number)) number = fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

// Umrechnung von Strichstaerke und Schriftgroesse in Bildpunkte. Bei einer PDF
// gibt der Zoom den Massstab. Bei einem Foto steht renderScale dagegen auf 1,
// waehrend das Canvas so gross ist wie die Aufnahme -- ein Strich von 10 waere
// dort ein Haar. Darum waechst die Einheit mit der Breite mit.
function kbPdfEditorDrawUnit(canvas, view) {
  return Math.max((view && view.renderScale) || 1, (canvas ? canvas.width : 0) / 1000);
}

function kbPdfEditorDrawArrow(context, annotation, canvas, view) {
  if (!canvas || !view) return;
  var startX = annotation.x * canvas.width;
  var startY = annotation.y * canvas.height;
  var endX = annotation.endX * canvas.width;
  var endY = annotation.endY * canvas.height;
  var angle = Math.atan2(endY - startY, endX - startX);
  var length = Math.hypot(endX - startX, endY - startY);
  if (length < 3) return;
  var unit = kbPdfEditorDrawUnit(canvas, view);
  var lineWidth = Math.max(2, (annotation.lineWidth || 2.5) * unit);
  // Die Spitze muss zur Staerke passen, sonst endet ein dicker Strich in einer Nadel.
  var headLength = Math.max(lineWidth * 3, Math.min(22 * unit, length * 0.17));
  context.save();
  context.strokeStyle = annotation.color || '#000000';
  context.fillStyle = annotation.color || '#000000';
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  context.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
  context.restore();
}

function kbPdfEditorDrawSelectionOutline(context, pageNumber, canvas) {
  var state = kbPdfEditorState;
  var selected = kbPdfEditorSelectedAnnotation();
  if (!state || !canvas || !selected || selected.pageNumber !== pageNumber) return;
  var bounds = kbPdfEditorAnnotationBounds(selected, pageNumber);
  if (!bounds) return;
  context.save();
  context.strokeStyle = selected.color || '#f1ae55';
  context.lineWidth = 2 * kbPdfEditorDrawUnit(canvas, kbPdfEditorPageView(pageNumber));
  if (selected.type !== 'arrow' && selected.type !== 'text') {
    context.setLineDash([6, 4]);
    context.strokeRect(bounds.x * canvas.width - 3, bounds.y * canvas.height - 3, bounds.width * canvas.width + 6, bounds.height * canvas.height + 6);
  }
  if (selected.type === 'arrow') {
    var handleRadius = Math.max(4, Math.min(canvas.width, canvas.height) * 0.008);
    context.setLineDash([]);
    context.fillStyle = '#ffffff';
    context.strokeStyle = selected.color || '#f1ae55';
    [
      { x: selected.x * canvas.width, y: selected.y * canvas.height },
      { x: selected.endX * canvas.width, y: selected.endY * canvas.height }
    ].forEach(function(handle) {
      context.beginPath();
      context.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  }
  context.restore();
}

function kbPdfEditorDrawAnnotation(context, annotation, canvas, view) {
  if (!canvas || !view) return;
  var x = annotation.x * canvas.width;
  var y = annotation.y * canvas.height;
  if (annotation.type === 'arrow') {
    kbPdfEditorDrawArrow(context, annotation, canvas, view);
    return;
  }
  if (annotation.type === 'marker') {
    context.save();
    context.fillStyle = kbPdfEditorHexToRgba(annotation.color, 0.36);
    context.fillRect(x, y, annotation.width * canvas.width, annotation.height * canvas.height);
    context.restore();
    return;
  }
  if (annotation.type === 'text') {
    var size = Math.max(8, annotation.fontSize * kbPdfEditorDrawUnit(canvas, view));
    context.save();
    context.fillStyle = annotation.color;
    context.font = '700 ' + size + 'px Roboto, Arial, sans-serif';
    context.textBaseline = 'top';
    String(annotation.text).split(/\r?\n/).forEach(function(line, index) {
      context.fillText(line, x, y + index * size * 1.25);
    });
    context.restore();
    return;
  }
  if (annotation.type === 'image') {
    var width = annotation.width * canvas.width;
    var height = annotation.height * canvas.height;
    if (annotation.imageElement && annotation.imageElement.complete) {
      context.drawImage(annotation.imageElement, x, y, width, height);
      return;
    }
    if (!annotation.imageLoading) {
      annotation.imageLoading = true;
      var image = new Image();
      image.onload = function() { annotation.imageElement = image; annotation.imageLoading = false; kbPdfEditorRedraw(); };
      image.onerror = function() { annotation.imageLoading = false; kbPdfEditorStatus('Das ausgewählte Foto konnte nicht dargestellt werden.', 'error'); };
      image.src = annotation.dataUrl;
    }
  }
}

function kbPdfEditorRedraw(pageNumber) {
  var state = kbPdfEditorState;
  if (!state || !state.pageViews) return;
  var pageNumbers = pageNumber ? [pageNumber] : Object.keys(state.pageViews).map(Number);
  pageNumbers.forEach(function(number) {
    var view = state.pageViews[number];
    if (!view || !view.canvas || !view.baseImageData) return;
    var canvas = view.canvas;
    var context = canvas.getContext('2d');
    context.putImageData(view.baseImageData, 0, 0);
    state.annotations.filter(function(annotation) { return annotation.pageNumber === number; }).forEach(function(annotation) {
      kbPdfEditorDrawAnnotation(context, annotation, canvas, view);
    });
    if (state.markerDraft && state.markerDraft.pageNumber === number) kbPdfEditorDrawAnnotation(context, state.markerDraft, canvas, view);
    if (state.arrowDraft && state.arrowDraft.pageNumber === number) kbPdfEditorDrawAnnotation(context, state.arrowDraft, canvas, view);
    kbPdfEditorDrawSelectionOutline(context, number, canvas);
  });
}

async function kbRenderDirectPdfEditorPages() {
  var state = kbPdfEditorState;
  if (!state) return;
  var container = document.getElementById('kb-pdf-editor-canvas-wrap');
  var pageList = document.getElementById('kb-pdf-editor-page-list');
  if (!container || !pageList) return;
  var renderKey = ++state.renderKey;
  var availableWidth = Math.max(260, (container.clientWidth || 760) - 32);
  pageList.innerHTML = '';
  state.pageViews = {};
  state.markerDraft = null;
  state.arrowDraft = null;
  if (state.sourceType === 'image') {
    await kbRenderDirectImageEditorPage(state, pageList, availableWidth, renderKey);
    return;
  }
  kbPdfEditorStatus('Alle ' + state.pdfDocument.numPages + ' Seiten werden vorbereitet …');
  for (var pageNumber = 1; pageNumber <= state.pdfDocument.numPages; pageNumber++) {
    var page = await state.pdfDocument.getPage(pageNumber);
    var baseViewport = page.getViewport({ scale: 1 });
    var scale = Math.min(1.55, Math.max(0.55, availableWidth / baseViewport.width));
    var viewport = page.getViewport({ scale: scale });
    if (kbPdfEditorState !== state || renderKey !== state.renderKey) return;
    var pageWrap = document.createElement('div');
    pageWrap.className = 'kb-pdf-editor-page';
    var label = document.createElement('div');
    label.className = 'kb-pdf-editor-page-label';
    label.textContent = 'Seite ' + pageNumber + ' / ' + state.pdfDocument.numPages;
    var canvas = document.createElement('canvas');
    canvas.className = 'kb-pdf-editor-canvas';
    canvas.dataset.kbPdfPage = String(pageNumber);
    canvas.setAttribute('aria-label', 'PDF Seite ' + pageNumber);
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.addEventListener('pointerdown', kbPdfEditorPointerDown);
    canvas.addEventListener('pointermove', kbPdfEditorPointerMove);
    canvas.addEventListener('pointerup', kbPdfEditorPointerUp);
    canvas.addEventListener('pointercancel', kbPdfEditorPointerUp);
    pageWrap.appendChild(label);
    pageWrap.appendChild(canvas);
    pageList.appendChild(pageWrap);
    var context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    if (kbPdfEditorState !== state || renderKey !== state.renderKey) return;
    state.pageViews[pageNumber] = {
      canvas: canvas,
      renderScale: scale,
      baseImageData: context.getImageData(0, 0, canvas.width, canvas.height)
    };
    kbPdfEditorRedraw(pageNumber);
  }
  kbPdfEditorUpdatePageControls();
}

async function kbRenderDirectImageEditorPage(state, pageList, availableWidth, renderKey) {
  var image = state && state.sourceImage;
  if (!image || !image.naturalWidth || !image.naturalHeight) throw new Error('Das Bild konnte nicht dargestellt werden.');
  kbPdfEditorStatus('Bild wird vorbereitet …');
  var scale = Math.min(1.5, Math.max(0.15, Math.min(availableWidth / image.naturalWidth, 3600 / image.naturalHeight)));
  var pageWrap = document.createElement('div');
  pageWrap.className = 'kb-pdf-editor-page';
  var label = document.createElement('div');
  label.className = 'kb-pdf-editor-page-label';
  label.textContent = 'Bild 1 / 1';
  var canvas = document.createElement('canvas');
  canvas.className = 'kb-pdf-editor-canvas';
  canvas.dataset.kbPdfPage = '1';
  canvas.setAttribute('aria-label', 'Bearbeitbares Bild');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.addEventListener('pointerdown', kbPdfEditorPointerDown);
  canvas.addEventListener('pointermove', kbPdfEditorPointerMove);
  canvas.addEventListener('pointerup', kbPdfEditorPointerUp);
  canvas.addEventListener('pointercancel', kbPdfEditorPointerUp);
  pageWrap.appendChild(label);
  pageWrap.appendChild(canvas);
  pageList.appendChild(pageWrap);
  if (kbPdfEditorState !== state || renderKey !== state.renderKey) return;
  var context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  state.pageViews[1] = {
    canvas: canvas,
    renderScale: scale,
    baseImageData: context.getImageData(0, 0, canvas.width, canvas.height)
  };
  kbPdfEditorRedraw(1);
  kbPdfEditorUpdatePageControls();
}

function kbPdfEditorLoadSourceImage(blob) {
  return new Promise(function(resolve, reject) {
    var objectUrl = URL.createObjectURL(blob);
    var image = new Image();
    image.onload = function() {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = function() {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Das Bild konnte nicht geladen werden.'));
    };
    image.src = objectUrl;
  });
}

async function kbOpenDirectPdfEditor(attachmentId) {
  if (!currentProfile || currentProfile.role !== 'admin') return;
  var located = kbFindRemoteAttachment(attachmentId);
  if (!located || located.attachment.mime_type !== 'application/pdf') return;
  if (!window.pdfjsLib || !window.PDFLib) {
    alert('Der PDF-Editor konnte nicht geladen werden. Bitte lade die Seite neu und versuche es erneut.');
    return;
  }
  var overlay = document.getElementById('kb-pdf-editor-overlay');
  var storedLayer = kbPdfEditorStoredLayer(located.attachment);
  var baseStoragePath = storedLayer && storedLayer.base_storage_path ? storedLayer.base_storage_path : located.attachment.storage_path;
  var savedAnnotations = kbPdfEditorStoredAnnotations(storedLayer && storedLayer.annotations);
  overlay.classList.add('visible');
  kbPdfEditorSetDocumentLabels('PDF', located.attachment.original_name);
  document.getElementById('kb-pdf-editor-text').value = '';
  kbPdfEditorStatus('PDF wird geladen …');
  try {
    var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(baseStoragePath, 60);
    if (signed.error) throw signed.error;
    var response = await fetch(signed.data.signedUrl);
    if (!response.ok) throw new Error('Die PDF konnte nicht geladen werden.');
    var sourceBytes = new Uint8Array(await response.arrayBuffer());
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var loadingTask = window.pdfjsLib.getDocument({ data: sourceBytes.slice() });
    var pdfDocument = await loadingTask.promise;
    kbPdfEditorState = {
      entry: located.entry,
      attachment: located.attachment,
      sourceType: 'pdf',
      sourceBytes: sourceBytes,
      pdfDocument: pdfDocument,
      pageNumber: 1,
      annotations: savedAnnotations,
      baseStoragePath: baseStoragePath,
      tool: 'select',
      markerDraft: null,
      arrowDraft: null,
      selectedAnnotationIndex: -1,
      selectionDrag: null,
      baseImageData: null,
      renderScale: 1,
      pageViews: {},
      renderKey: 0,
      isSaving: false
    };
    kbPdfEditorSetTool('select');
    kbPdfEditorUpdateSelectionUI();
    await kbRenderDirectPdfEditorPages();
    kbPdfEditorStatus('Bereit. Alle Seiten sind untereinander bearbeitbar. Ergänzungen bleiben bis zum Speichern nur in dieser Vorschau.', 'success');
  } catch (error) {
    kbCloseDirectPdfEditor();
    alert('PDF-Editor konnte nicht geöffnet werden: ' + (error && error.message ? error.message : 'Unbekannter Fehler'));
  }
}

async function kbOpenDirectImageEditor(attachmentId) {
  if (!currentProfile || currentProfile.role !== 'admin') return;
  var located = kbFindRemoteAttachment(attachmentId);
  if (!located || !remoteImageAttachment(located.attachment)) return;
  var overlay = document.getElementById('kb-pdf-editor-overlay');
  var storedLayer = kbPdfEditorStoredLayer(located.attachment);
  var baseStoragePath = storedLayer && storedLayer.base_storage_path ? storedLayer.base_storage_path : located.attachment.storage_path;
  var savedAnnotations = kbPdfEditorStoredAnnotations(storedLayer && storedLayer.annotations);
  overlay.classList.add('visible');
  kbPdfEditorSetDocumentLabels('Bild', located.attachment.original_name);
  document.getElementById('kb-pdf-editor-text').value = '';
  kbPdfEditorStatus('Bild wird geladen …');
  try {
    var signed = await supabaseClient.storage.from('knowledge-files').createSignedUrl(baseStoragePath, 60);
    if (signed.error) throw signed.error;
    var response = await fetch(signed.data.signedUrl);
    if (!response.ok) throw new Error('Das Bild konnte nicht geladen werden.');
    var sourceImage = await kbPdfEditorLoadSourceImage(await response.blob());
    kbPdfEditorState = {
      entry: located.entry,
      attachment: located.attachment,
      sourceType: 'image',
      sourceImage: sourceImage,
      pdfDocument: null,
      pageNumber: 1,
      annotations: savedAnnotations,
      baseStoragePath: baseStoragePath,
      tool: 'select',
      markerDraft: null,
      arrowDraft: null,
      selectedAnnotationIndex: -1,
      selectionDrag: null,
      baseImageData: null,
      renderScale: 1,
      pageViews: {},
      renderKey: 0,
      isSaving: false
    };
    kbPdfEditorSetTool('select');
    kbPdfEditorUpdateSelectionUI();
    await kbRenderDirectPdfEditorPages();
    kbPdfEditorStatus('Bereit. Das Bild kann wie eine PDF direkt bearbeitet werden.', 'success');
  } catch (error) {
    kbCloseDirectPdfEditor();
    alert('Bild-Editor konnte nicht geöffnet werden: ' + (error && error.message ? error.message : 'Unbekannter Fehler'));
  }
}

function kbCloseDirectPdfEditor() {
  var state = kbPdfEditorState;
  kbPdfEditorState = null;
  document.getElementById('kb-pdf-editor-overlay').classList.remove('visible');
  if (state && state.pdfDocument && typeof state.pdfDocument.destroy === 'function') state.pdfDocument.destroy();
}

async function kbPdfEditorChangePage(change) {
  var state = kbPdfEditorState;
  if (!state) return;
  var nextPage = state.pageNumber + change;
  if (nextPage < 1 || nextPage > kbPdfEditorPageCount(state)) return;
  state.pageNumber = nextPage;
  kbPdfEditorClearSelection();
  var canvas = kbPdfEditorCanvasForPage(nextPage);
  if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function kbPdfEditorCanvasPoint(event) {
  var canvas = event.currentTarget && event.currentTarget.classList && event.currentTarget.classList.contains('kb-pdf-editor-canvas')
    ? event.currentTarget
    : kbPdfEditorCanvasForPage(kbPdfEditorState && kbPdfEditorState.pageNumber);
  if (!canvas) return { pageNumber: 1, x: 0, y: 0 };
  var bounds = canvas.getBoundingClientRect();
  return {
    pageNumber: Number(canvas.dataset.kbPdfPage) || 1,
    x: Math.max(0, Math.min(1, ((event.clientX - bounds.left) * canvas.width / bounds.width) / canvas.width)),
    y: Math.max(0, Math.min(1, ((event.clientY - bounds.top) * canvas.height / bounds.height) / canvas.height))
  };
}

function kbPdfEditorStartSelection(event, point, selectedIndex, mode) {
  var state = kbPdfEditorState;
  if (!state || selectedIndex < 0) return false;
  state.selectedAnnotationIndex = selectedIndex;
  state.selectionDrag = { point: point, original: JSON.parse(JSON.stringify(state.annotations[selectedIndex])), mode: mode || 'move' };
  kbPdfEditorSetTool('select');
  kbPdfEditorUpdateSelectionUI();
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('kb-pdf-editor-dragging');
  kbPdfEditorRedraw();
  return true;
}

function kbPdfEditorPointerDown(event) {
  var state = kbPdfEditorState;
  if (!state || event.button !== 0) return;
  event.preventDefault();
  var point = kbPdfEditorCanvasPoint(event);
  state.pageNumber = point.pageNumber;
  var arrowHandle = kbPdfEditorHitSelectedArrowHandle(point);
  if (arrowHandle) {
    kbPdfEditorStartSelection(event, point, state.selectedAnnotationIndex, 'arrow-' + arrowHandle);
    return;
  }
  var selectedIndex = kbPdfEditorHitAnnotation(point);
  if (selectedIndex >= 0) {
    kbPdfEditorStartSelection(event, point, selectedIndex);
    return;
  }
  if (state.tool === 'select') {
    kbPdfEditorClearSelection();
    kbPdfEditorRedraw();
    return;
  }
  if (state.tool === 'marker') {
    state.markerDraft = { type: 'marker', pageNumber: point.pageNumber, startX: point.x, startY: point.y, x: point.x, y: point.y, width: 0, height: 0, color: document.getElementById('kb-pdf-editor-color').value };
    event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  if (state.tool === 'arrow') {
    state.arrowDraft = { type: 'arrow', pageNumber: point.pageNumber, x: point.x, y: point.y, endX: point.x, endY: point.y, color: document.getElementById('kb-pdf-editor-color').value, lineWidth: kbPdfEditorLineWidth() };
    event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  if (state.tool === 'text') {
    var text = document.getElementById('kb-pdf-editor-text').value.trim();
    if (!text) { kbPdfEditorStatus('Gib zuerst einen Hinweistext ein.', 'error'); return; }
    var size = Math.max(8, Math.min(48, Number(document.getElementById('kb-pdf-editor-size').value) || 14));
    state.annotations.push({ type: 'text', pageNumber: point.pageNumber, x: point.x, y: point.y, text: text, fontSize: size, color: document.getElementById('kb-pdf-editor-color').value });
    state.selectedAnnotationIndex = state.annotations.length - 1;
    kbPdfEditorSetTool('select');
    kbPdfEditorUpdateSelectionUI();
    kbPdfEditorRedraw();
    kbPdfEditorStatus('Text eingefügt. Jetzt direkt auf den Text ziehen, um ihn zu verschieben.', 'success');
    return;
  }
}

function kbPdfEditorMoveSelectedAnnotation(point) {
  var state = kbPdfEditorState;
  if (!state || !state.selectionDrag || state.selectedAnnotationIndex < 0) return;
  var annotation = state.annotations[state.selectedAnnotationIndex];
  var original = state.selectionDrag.original;
  if (!annotation || !original) return;
  var deltaX = point.x - state.selectionDrag.point.x;
  var deltaY = point.y - state.selectionDrag.point.y;
  if (annotation.type === 'arrow') {
    if (state.selectionDrag.mode === 'arrow-start') {
      annotation.x = point.x;
      annotation.y = point.y;
      return;
    }
    if (state.selectionDrag.mode === 'arrow-end') {
      annotation.endX = point.x;
      annotation.endY = point.y;
      return;
    }
    var startX = original.x + deltaX;
    var startY = original.y + deltaY;
    var endX = original.endX + deltaX;
    var endY = original.endY + deltaY;
    var correctionX = Math.min(0, startX, endX) + Math.max(0, Math.max(startX, endX) - 1);
    var correctionY = Math.min(0, startY, endY) + Math.max(0, Math.max(startY, endY) - 1);
    annotation.x = startX - correctionX;
    annotation.y = startY - correctionY;
    annotation.endX = endX - correctionX;
    annotation.endY = endY - correctionY;
  } else {
    var bounds = kbPdfEditorAnnotationBounds(original);
    annotation.x = kbPdfEditorClamp(original.x + deltaX, 0, Math.max(0, 1 - bounds.width), original.x);
    annotation.y = kbPdfEditorClamp(original.y + deltaY, 0, Math.max(0, 1 - bounds.height), original.y);
  }
}

function kbPdfEditorPointerMove(event) {
  var state = kbPdfEditorState;
  if (!state) return;
  var point = kbPdfEditorCanvasPoint(event);
  if (state.selectionDrag) {
    kbPdfEditorMoveSelectedAnnotation(point);
    kbPdfEditorRedraw();
    return;
  }
  if (state.tool === 'select') {
    kbPdfEditorUpdateCanvasCursor(point, event.currentTarget);
    return;
  }
  if (state.arrowDraft) {
    state.arrowDraft.endX = point.x;
    state.arrowDraft.endY = point.y;
    kbPdfEditorRedraw();
    return;
  }
  if (!state.markerDraft) return;
  state.markerDraft.x = Math.min(state.markerDraft.startX, point.x);
  state.markerDraft.y = Math.min(state.markerDraft.startY, point.y);
  state.markerDraft.width = Math.abs(point.x - state.markerDraft.startX);
  state.markerDraft.height = Math.abs(point.y - state.markerDraft.startY);
  kbPdfEditorRedraw();
}

function kbPdfEditorPointerUp(event) {
  var state = kbPdfEditorState;
  if (!state) return;
  if (state.selectionDrag) {
    var dragMode = state.selectionDrag.mode;
    state.selectionDrag = null;
    if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.classList.remove('kb-pdf-editor-dragging');
    kbPdfEditorUpdateCanvasCursor(kbPdfEditorCanvasPoint(event), event.currentTarget);
    kbPdfEditorRedraw();
    kbPdfEditorStatus(dragMode === 'arrow-start' || dragMode === 'arrow-end' ? 'Zeiger gedreht bzw. Länge angepasst.' : 'Auswahl verschoben.', 'success');
    return;
  }
  if (state.arrowDraft) {
    var arrow = state.arrowDraft;
    state.arrowDraft = null;
    if (Math.hypot(arrow.endX - arrow.x, arrow.endY - arrow.y) > 0.015) {
      state.annotations.push(arrow);
      state.selectedAnnotationIndex = state.annotations.length - 1;
      kbPdfEditorSetTool('select');
      kbPdfEditorUpdateSelectionUI();
      kbPdfEditorStatus('Zeiger eingefügt. Linie ziehen zum Verschieben; die runden Griffe drehen oder verlängern ihn.', 'success');
    }
    if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    kbPdfEditorRedraw();
    return;
  }
  if (!state.markerDraft) return;
  var marker = state.markerDraft;
  state.markerDraft = null;
  if (marker.width > 0.005 && marker.height > 0.005) {
    state.annotations.push(marker);
    state.selectedAnnotationIndex = state.annotations.length - 1;
    kbPdfEditorSetTool('select');
    kbPdfEditorUpdateSelectionUI();
    kbPdfEditorStatus('Markierung eingefügt. Sie kann jetzt direkt wieder ausgewählt und verschoben werden.', 'success');
  }
  if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  kbPdfEditorRedraw();
}

function kbPdfEditorUndo() {
  var state = kbPdfEditorState;
  if (!state) return;
  for (var index = state.annotations.length - 1; index >= 0; index--) {
    if (state.annotations[index].pageNumber === state.pageNumber) {
      state.annotations.splice(index, 1);
      kbPdfEditorClearSelection();
      kbPdfEditorRedraw();
      kbPdfEditorStatus('Letzte Aktion zurückgenommen.', 'success');
      return;
    }
  }
  kbPdfEditorStatus('Auf dieser Seite gibt es keine Ergänzungen.', 'error');
}

function kbPdfEditorClearCurrentPage() {
  var state = kbPdfEditorState;
  if (!state) return;
  var count = state.annotations.filter(function(annotation) { return annotation.pageNumber === state.pageNumber; }).length;
  if (!count || !confirm('Alle ' + count + ' Ergänzung' + (count === 1 ? '' : 'en') + ' auf dieser Seite entfernen?')) return;
  state.annotations = state.annotations.filter(function(annotation) { return annotation.pageNumber !== state.pageNumber; });
  kbPdfEditorClearSelection();
  kbPdfEditorRedraw();
  kbPdfEditorStatus('Seite wurde geleert. Du kannst die PDF jetzt speichern, auch wenn keine Ergänzungen mehr vorhanden sind.', 'success');
}


async function kbSaveDirectPdfEditor() {
  var state = kbPdfEditorState;
  if (!state || state.isSaving) return;
  if (state.sourceType === 'image') {
    await kbSaveDirectImageEditor();
    return;
  }
  if (!window.PDFLib) { kbPdfEditorStatus('Die PDF-Speicherfunktion ist nicht verfügbar.', 'error'); return; }
  state.isSaving = true;
  var saveButton = document.getElementById('kb-pdf-editor-save');
  saveButton.disabled = true;
  kbPdfEditorStatus('Bearbeitete PDF wird gespeichert …');
  try {
    var pdfDoc = await window.PDFLib.PDFDocument.load(state.sourceBytes);
    var font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
    var pages = pdfDoc.getPages();
    for (var index = 0; index < state.annotations.length; index++) {
      var annotation = state.annotations[index];
      var page = pages[annotation.pageNumber - 1];
      var pageSize = page.getSize();
      if (annotation.type === 'marker') {
        page.drawRectangle({
          x: annotation.x * pageSize.width,
          y: pageSize.height - (annotation.y + annotation.height) * pageSize.height,
          width: annotation.width * pageSize.width,
          height: annotation.height * pageSize.height,
          color: kbPdfEditorRgb(annotation.color),
          opacity: 0.36
        });
      } else if (annotation.type === 'arrow') {
        var arrowStart = { x: annotation.x * pageSize.width, y: pageSize.height - annotation.y * pageSize.height };
        var arrowEnd = { x: annotation.endX * pageSize.width, y: pageSize.height - annotation.endY * pageSize.height };
        var arrowAngle = Math.atan2(arrowEnd.y - arrowStart.y, arrowEnd.x - arrowStart.x);
        var arrowLength = Math.hypot(arrowEnd.x - arrowStart.x, arrowEnd.y - arrowStart.y);
        var arrowHead = Math.max(8, Math.min(18, arrowLength * 0.18));
        var arrowColor = kbPdfEditorRgb(annotation.color);
        page.drawLine({ start: arrowStart, end: arrowEnd, thickness: Math.max(1.5, annotation.lineWidth || 2.5), color: arrowColor });
        page.drawLine({
          start: arrowEnd,
          end: { x: arrowEnd.x - arrowHead * Math.cos(arrowAngle - Math.PI / 6), y: arrowEnd.y - arrowHead * Math.sin(arrowAngle - Math.PI / 6) },
          thickness: Math.max(1.5, annotation.lineWidth || 2.5), color: arrowColor
        });
        page.drawLine({
          start: arrowEnd,
          end: { x: arrowEnd.x - arrowHead * Math.cos(arrowAngle + Math.PI / 6), y: arrowEnd.y - arrowHead * Math.sin(arrowAngle + Math.PI / 6) },
          thickness: Math.max(1.5, annotation.lineWidth || 2.5), color: arrowColor
        });
      } else if (annotation.type === 'text') {
        var lineHeight = annotation.fontSize * 1.25;
        String(annotation.text).split(/\r?\n/).forEach(function(line, lineIndex) {
          page.drawText(line, {
            x: annotation.x * pageSize.width,
            y: pageSize.height - annotation.y * pageSize.height - annotation.fontSize - lineIndex * lineHeight,
            size: annotation.fontSize,
            font: font,
            color: kbPdfEditorRgb(annotation.color)
          });
        });
      } else if (annotation.type === 'image') {
        var imageBytes = await fetch(annotation.dataUrl).then(function(response) { return response.arrayBuffer(); });
        var embedded = annotation.mimeType === 'image/png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
        page.drawImage(embedded, {
          x: annotation.x * pageSize.width,
          y: pageSize.height - (annotation.y + annotation.height) * pageSize.height,
          width: annotation.width * pageSize.width,
          height: annotation.height * pageSize.height
        });
      }
    }
    var updatedBytes = await pdfDoc.save();
    var filename = state.attachment.original_name;
    var file = new File([updatedBytes], filename, { type: 'application/pdf' });
    await kbSaveEditablePdf(state.entry, state.attachment, file, state.baseStoragePath, state.annotations);
    await loadRemoteKnowledge();
    kbCloseDirectPdfEditor();
    // Die bearbeitete PDF liegt jetzt woanders. Ein offener Editor zeigt sonst
    // weiter die alte Fassung.
    if (typeof notebookRefreshInlineImageSources === 'function') notebookRefreshInlineImageSources();
    kbSetPdfTemplateHint('Bearbeitete PDF wurde ersetzt. Texte, Markierungen und Zeiger bleiben künftig editierbar.', 'success');
  } catch (error) {
    kbPdfEditorStatus('Speichern fehlgeschlagen: ' + (error && error.message ? error.message : 'Unbekannter Fehler'), 'error');
  } finally {
    if (kbPdfEditorState) kbPdfEditorState.isSaving = false;
    saveButton.disabled = false;
  }
}

function kbPdfEditorEnsureAnnotationImage(annotation) {
  if (!annotation || annotation.type !== 'image') return Promise.resolve();
  if (annotation.imageElement && annotation.imageElement.complete && annotation.imageElement.naturalWidth) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var image = new Image();
    image.onload = function() {
      annotation.imageElement = image;
      annotation.imageLoading = false;
      resolve();
    };
    image.onerror = function() {
      annotation.imageLoading = false;
      reject(new Error('Ein eingefügtes Foto konnte nicht geladen werden.'));
    };
    annotation.imageLoading = true;
    image.src = annotation.dataUrl;
  });
}

function kbPdfEditorCanvasBlob(canvas, mimeType) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (blob) resolve(blob);
      else reject(new Error('Das bearbeitete Bild konnte nicht erstellt werden.'));
    }, mimeType, mimeType === 'image/jpeg' ? 0.92 : undefined);
  });
}

function kbPdfEditorEditedImageName(attachment, mimeType) {
  var originalName = String(attachment && attachment.original_name || 'bild');
  var baseName = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[_\.]+|[_\.]+$/g, '');
  return (baseName || 'bild') + (mimeType === 'image/png' ? '.png' : '.jpg');
}

async function kbSaveDirectImageEditor() {
  var state = kbPdfEditorState;
  if (!state || state.isSaving || state.sourceType !== 'image') return;
  state.isSaving = true;
  var saveButton = document.getElementById('kb-pdf-editor-save');
  saveButton.disabled = true;
  kbPdfEditorStatus('Bearbeitetes Bild wird gespeichert …');
  try {
    await Promise.all(state.annotations.filter(function(annotation) { return annotation.type === 'image'; }).map(kbPdfEditorEnsureAnnotationImage));
    var sourceWidth = state.sourceImage.naturalWidth;
    var sourceHeight = state.sourceImage.naturalHeight;
    var maxPixels = 24000000;
    var exportScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, sourceWidth * sourceHeight)));
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.max(1, Math.round(sourceWidth * exportScale));
    exportCanvas.height = Math.max(1, Math.round(sourceHeight * exportScale));
    var context = exportCanvas.getContext('2d');
    context.drawImage(state.sourceImage, 0, 0, exportCanvas.width, exportCanvas.height);
    var exportView = { canvas: exportCanvas, renderScale: exportScale };
    state.annotations.forEach(function(annotation) {
      kbPdfEditorDrawAnnotation(context, annotation, exportCanvas, exportView);
    });
    var mimeType = state.attachment.mime_type === 'image/png' ? 'image/png' : 'image/jpeg';
    var blob = await kbPdfEditorCanvasBlob(exportCanvas, mimeType);
    var file = new File([blob], kbPdfEditorEditedImageName(state.attachment, mimeType), { type: mimeType, lastModified: Date.now() });
    await kbSaveEditableImage(state.entry, state.attachment, file, state.baseStoragePath, state.annotations);
    await loadRemoteKnowledge();
    kbCloseDirectPdfEditor();
    // Das bearbeitete Bild liegt jetzt woanders. Ein offener Notizbuch-Editor
    // zeigt sonst weiter die alte Fassung.
    if (typeof notebookRefreshInlineImageSources === 'function') notebookRefreshInlineImageSources();
    if (typeof kbSetPdfTemplateHint === 'function') kbSetPdfTemplateHint('Bearbeitetes Bild wurde ersetzt. Texte, Markierungen und Zeiger bleiben künftig editierbar.', 'success');
  } catch (error) {
    kbPdfEditorStatus('Speichern fehlgeschlagen: ' + (error && error.message ? error.message : 'Unbekannter Fehler'), 'error');
  } finally {
    if (kbPdfEditorState) kbPdfEditorState.isSaving = false;
    saveButton.disabled = false;
  }
}
