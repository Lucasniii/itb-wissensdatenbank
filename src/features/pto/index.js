var mergeFiles = [];
var mergeAnalysisCache = new Map();
var mergeInput = document.getElementById('merge-file-input');
var mergeDrop  = document.getElementById('merge-drop');

mergeInput.addEventListener('change', function(e) {
  addMergeFiles(Array.from(e.target.files));
  mergeInput.value = '';
});
mergeDrop.addEventListener('dragover',  function(e) { e.preventDefault(); mergeDrop.classList.add('drag-over'); });
mergeDrop.addEventListener('dragleave', function()  { mergeDrop.classList.remove('drag-over'); });
mergeDrop.addEventListener('drop', function(e) {
  e.preventDefault(); mergeDrop.classList.remove('drag-over');
  var files = Array.from(e.dataTransfer.files).filter(function(f) { return f.name.toLowerCase().endsWith('.xlsx'); });
  addMergeFiles(files);
});

function addMergeFiles(files) {
  files.forEach(function(f) { mergeFiles.push(f); });
  renderMergeList();
  analyzeMergeFiles();
}

function renderMergeList() {
  var list = document.getElementById('merge-list');
  if (mergeFiles.length === 0) {
    list.innerHTML = '';
    mergeDrop.classList.remove('has-file');
    return;
  }
  mergeDrop.classList.add('has-file');
  var html = '';
  mergeFiles.forEach(function(f, i) {
    html += '<div class="file-item">';
    html += '<span class="idx">' + (i+1) + '.</span>';
    html += '<span class="name">' + f.name + '</span>';
    html += '<span class="actions"><button class="icon-btn del" onclick="removeMerge(' + i + ')" title="entfernen">✕</button></span>';
    html += '</div>';
  });
  list.innerHTML = html;
}

function removeMerge(idx) {
  mergeFiles.splice(idx, 1);
  renderMergeList();
  setStatus('merge-status', '', '');
  renderKzOverview();
}

function analyzeFileForInput(file) {
  if (mergeAnalysisCache.has(file)) return Promise.resolve(mergeAnalysisCache.get(file));
  return readFileBuf(file).then(function(buf) {
    var data = new Uint8Array(buf);
    var wb = XLSX.read(data, { type: 'array', sheetStubs: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws || !ws['!ref']) return { kzMap: {} };
    var range = XLSX.utils.decode_range(ws['!ref']);
    var maxRow = range.e.r, maxCol = Math.min(range.e.c, 20);
    var currentKZ = null, kzMap = {};
    for (var r = 0; r <= maxRow; r++) {
      var rowKZ = null, rowHasInput = false, rowHasPTO = false;
      for (var c = 0; c <= maxCol; c++) {
        var v = cellVal(ws, r, c);
        if (typeof v !== 'string') continue;
        if (!rowKZ) {
          var km = v.match(/\/\s*([A-Z]{1,3}\s*\d{1,4}\s*[A-Z]{1,3})\b/);
          if (km) rowKZ = km[1].replace(/\s+/g, ' ').trim().toUpperCase();
        }
        if (/Input\s*\d+\s*ein/i.test(v)) rowHasInput = true;
        if (/^[o0-9]{6}$/i.test(v) && /[1-9]/.test(v)) rowHasInput = true;
        if (/\bNA\s*ein\b/i.test(v)) rowHasPTO = true;
      }
      if (rowKZ) {
        currentKZ = rowKZ;
        if (!kzMap[currentKZ]) kzMap[currentKZ] = { hasInput: false, hasPTO: false, count: 0, ptoCount: 0 };
      }
      if (rowHasInput && currentKZ) { kzMap[currentKZ].hasInput = true; kzMap[currentKZ].count++; }
      if (rowHasPTO  && currentKZ) { kzMap[currentKZ].hasPTO  = true; kzMap[currentKZ].ptoCount++; }
    }
    var result = { kzMap: kzMap };
    mergeAnalysisCache.set(file, result);
    return result;
  }).catch(function() { return { kzMap: {} }; });
}

function analyzeMergeFiles() {
  if (mergeFiles.length === 0) { renderKzOverview(); return; }
  document.getElementById('merge-loading').classList.add('visible');
  Promise.all(mergeFiles.map(analyzeFileForInput)).then(function(results) {
    var combined = {};
    results.forEach(function(res) {
      Object.keys(res.kzMap).forEach(function(kz) {
        if (!combined[kz]) combined[kz] = { hasInput: false, hasPTO: false, count: 0, ptoCount: 0 };
        if (res.kzMap[kz].hasInput) combined[kz].hasInput = true;
        if (res.kzMap[kz].hasPTO)   combined[kz].hasPTO   = true;
        combined[kz].count    += res.kzMap[kz].count;
        combined[kz].ptoCount += (res.kzMap[kz].ptoCount || 0);
      });
    });
    document.getElementById('merge-loading').classList.remove('visible');
    renderKzOverview(combined);
  }).catch(function(err) {
    document.getElementById('merge-loading').classList.remove('visible');
    setStatus('merge-status', 'Fehler bei Analyse: ' + err.message, 'error');
  });
}

function renderKzOverview(combined) {
  var box = document.getElementById('merge-kz-overview');
  var chipsEl = document.getElementById('merge-kz-chips');
  var countEl = document.getElementById('merge-kz-count');
  if (!combined || Object.keys(combined).length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  var kzList = Object.keys(combined).sort();
  var active = kzList.filter(function(k) { return combined[k].hasInput; });
  countEl.textContent = active.length + ' von ' + kzList.length + ' aktiv';
  var html = '<div class="kz-chips" style="margin-bottom:0">';
  kzList.forEach(function(kz) {
    var info = combined[kz];
    if (info.hasInput) {
      html += '<div class="kz-chip active" title="' + info.count + ' PTO-Events">⚙ ' + kz + ' (' + info.count + ')</div>';
    } else {
      html += '<div class="kz-chip idle">○ ' + kz + '</div>';
    }
  });
  html += '</div>';
  chipsEl.innerHTML = html;
}

function readFileBuf(f) {
  return new Promise(function(res, rej) {
    var fr = new FileReader();
    fr.onload = function(e) { res(e.target.result); };
    fr.onerror = function() { rej(new Error('Konnte ' + f.name + ' nicht lesen')); };
    fr.readAsArrayBuffer(f);
  });
}

/* ════════════════════════════════════════════════════════════════
   ZENTRALE WISSENSDATENBANK – SUPABASE
   ════════════════════════════════════════════════════════════════ */
