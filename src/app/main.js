/* Application bootstrap
   The feature files are loaded before this file. This keeps the existing
   global click handlers compatible while each feature stays independently owned. */

document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var view = tab.dataset.view;
    // Das Editor-Formular kann in der Bibliothek stehen. Es gehoert zurueck ins
    // Notizbuch, bevor die Ansicht wechselt.
    if (typeof kbLibraryEndInlineEditing === 'function') kbLibraryEndInlineEditing();
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('view-' + view).classList.add('active');
  });
});

// Unterreiter im Adminbereich. Wird auch von aussen aufgerufen, etwa wenn aus der
// Bibliothek heraus das Formular geoeffnet wird.
function showAdminSubview(name) {
  var panel = document.getElementById('admin-sub-' + name);
  if (!panel) return;
  if (typeof kbLibraryEndInlineEditing === 'function') kbLibraryEndInlineEditing();
  document.querySelectorAll('.admin-subtab').forEach(function(button) {
    button.classList.toggle('active', button.dataset.adminView === name);
  });
  document.querySelectorAll('.admin-subview').forEach(function(view) {
    view.classList.toggle('active', view === panel);
  });
}

document.querySelectorAll('.admin-subtab').forEach(function(button) {
  button.addEventListener('click', function() { showAdminSubview(button.dataset.adminView); });
});

adminRender();
notebookRender();

document.getElementById('auth-open').addEventListener('click', authOpen);
document.getElementById('auth-cancel').addEventListener('click', function() { setAuthOverlay(false); });
document.getElementById('auth-switch').addEventListener('click', function() { setAuthMode(!authSignUpMode); });
document.getElementById('auth-signout').addEventListener('click', async function() { await supabaseClient.auth.signOut(); currentSession = null; currentProfile = null; remoteKnowledgeEntries = []; updateAuthUI(); showActiveView('zconfig'); });
document.getElementById('kb-ai-form').addEventListener('submit', async function(event) { event.preventDefault(); await kbAiSearch(); });
document.getElementById('kb-ai-index').addEventListener('click', async function() { await kbAiIndexAll(); });
// Das Wissens-Formular ist entfallen. Bearbeitet und freigegeben wird in der
// Bibliothek, angelegt ueber den Import oder das Notizbuch.
document.getElementById('kb-pdf-editor-image').addEventListener('change', kbPdfEditorSelectImage);
document.getElementById('kb-pdf-editor-color').addEventListener('input', function() { kbPdfEditorApplySelectedColor(false); });
document.getElementById('kb-pdf-editor-color').addEventListener('change', function() { kbPdfEditorApplySelectedColor(true); });
document.getElementById('kb-pdf-editor-text').addEventListener('input', function() { kbPdfEditorApplySelectedText(false); });
document.getElementById('kb-pdf-editor-text').addEventListener('change', function() { kbPdfEditorApplySelectedText(true); });
document.getElementById('kb-pdf-editor-size').addEventListener('input', function() { kbPdfEditorApplySelectedFontSize(false); });
document.getElementById('kb-pdf-editor-size').addEventListener('change', function() { kbPdfEditorApplySelectedFontSize(true); });
document.getElementById('auth-form').addEventListener('submit', async function(event) {
  event.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var response;
  if (authSignUpMode) {
    response = await supabaseClient.auth.signUp({ email: email, password: password, options: { data: { display_name: document.getElementById('auth-name').value.trim() } } });
    if (!response.error) authMessage('Konto angelegt. Bitte bestätige gegebenenfalls die E-Mail und melde dich danach an.', 'success');
  } else {
    response = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (!response.error) setAuthOverlay(false);
  }
  if (response.error) authMessage(response.error.message, 'error');
});
document.getElementById('tech-entry-form').addEventListener('submit', async function(event) { event.preventDefault(); await submitTechnicianEntry(); });
initializeSupabase();
