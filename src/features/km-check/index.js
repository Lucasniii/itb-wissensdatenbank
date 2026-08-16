var currentFile = null;
var errorRowsRef = [];
var frozenRowsRef = [];
var rawFileRef   = null;

var pruefInput = document.getElementById('pruef-file-input');
var pruefRun   = document.getElementById('pruef-run');
var pruefDrop  = document.getElementById('pruef-drop');

pruefInput.addEventListener('change', function(e) {
  if (e.target.files[0]) setPruefFile(e.target.files[0]);
});
pruefDrop.addEventListener('dragover',  function(e) { e.preventDefault(); pruefDrop.classList.add('drag-over'); });
pruefDrop.addEventListener('dragleave', function()  { pruefDrop.classList.remove('drag-over'); });
pruefDrop.addEventListener('drop', function(e) {
  e.preventDefault(); pruefDrop.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setPruefFile(e.dataTransfer.files[0]);
});

function setPruefFile(file) {
  currentFile = file;
  document.getElementById('pruef-filename').innerHTML = '<div class="filename-chip">✓ ' + file.name + '</div>';
  pruefRun.disabled = false;
  pruefDrop.classList.add('has-file');
  hidePruefResults();
  setStatus('pruef-status', '', '');
}

pruefRun.addEventListener('click', function() {
  if (!currentFile) return;
  pruefRun.disabled = true;
  document.getElementById('pruef-loading').classList.add('visible');
  hidePruefResults();
  setStatus('pruef-status', '', '');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      rawFileRef = e.target.result;
      var data = new Uint8Array(rawFileRef);
      var wb = XLSX.read(data, { type: 'array', cellStyles: true, cellNF: true, cellDates: true, sheetStubs: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      analyze(ws);
    } catch(err) {
      document.getElementById('pruef-loading').classList.remove('visible');
      setStatus('pruef-status', 'Fehler beim Lesen: ' + err.message, 'error');
      pruefRun.disabled = false;
    }
  };
  reader.readAsArrayBuffer(currentFile);
});

function cellVal(ws, r, c) {
  var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
  return cell ? cell.v : undefined;
}

function extractKennzeichen(str) {
  if (typeof str !== 'string') return null;
  // Geschuetzte Leerzeichen (\u00a0) normalisieren und Whitespace zusammenfassen.
  str = str.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  // Fahrzeug-Kennung wird strukturell erkannt, NICHT ueber das Kennzeichen-
  // Format (das je nach Land variiert). Zwei Kopfzeilen-Typen liefern dieselbe
  // Beschreibung, die als eindeutiges Fahrzeug-Label dient:
  //
  //   Titelzeile:  "Fahrten - 49 Marrach Wolfgang - WZ-946HL"
  //   Tageszeile:  "Mittwoch, 06.05.2026 / 49 Marrach Wolfgang - WZ-946HL"
  //
  // Rueckgabe ist die komplette Beschreibung hinter dem Trenner.

  // Tageszeile: <Wochentag>, <dd.mm.yyyy> / <Beschreibung>
  var day = str.match(/^\S+,\s*\d{2}\.\d{2}\.\d{4}\s*\/\s*(.+)$/);
  if (day) return day[1].trim();

  // Titelzeile: Fahrten - <Beschreibung>  (auch "Fahrten -" mit nbsp moeglich)
  var title = str.match(/^Fahrten\s*[-–]\s*(.+)$/i);
  if (title) return title[1].trim();

  return null;
}

function formatTime(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.getHours().toString().padStart(2,'0') + ':' + val.getMinutes().toString().padStart(2,'0');
  }
  if (typeof val === 'number' && val < 1) {
    var totalMin = Math.round(val * 24 * 60);
    var h = Math.floor(totalMin / 60);
    var min = totalMin % 60;
    return h.toString().padStart(2,'0') + ':' + min.toString().padStart(2,'0');
  }
  return String(val);
}

function analyze(ws) {
  var range = XLSX.utils.decode_range(ws['!ref']);
  var maxRow = range.e.r;
  var groups = [];
  var currentKZ = null;
  var currentGroup = null;
  var prevKmStand = null;
  var currentDatum = '—';

  for (var r = 0; r <= maxRow; r++) {
    var foundKZ = null;
    var foundDatum = null;
    for (var c = 0; c <= Math.min(range.e.c, 15); c++) {
      var v = cellVal(ws, r, c);
      if (typeof v === 'string') {
        if (!foundDatum) {
          var dm = v.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dm) foundDatum = dm[1] + '.' + dm[2] + '.' + dm[3];
        }
        var kz = extractKennzeichen(v);
        if (kz && !foundKZ) foundKZ = kz;
      }
    }
    if (foundDatum) currentDatum = foundDatum;

    if (foundKZ && foundKZ !== currentKZ) {
      currentKZ = foundKZ;
      currentGroup = { kz: foundKZ, rows: [], errorRows: [], frozenRows: [] };
      groups.push(currentGroup);
      prevKmStand = null;
      continue;
    }

    if (!currentGroup) continue;

    var kmStand = cellVal(ws, r, 10);
    var km      = cellVal(ws, r, 8);
    var start   = cellVal(ws, r, 0);
    var stop    = cellVal(ws, r, 1);

    if (typeof kmStand === 'number' && kmStand > 10000) {
      var kmVal = (typeof km === 'number') ? km : 0;
      var row = {
        excelRow: r + 1, datum: currentDatum,
        start: formatTime(start) || (start ? String(start) : ''),
        stop:  formatTime(stop)  || (stop  ? String(stop)  : ''),
        km: kmVal, kmStand: kmStand,
        error: false, expectedKm: null, frozen: false
      };

      // KM-Sprung-Fehler (Ist != Soll)
      if (prevKmStand !== null) {
        var diff = Math.round((kmStand - prevKmStand) * 10) / 10;
        var kmValRounded = Math.round(kmVal * 10) / 10;
        var abweichung = Math.round(Math.abs(kmValRounded - diff) * 10) / 10;
        // Toleranz: standardmaessig 0.1 km; bei aktivierter Option bis 1 km ignorieren
        var ignore1km = document.getElementById('pruef-ignore1km') && document.getElementById('pruef-ignore1km').checked;
        var toleranz = ignore1km ? 1 : 0.1;
        if (diff > 0 && abweichung > toleranz) {
          row.error = true;
          row.expectedKm = diff;
          currentGroup.errorRows.push(row);
          errorRowsRef.push(row);
        }
      }

      currentGroup.rows.push(row);
      prevKmStand = kmStand;
    }
  }

  // ── ZWEITER PASS: eingefrorene KM-Serien pro Gruppe erkennen ──
  // Eine Serie = aufeinanderfolgende Fahrten mit identischem KM-Stand.
  // Erreicht eine Serie >= FROZEN_THRESHOLD Fahrten, werden ALLE Zeilen
  // der Serie als frozen markiert – auch die allererste. Dadurch werden
  // auch von Anfang an unveraenderte KM-Staende korrekt erkannt.
  groups.forEach(function(g) {
    var i = 0;
    while (i < g.rows.length) {
      var j = i + 1;
      while (j < g.rows.length && g.rows[j].kmStand === g.rows[i].kmStand) j++;
      var seriesLen = j - i;
      if (seriesLen >= FROZEN_THRESHOLD) {
        for (var k = i; k < j; k++) {
          g.rows[k].frozen = true;
          g.frozenRows.push(g.rows[k]);
          frozenRowsRef.push(g.rows[k]);
        }
      }
      i = j;
    }
  });

  document.getElementById('pruef-loading').classList.remove('visible');
  showResults(groups);
  pruefRun.disabled = false;
}

function showResults(groups) {
  var totalTrips = 0, totalErrors = 0, totalFrozen = 0;
  groups.forEach(function(g) {
    totalTrips  += g.rows.length;
    totalErrors += g.errorRows.length;
    if (g.frozenRows.length > 0) totalFrozen++;
  });

  document.getElementById('stat-vehicles').textContent = groups.length;
  document.getElementById('stat-total').textContent    = totalTrips;
  document.getElementById('stat-errors').textContent   = totalErrors;
  document.getElementById('stat-frozen').textContent   = totalFrozen;

  var hasAnyIssue = totalErrors > 0 || totalFrozen > 0;
  var badgeParts = [];
  if (totalErrors > 0) badgeParts.push('<span class="badge badge-red">⚠ ' + totalErrors + ' KM-Fehler</span>');
  if (totalFrozen > 0) badgeParts.push('<span class="badge badge-orange">≡ ' + totalFrozen + ' Eingefrorene KM-Reihen</span>');
  document.getElementById('result-badge').innerHTML = hasAnyIssue
    ? badgeParts.join(' ')
    : '<span class="badge badge-green">✓ Alle Zeilen korrekt</span>';

  var chipsHtml = '';
  groups.forEach(function(g) {
    var hasErr = g.errorRows.length > 0, hasFrozen = g.frozenRows.length > 0;
    var cls, icon;
    if (hasErr && hasFrozen) { cls = 'mixed'; icon = '⚠ '; }
    else if (hasErr)         { cls = 'bad';   icon = '⚠ '; }
    else if (hasFrozen)      { cls = 'frozen';icon = '≡ '; }
    else                     { cls = 'good';  icon = '✓ '; }
    chipsHtml += '<div class="kz-chip ' + cls + '">' + icon + g.kz;
    var counts = [];
    if (g.errorRows.length  > 0) counts.push(g.errorRows.length + ' X');
    if (g.frozenRows.length > 0) counts.push(g.frozenRows.length + ' ≡');
    if (counts.length) chipsHtml += ' (' + counts.join(', ') + ')';
    chipsHtml += '</div>';
  });
  document.getElementById('kz-chips-wrap').innerHTML = chipsHtml;

  var content = document.getElementById('result-content');

  if (!hasAnyIssue) {
    content.innerHTML =
      '<div class="all-ok"><div class="big">✓ ALLES OK</div>' +
      '<div class="sub">Alle ' + totalTrips + ' Fahrten bei ' + groups.length + ' Fahrzeug(en) haben korrekte Kilometerangaben.</div></div>';
    document.getElementById('dl-row-wrap').style.display = 'none';
  } else {
    var html = '';
    groups.forEach(function(g) {
      var hasErr = g.errorRows.length > 0, hasFrozen = g.frozenRows.length > 0, hasAny = hasErr || hasFrozen;
      var headerCls = 'kz-header';
      if (hasErr && hasFrozen) headerCls += ' mixed-kz';
      else if (hasErr)         headerCls += ' error-kz';
      else if (hasFrozen)      headerCls += ' frozen-kz';
      var icon = hasErr ? '⚠' : (hasFrozen ? '≡' : '✓');
      html += '<div class="kz-section"><div class="' + headerCls + '" onclick="toggleSection(this)">';
      html += '<span>' + icon + '</span><span class="kz-name">' + g.kz + '</span>';
      if (hasAny) {
        var metaParts = [];
        if (g.errorRows.length  > 0) metaParts.push(g.errorRows.length  + ' KM-Fehler');
        if (g.frozenRows.length > 0) metaParts.push(g.frozenRows.length + ' Einger. KM');
        html += '<span class="kz-meta">' + metaParts.join(' / ') + ' &nbsp;|&nbsp; ' + g.rows.length + ' Fahrten</span>';
      } else {
        html += '<span class="kz-meta" style="color:var(--green)">' + g.rows.length + ' Fahrten – OK</span>';
      }
      html += '<span class="kz-toggle">▼</span></div>';
      var bodyCls = hasAny ? 'kz-body' : 'kz-body collapsed';
      html += '<div class="' + bodyCls + '">';
      if (hasAny) {
        if (hasFrozen) {
          html += '<div class="frozen-info">≡ KM-Stand blieb bei ' + g.frozenRows.length;
          html += (g.frozenRows.length === 1 ? ' Fahrt' : ' Fahrten');
          html += ' unveraendert (Schwelle: ' + FROZEN_THRESHOLD + ' Fahrten)</div>';
        }
        var allErrorRows = [];
        g.errorRows.forEach(function(r) { allErrorRows.push({ row: r, type: 'x' }); });
        g.frozenRows.forEach(function(r) { allErrorRows.push({ row: r, type: 'frozen' }); });
        allErrorRows.sort(function(a, b) { return a.row.excelRow - b.row.excelRow; });
        html += '<div class="error-table-wrap"><table>';
        html += '<thead><tr><th>Zeile</th><th>Kennzeichen</th><th>Datum</th><th>Zeit</th><th>KM-Stand</th><th>KM ist</th><th>KM soll</th><th>Status</th></tr></thead><tbody>';
        allErrorRows.forEach(function(entry) {
          var er = entry.row;
          html += '<tr><td>' + er.excelRow + '</td>';
          html += '<td><span style="color:var(--accent);font-weight:700">' + g.kz + '</span></td>';
          html += '<td style="color:var(--muted)">' + er.datum + '</td>';
          html += '<td>' + er.start + ' – ' + er.stop + '</td>';
          html += '<td>' + Math.round(er.kmStand).toLocaleString('de') + '</td>';
          if (entry.type === 'x') {
            html += '<td style="color:var(--red)">'   + er.km + '</td>';
            html += '<td style="color:var(--green)">' + er.expectedKm + '</td>';
            html += '<td><span class="tag-x">X</span></td>';
          } else {
            html += '<td style="color:var(--orange)">—</td>';
            html += '<td style="color:var(--muted)">—</td>';
            html += '<td><span class="tag-frozen">≡</span></td>';
          }
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<div class="ok-note">' + (g.rows.length - allErrorRows.length) + ' von ' + g.rows.length + ' Zeilen unauffaellig</div>';
      } else {
        html += '<div class="ok-note" style="color:var(--green)">✓ Alle ' + g.rows.length + ' Fahrten korrekt</div>';
      }
      html += '</div></div>';
    });
    content.innerHTML = html;
    document.getElementById('dl-row-wrap').style.display = 'flex';
    document.getElementById('dl-btn').onclick = downloadMarked;
  }
  document.getElementById('pruef-results').classList.add('visible');
}

function toggleSection(header) {
  var body = header.nextElementSibling;
  var toggle = header.querySelector('.kz-toggle');
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed'); toggle.textContent = '▼';
  } else {
    body.classList.add('collapsed'); toggle.textContent = '▶';
  }
}

function colLetter(n) {
  var s = ''; n += 1;
  while (n > 0) { var r = (n-1)%26; s = String.fromCharCode(65+r)+s; n = Math.floor((n-1)/26); }
  return s;
}

function downloadMarked() {
  JSZip.loadAsync(rawFileRef).then(function(zip) {
    var sheetKey = null;
    zip.forEach(function(path) {
      if (!sheetKey && path.match(/xl\/worksheets\/sheet\d+\.xml/)) sheetKey = path;
    });
    if (!sheetKey) { alert('Kein Sheet gefunden.'); return; }
    var stylesKey = 'xl/styles.xml';
    Promise.all([
      zip.file(sheetKey).async('string'),
      zip.file(stylesKey) ? zip.file(stylesKey).async('string') : Promise.resolve(null)
    ]).then(function(results) {
      var sheetXml = results[0], stylesXml = results[1];
      var styleIdxRed = 0, styleIdxOrange = 0;
      if (stylesXml) {
        var fillRed    = '<fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/><bgColor indexed="64"/></patternFill></fill>';
        var fillOrange = '<fill><patternFill patternType="solid"><fgColor rgb="FFFF8800"/><bgColor indexed="64"/></patternFill></fill>';
        var fillsMatch = stylesXml.match(/<fills count="(\d+)">/);
        if (fillsMatch) {
          stylesXml = stylesXml.replace(/<\/fills>/, fillRed + fillOrange + '</fills>');
          stylesXml = stylesXml.replace(/<fills count="\d+">/, '<fills count="' + (parseInt(fillsMatch[1])+2) + '">');
        }
        var fontXml = '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>';
        var fontsMatch = stylesXml.match(/<fonts count="(\d+)">/);
        var fontIdx = 0;
        if (fontsMatch) {
          fontIdx = parseInt(fontsMatch[1]);
          stylesXml = stylesXml.replace(/<\/fonts>/, fontXml + '</fonts>');
          stylesXml = stylesXml.replace(/<fonts count="\d+">/, '<fonts count="' + (fontIdx+1) + '">');
        }
        var allFills = stylesXml.match(/<fill>/g);
        var baseFillIdx = allFills ? allFills.length - 2 : 1;
        var orangeFillIdx = baseFillIdx + 1;
        var xfRed    = '<xf numFmtId="0" fontId="' + fontIdx + '" fillId="' + baseFillIdx   + '" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>';
        var xfOrange = '<xf numFmtId="0" fontId="' + fontIdx + '" fillId="' + orangeFillIdx + '" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>';
        var cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
        if (cellXfsMatch) {
          styleIdxRed    = parseInt(cellXfsMatch[1]);
          styleIdxOrange = styleIdxRed + 1;
          stylesXml = stylesXml.replace(/<\/cellXfs>/, xfRed + xfOrange + '</cellXfs>');
          stylesXml = stylesXml.replace(/<cellXfs count="\d+">/, '<cellXfs count="' + (styleIdxRed + 2) + '">');
        }
        zip.file(stylesKey, stylesXml);
      }
      var dimMatch = sheetXml.match(/<dimension ref="[^:]+:([A-Z]+)(\d+)"/);
      var lastColLetter = dimMatch ? dimMatch[1] : 'Y';
      var lastColIdx = 0;
      for (var ci = 0; ci < lastColLetter.length; ci++) lastColIdx = lastColIdx * 26 + lastColLetter.charCodeAt(ci) - 64;
      var xColLetter = colLetter(lastColIdx);
      var rowMarkMap = {};
      errorRowsRef.forEach(function(er) { rowMarkMap[er.excelRow] = 'x'; });
      frozenRowsRef.forEach(function(fr) { if (!rowMarkMap[fr.excelRow]) rowMarkMap[fr.excelRow] = 'frozen'; });
      sheetXml = sheetXml.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, function(match, rowNum, attrs, inner) {
        var rn = parseInt(rowNum);
        var markType = rowMarkMap[rn];
        if (!markType) return match;
        var cellRef = xColLetter + rowNum;
        if (inner.indexOf('r="' + cellRef + '"') !== -1) return match;
        var label    = markType === 'x' ? 'X' : '\u2261';
        var styleIdx = markType === 'x' ? styleIdxRed : styleIdxOrange;
        var newCell  = '<c r="' + cellRef + '" t="inlineStr" s="' + styleIdx + '"><is><t>' + label + '</t></is></c>';
        return '<row r="' + rowNum + '"' + attrs + '>' + inner + newCell + '</row>';
      });
      sheetXml = sheetXml.replace(/<dimension ref="([^:]+):([A-Z]+)(\d+)"/, function(m, start, col, row) {
        return '<dimension ref="' + start + ':' + xColLetter + row + '"';
      });
      zip.file(sheetKey, sheetXml);
      zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .then(function(blob) {
          var fname = currentFile.name.replace('.xlsx', '') + '_geprueft.xlsx';
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = fname; a.click();
          URL.revokeObjectURL(url);
        });
    });
  });
}

function hidePruefResults() {
  document.getElementById('pruef-results').classList.remove('visible');
  document.getElementById('dl-row-wrap').style.display = 'none';
  errorRowsRef  = [];
  frozenRowsRef = [];
}

function setStatus(id, msg, type) {
  var bar = document.getElementById(id);
  bar.textContent = msg;
  bar.className = 'status-bar' + (msg ? ' visible' : '') + (type ? ' ' + type : '');
}

/* ════════════════════════════════════════════════════════════════
   VIEW 2 – DECODER  (ZCONFIG + ZVALUE)
   ════════════════════════════════════════════════════════════════ */
