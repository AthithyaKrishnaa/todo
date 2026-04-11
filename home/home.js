/* ═══════════════════════════════════════════════════════════════
   SECOND BRAIN — home.js
   Security: auth guard on every load, RLS via Supabase,
             HTML escaping, input validation
   Buttons: every button has a direct addEventListener — no
            event delegation through templates
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Init Supabase ──────────────────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  }
});

/* ── DOM refs ───────────────────────────────────────────────── */
const authGuard      = document.getElementById('auth-guard');
const noteInput      = document.getElementById('note-input');
const charCountEl    = document.getElementById('char-count');
const saveBtn        = document.getElementById('save-btn');
const remindCheck    = document.getElementById('remind-check');
const remindInput    = document.getElementById('remind-input');
const reminderRow    = document.querySelector('.reminder-row');
const tagChips       = document.querySelectorAll('.tag-chip');
const notesLoading   = document.getElementById('notes-loading');
const notesList      = document.getElementById('notes-list');
const emptyState     = document.getElementById('empty-state');
const emptyTitle     = document.getElementById('empty-title');
const emptyDesc      = document.getElementById('empty-desc');
const searchInput    = document.getElementById('search-input');
const clearSearch    = document.getElementById('clear-search');
const filterBtns     = document.querySelectorAll('.filter-btn');
const noteBadge      = document.getElementById('note-badge');
const themeBtn       = document.getElementById('theme-btn');
const logoutBtn      = document.getElementById('logout-btn');
const toast          = document.getElementById('toast');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmMsg     = document.getElementById('confirm-msg');
const confirmCancel  = document.getElementById('confirm-cancel');
const confirmOk      = document.getElementById('confirm-ok');

/* ── Vault & Profile DOM ────────────────────────────────────── */
const navItems       = document.querySelectorAll('.nav-item');
const appSections    = document.querySelectorAll('.app-section');

const linkHeading    = !!document.getElementById('link-heading') ? document.getElementById('link-heading') : null;
const linkUrl        = document.getElementById('link-url');
const saveLinkBtn    = document.getElementById('save-link-btn');
const linksList      = document.getElementById('links-list');
const linksLoading   = document.getElementById('links-loading');

const docHeading     = document.getElementById('doc-heading');
const docFile        = document.getElementById('doc-file');
const docUploadStatus= document.getElementById('doc-upload-status');
const saveDocBtn     = document.getElementById('save-doc-btn');
const docsList       = document.getElementById('docs-list');
const docsLoading    = document.getElementById('docs-loading');

const profName       = document.getElementById('prof-name');
const profPhone      = document.getElementById('prof-phone');
const profEmail      = document.getElementById('prof-email');
const profResumeLink = document.getElementById('prof-resume-link');
const profGithub     = document.getElementById('prof-github');
const profLinkedin   = document.getElementById('prof-linkedin');
const profInternship = document.getElementById('prof-internship');
const profProject    = document.getElementById('prof-project');
const profCerts      = document.getElementById('prof-certs');
const profSaveStatus = document.getElementById('prof-save-status');
const saveProfBtn    = document.getElementById('save-prof-btn');
const shareOptions   = document.getElementById('share-options');
const copyProfBtn    = document.getElementById('copy-prof-btn');

/* ── Sidebar DOM ────────────────────────────────────────────── */
const sidebarItems   = document.querySelectorAll('.side-nav-item');

/* ── App state ──────────────────────────────────────────────── */
let currentUser    = null;
let allNotes       = [];
let activeFilter   = 'all';
let searchQuery    = '';
let toastTimer     = null;
let pendingDeleteId = null;
let allLinks       = [];
let allDocuments   = [];
let userProfile    = null;

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   Runs before anything is shown to the user.
═══════════════════════════════════════════════════════════════ */
async function initAuth() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) {
      window.location.replace('../login/index.html');
      return;
    }
    currentUser = session.user;
    authGuard.classList.add('hidden');
    await Promise.all([
      loadNotes(),
      loadLinks(),
      loadDocuments(),
      loadProfile()
    ]);
  } catch (err) {
    window.location.replace('../login/index.html');
  }
}

/* Re-check auth whenever the tab becomes visible again */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) window.location.replace('../login/index.html');
  }
});

/* ═══════════════════════════════════════════════════════════════
   SUPABASE CRUD
═══════════════════════════════════════════════════════════════ */

async function loadNotes() {
  try {
    const { data, error } = await sb
      .from('notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    allNotes = data || [];
  } catch (err) {
    showToast('Failed to load notes');
    allNotes = [];
  } finally {
    notesLoading.classList.add('hidden');
    renderNotes();
  }
}

async function createNote(content, tags, remindAt) {
  const note = {
    user_id:    currentUser.id,
    content:    content.trim(),
    tags:       tags,
    remind_at:  remindAt || null,
    done:       false,
    pinned:     false,
  };

  const { data, error } = await sb
    .from('notes')
    .insert([note])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateNote(id, fields) {
  const { error } = await sb
    .from('notes')
    .update(fields)
    .eq('id', id)
    .eq('user_id', currentUser.id);  // double-check ownership

  if (error) throw error;
}

async function deleteNoteById(id) {
  const { error } = await sb
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);  // double-check ownership

  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════
   SAVE NOTE
═══════════════════════════════════════════════════════════════ */
async function handleSave() {
  const content = noteInput.value.trim();
  if (!content) {
    noteInput.focus();
    showToast('Write something first');
    return;
  }

  const tags     = getSelectedTags();
  const remindAt = remindCheck.checked && remindInput.value ? remindInput.value : null;

  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  try {
    const newNote = await createNote(content, tags, remindAt);
    allNotes.unshift(newNote);
    resetCapture();
    renderNotes();
    showToast('Note saved ✓');
  } catch (err) {
    showToast('Save failed — try again');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save note';
  }
}

function resetCapture() {
  noteInput.value      = '';
  remindCheck.checked  = false;
  remindInput.value    = '';
  remindInput.classList.add('hidden');
  reminderRow.classList.remove('remind-active');
  charCountEl.textContent = '0 / 2000';
  charCountEl.classList.remove('warn');
  tagChips.forEach(c => c.setAttribute('aria-pressed', 'false'));
}

/* ═══════════════════════════════════════════════════════════════
   FILTER & SEARCH
═══════════════════════════════════════════════════════════════ */
function getFilteredNotes() {
  const today = new Date().toDateString();

  return allNotes.filter(note => {
    /* Filter tab */
    switch (activeFilter) {
      case 'today':
        if (new Date(note.created_at).toDateString() !== today) return false;
        break;
      case 'important':
        if (!note.tags.includes('important')) return false;
        break;
      case 'reminders':
        if (!note.remind_at) return false;
        break;
      case 'done':
        if (!note.done) return false;
        break;
      default: // 'all' — hide done notes
        if (note.done) return false;
    }

    /* Search */
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        note.content.toLowerCase().includes(q) ||
        note.tags.some(t => t.includes(q))
      );
    }

    return true;
  });
}

/* ═══════════════════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════════════════ */
function renderNotes() {
  const filtered = getFilteredNotes();

  notesList.innerHTML = '';

  if (filtered.length === 0) {
    notesList.classList.add('hidden');
    showEmptyState();
  } else {
    notesList.classList.remove('hidden');
    emptyState.classList.add('hidden');
    filtered.forEach(note => notesList.appendChild(buildCard(note)));
  }

  /* Badge = active (not done) notes */
  const active = allNotes.filter(n => !n.done).length;
  noteBadge.textContent = active;
}

function showEmptyState() {
  emptyState.classList.remove('hidden');
  const messages = {
    all:       ['Nothing captured yet', 'Write something above to get started.'],
    today:     ['Nothing today',         'No notes captured today.'],
    important: ['No important notes',    'Tag a note as Important to see it here.'],
    reminders: ['No reminders',          'Toggle "Remind me" when saving a note.'],
    done:      ['Nothing completed',     'Mark a note as done to see it here.'],
  };
  const [title, desc] = messages[activeFilter] || messages.all;
  emptyTitle.textContent = title;
  emptyDesc.textContent  = desc;
}

/* ── Build a single note card ───────────────────────────────── */
function buildCard(note) {
  const card = document.createElement('article');
  card.className = [
    'note-card',
    note.pinned ? 'pinned' : '',
    note.done   ? 'done'   : '',
  ].filter(Boolean).join(' ');
  card.dataset.id = note.id;

  /* ── Header row ── */
  const header = document.createElement('div');
  header.className = 'card-header';

  /* Tags */
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'card-tags';
  (note.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = `note-tag ${tag}`;
    span.textContent = tag;
    tagsDiv.appendChild(span);
  });

  /* Action buttons */
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const pinBtn = makeActionBtn(
    note.pinned ? '◈' : '◇',
    note.pinned ? 'Unpin note' : 'Pin note',
    note.pinned ? 'action-btn is-pinned' : 'action-btn'
  );

  const doneBtn = makeActionBtn(
    note.done ? '↺' : '✓',
    note.done ? 'Mark active' : 'Mark done',
    note.done ? 'action-btn is-done' : 'action-btn'
  );

  const delBtn = makeActionBtn('✕', 'Delete note', 'action-btn delete-btn');

  actionsDiv.append(pinBtn, doneBtn, delBtn);
  header.append(tagsDiv, actionsDiv);

  /* ── Content ── */
  const contentP = document.createElement('p');
  contentP.className = 'card-content';
  contentP.innerHTML = linkify(escapeHTML(note.content));

  /* ── Footer ── */
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'card-time';
  timeSpan.textContent = relativeTime(note.created_at);

  footer.appendChild(timeSpan);

  if (note.remind_at) {
    const remSpan = document.createElement('span');
    remSpan.className = 'card-reminder';
    remSpan.textContent = '⏰ ' + formatDatetime(note.remind_at);
    footer.appendChild(remSpan);
  }

  card.append(header, contentP, footer);

  /* ── Direct event listeners ── */
  pinBtn.addEventListener('click', async () => {
    const updated = !note.pinned;
    pinBtn.disabled = true;
    try {
      await updateNote(note.id, { pinned: updated });
      note.pinned = updated;
      // Re-sort: pinned notes at top
      allNotes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      renderNotes();
      showToast(updated ? 'Note pinned' : 'Unpinned');
    } catch {
      showToast('Action failed');
    } finally {
      pinBtn.disabled = false;
    }
  });

  doneBtn.addEventListener('click', async () => {
    const updated = !note.done;
    doneBtn.disabled = true;
    try {
      await updateNote(note.id, { done: updated });
      note.done = updated;
      renderNotes();
      showToast(updated ? 'Marked as done ✓' : 'Marked as active');
    } catch {
      showToast('Action failed');
    } finally {
      doneBtn.disabled = false;
    }
  });

  delBtn.addEventListener('click', () => {
    pendingDeleteId = note.id;
    confirmMsg.textContent = 'Delete this note? This cannot be undone.';
    confirmOverlay.classList.remove('hidden');
  });

  return card;
}

function makeActionBtn(label, ariaLabel, className) {
  const btn = document.createElement('button');
  btn.type        = 'button';
  btn.className   = className;
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.title       = ariaLabel;
  return btn;
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM DIALOG
═══════════════════════════════════════════════════════════════ */
confirmCancel.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
  pendingDeleteId = null;
});

confirmOk.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  confirmOverlay.classList.add('hidden');
  pendingDeleteId = null;

  /* Animate card out */
  const card = notesList.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 200));
  }

  try {
    await deleteNoteById(id);
    allNotes = allNotes.filter(n => n.id !== id);
    renderNotes();
    showToast('Note deleted');
  } catch {
    showToast('Delete failed');
    if (card) card.classList.remove('fade-out');
  }
});

/* Close overlay on background click */
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) {
    confirmOverlay.classList.add('hidden');
    pendingDeleteId = null;
  }
});

/* ═══════════════════════════════════════════════════════════════
   CAPTURE EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */

/* Save button */
saveBtn.addEventListener('click', handleSave);

/* Ctrl/Cmd + Enter */
noteInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
});

/* Character counter */
noteInput.addEventListener('input', () => {
  const len = noteInput.value.length;
  charCountEl.textContent = `${len} / 2000`;
  charCountEl.classList.toggle('warn', len > 1700);
});

/* Tag chips */
tagChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const pressed = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', String(!pressed));
  });
});

/* Reminder toggle */
remindCheck.addEventListener('change', () => {
  const on = remindCheck.checked;
  remindInput.classList.toggle('hidden', !on);
  reminderRow.classList.toggle('remind-active', on);
  if (on) {
    const d = new Date(Date.now() + 3600000);
    d.setSeconds(0, 0);
    remindInput.value = d.toISOString().slice(0, 16);
    remindInput.focus();
  }
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH & FILTER EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  clearSearch.classList.toggle('hidden', !searchQuery);
  renderNotes();
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearch.classList.add('hidden');
  renderNotes();
  searchInput.focus();
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    activeFilter = btn.dataset.filter;
    renderNotes();
  });
});

/* ═══════════════════════════════════════════════════════════════
   HEADER BUTTONS
═══════════════════════════════════════════════════════════════ */

/* Logout */
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await sb.auth.signOut();
    window.location.replace('../login/index.html');
  } catch {
    showToast('Sign out failed');
    logoutBtn.disabled = false;
  }
});

/* Theme toggle */
const THEME_KEY = 'sb-theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

function initTheme() {
  const saved     = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || preferred);
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function showToast(message, duration = 2400) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function getSelectedTags() {
  return [...tagChips]
    .filter(c => c.getAttribute('aria-pressed') === 'true')
    .map(c => c.dataset.tag);
}

/** Escape HTML to prevent XSS */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Wrap URLs in anchor tags (after escaping) */
function linkify(escaped) {
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

/** Clean URLs by removing tracking parameters */
function cleanURL(url) {
  try {
    const u = new URL(url);
    const paramsToRemove = ['usp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si', 'fbclid', 'igsh'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, ""); // Remove trailing slash if any
  } catch {
    return url; // Return as-is if not a valid URL
  }
}

/** Handle URL field input/paste for cleaning */
function initURLCleaners() {
  const urlInputs = document.querySelectorAll('input[type="url"]');
  urlInputs.forEach(input => {
    const handleClean = () => {
      const original = input.value.trim();
      const cleaned = cleanURL(original);
      if (original !== cleaned) {
        input.value = cleaned;
        showToast('Link cleaned & shortened! 🧹');
      }
    };
    input.addEventListener('paste', () => setTimeout(handleClean, 10));
    input.addEventListener('blur', handleClean);
  });
}

/** Relative time string */
function relativeTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const min   = Math.floor(diff / 60000);
  const hr    = Math.floor(diff / 3600000);
  const day   = Math.floor(diff / 86400000);

  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;

  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
    year: day > 365 ? 'numeric' : undefined,
  });
}

/** Format datetime for reminder badge */
function formatDatetime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/* Refresh relative timestamps every minute */
setInterval(() => {
  notesList.querySelectorAll('.card-time').forEach(el => {
    const card = el.closest('.note-card');
    if (!card) return;
    const note = allNotes.find(n => n.id === card.dataset.id);
    if (note) el.textContent = relativeTime(note.created_at);
  });
}, 60000);

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
function switchTab(targetId) {
  // Update state
  navItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  
  // Switch section
  appSections.forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));
}

if (navItems.length > 0) {
  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.target));
  });
}

if (sidebarItems.length > 0) {
  sidebarItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.target));
  });
}

/* ═══════════════════════════════════════════════════════════════
   VAULT: LINKS
═══════════════════════════════════════════════════════════════ */
async function loadLinks() {
  try {
    const { data, error } = await sb.from('links').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) throw error;
    allLinks = data || [];
  } catch {
    allLinks = [];
  } finally {
    if (linksLoading) linksLoading.classList.add('hidden');
    renderLinks();
  }
}

function renderLinks() {
  if (linksList) {
    linksList.innerHTML = '';
    linksList.classList.remove('hidden');
    allLinks.forEach(link => linksList.appendChild(buildLinkCard(link)));
  }
}

function buildLinkCard(link) {
  const card = document.createElement('article');
  card.className = 'note-card';
  card.innerHTML = `
    <div class="card-header">
      <h3 style="font-size: 15px; margin:0;" class="card-content">
        <a href="${escapeHTML(link.url)}" target="_blank">${escapeHTML(link.heading)}</a>
      </h3>
      <div class="card-actions">
        <button type="button" class="action-btn copy-link-btn" title="Copy Link">📋</button>
        <button type="button" class="action-btn delete-btn del-link-btn" title="Delete Link">✕</button>
      </div>
    </div>
    <div class="card-footer" style="margin-top:0.2rem">
      <span class="card-time" style="font-size:10px; word-break:break-all;">${escapeHTML(link.url)}</span>
    </div>
  `;
  
  card.querySelector('.copy-link-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      showToast('Link copied!');
    } catch {
      showToast('Copy failed');
    }
  });

  card.querySelector('.del-link-btn').addEventListener('click', async () => {
    if (confirm('Delete this link?')) {
      await sb.from('links').delete().eq('id', link.id);
      allLinks = allLinks.filter(l => l.id !== link.id);
      renderLinks();
      showToast('Link deleted');
    }
  });

  return card;
}

if (saveLinkBtn && linkHeading && linkUrl) {
  saveLinkBtn.addEventListener('click', async () => {
    const heading = linkHeading.value.trim();
    const url = linkUrl.value.trim();
    if (!heading || !url) return showToast('Enter heading and URL');
    
    saveLinkBtn.disabled = true;
    try {
      const { data, error } = await sb.from('links').insert([{ user_id: currentUser.id, heading, url }]).select().single();
      if (error) throw error;
      allLinks.unshift(data);
      linkHeading.value = '';
      linkUrl.value = '';
      renderLinks();
      showToast('Link saved');
    } catch {
      showToast('Failed to save link');
    } finally {
      saveLinkBtn.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   VAULT: DOCUMENTS
═══════════════════════════════════════════════════════════════ */
async function loadDocuments() {
  try {
    const { data, error } = await sb.from('documents').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) throw error;
    allDocuments = data || [];
  } catch {
    allDocuments = [];
  } finally {
    if (docsLoading) docsLoading.classList.add('hidden');
    renderDocuments();
  }
}

function renderDocuments() {
  if (docsList) {
    docsList.innerHTML = '';
    docsList.classList.remove('hidden');
    allDocuments.forEach(doc => docsList.appendChild(buildDocCard(doc)));
  }
}

function buildDocCard(doc) {
  const card = document.createElement('article');
  card.className = 'note-card';
  card.innerHTML = `
    <div class="card-header">
      <h3 style="font-size: 15px; margin:0;" class="card-content">${escapeHTML(doc.heading)}</h3>
      <div class="card-actions">
        <button type="button" class="action-btn download-doc-btn" title="Download">⬇️</button>
        <button type="button" class="action-btn delete-btn del-doc-btn" title="Delete">✕</button>
      </div>
    </div>
    <div class="card-footer" style="margin-top:0.2rem">
      <span class="card-time" style="font-size:10px; word-break:break-all;">${escapeHTML(doc.file_name)}</span>
    </div>
  `;
  
  card.querySelector('.download-doc-btn').addEventListener('click', async () => {
    try {
      showToast('Getting download link...');
      const { data, error } = await sb.storage.from('vault').createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      showToast('Download failed');
    }
  });

  card.querySelector('.del-doc-btn').addEventListener('click', async () => {
    if (confirm('Delete this document?')) {
      await sb.storage.from('vault').remove([doc.file_path]);
      await sb.from('documents').delete().eq('id', doc.id);
      allDocuments = allDocuments.filter(d => d.id !== doc.id);
      renderDocuments();
      showToast('Document deleted');
    }
  });

  return card;
}

if (saveDocBtn && docHeading && docFile) {
  saveDocBtn.addEventListener('click', async () => {
    const heading = docHeading.value.trim();
    if (!heading) return showToast('Enter document heading');
    if (!docFile.files[0]) return showToast('Select a file to upload');
    
    const file = docFile.files[0];
    const fileName = file.name;
    const fileExt = fileName.split('.').pop();
    const filePath = currentUser.id + '/' + Date.now() + '_' + Math.random().toString(36).substring(7) + '.' + fileExt;

    saveDocBtn.disabled = true;
    if (docUploadStatus) docUploadStatus.textContent = 'Uploading...';
    try {
      const { error: uploadError } = await sb.storage.from('vault').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data, error: dbError } = await sb.from('documents').insert([{ 
        user_id: currentUser.id, heading, file_path: filePath, file_name: fileName 
      }]).select().single();
      if (dbError) throw dbError;
      
      allDocuments.unshift(data);
      docHeading.value = '';
      docFile.value = '';
      renderDocuments();
      showToast('Document uploaded');
    } catch (err) {
      showToast('Upload failed');
    } finally {
      saveDocBtn.disabled = false;
      if (docUploadStatus) docUploadStatus.textContent = '';
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const { data, error } = await sb.from('profile').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    userProfile = data;
    
    if (userProfile) {
      if (profName)       profName.value = userProfile.name || '';
      if (profPhone)      profPhone.value = userProfile.phone || '';
      if (profEmail)      profEmail.value = userProfile.email || '';
      if (profResumeLink) profResumeLink.value = userProfile.resume_link || '';
      if (profGithub)     profGithub.value = userProfile.github || '';
      if (profLinkedin)   profLinkedin.value = userProfile.linkedin || '';
      if (profInternship) profInternship.value = userProfile.internship_link || '';
      if (profProject)    profProject.value = userProfile.project_link || '';
      if (profCerts)      profCerts.value = userProfile.certifications_link || '';
    }
  } catch (err) {
    console.error(err);
  } finally {
    buildShareOptions();
  }
}

if (saveProfBtn && profName) {
  saveProfBtn.addEventListener('click', async () => {
    saveProfBtn.disabled = true;
    if (profSaveStatus) profSaveStatus.textContent = 'Saving...';
    
    try {
      const payload = {
        user_id: currentUser.id,
        name: profName.value.trim(),
        phone: profPhone.value.trim(),
        email: profEmail.value.trim(),
        resume_link: profResumeLink.value.trim(),
        github: profGithub.value.trim(),
        linkedin: profLinkedin.value.trim(),
        internship_link: profInternship.value.trim(),
        project_link: profProject.value.trim(),
        certifications_link: profCerts.value.trim(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await sb.from('profile').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      
      userProfile = payload;
      showToast('Profile saved');
      buildShareOptions();
    } catch (e) {
      console.error(e);
      showToast('Failed to save profile');
    } finally {
      saveProfBtn.disabled = false;
      if (profSaveStatus) profSaveStatus.textContent = '';
    }
  });
}

function buildShareOptions() {
  if (!shareOptions) return;
  shareOptions.innerHTML = '';
  if (!userProfile) {
    shareOptions.innerHTML = '<span class="share-desc">Fill out your profile first.</span>';
    return;
  }
  
  const fields = [
    { key: 'name', label: 'Name', val: userProfile.name },
    { key: 'phone', label: 'Phone', val: userProfile.phone },
    { key: 'email', label: 'Mail id', val: userProfile.email },
    { key: 'resume', label: 'Resume Link', val: userProfile.resume_link },
    { key: 'github', label: 'GitHub', val: userProfile.github },
    { key: 'linkedin', label: 'LinkedIn', val: userProfile.linkedin },
    { key: 'internship', label: 'Internship Details', val: userProfile.internship_link },
    { key: 'project', label: 'Project Details', val: userProfile.project_link },
    { key: 'certs', label: 'Certifications Details', val: userProfile.certifications_link }
  ];
  
  let hasData = false;
  fields.forEach(f => {
    if (f.val) {
      hasData = true;
      const wrap = document.createElement('label');
      wrap.className = 'share-option';
      wrap.innerHTML = `<input type="checkbox" checked data-key="${f.key}" /> <span><b>${f.label}</b></span>`;
      shareOptions.appendChild(wrap);
    }
  });
  
  if (!hasData) {
    shareOptions.innerHTML = '<span class="share-desc">No details saved yet.</span>';
  }
}

if (copyProfBtn && shareOptions) {
  copyProfBtn.addEventListener('click', async () => {
    if (!userProfile) return;
    copyProfBtn.disabled = true;
    copyProfBtn.textContent = 'Preparing...';
    
    try {
      const allCheckboxes = shareOptions.querySelectorAll('input[type="checkbox"]');
      let checkedBoxes = Array.from(allCheckboxes).filter(cb => cb.checked);
      
      if (checkedBoxes.length === 0 && allCheckboxes.length > 0) {
        checkedBoxes = Array.from(allCheckboxes);
      } else if (checkedBoxes.length === 0) {
        showToast('Nothing to copy');
        return;
      }
      
      const keys = checkedBoxes.map(cb => cb.dataset.key);
      
      // Building a structured, aesthetic output
      let output = "";
      
      // Header
      if (keys.includes('name') && userProfile.name) {
        output += `👤 *${userProfile.name.toUpperCase()}*\n`;
        output += `━━━━━━━━━━━━━━━━━━━━\n`;
      } else {
        output += `📋 *PROFILE DETAILS*\n━━━━━━━━━━━━━━━━━━━━\n`;
      }

      // Contact Group
      let hasContact = false;
      if (keys.includes('phone') && userProfile.phone) { output += `📞 *Phone:* ${userProfile.phone}\n`; hasContact = true; }
      if (keys.includes('email') && userProfile.email) { output += `📧 *Email:* ${userProfile.email}\n`; hasContact = true; }
      
      // Portfolio Group
      let hasPortfolio = false;
      let portfolioStr = "\n🔗 *PORTFOLIO & LINKS*\n";
      if (keys.includes('github') && userProfile.github) { portfolioStr += `🌐 *GitHub:* ${userProfile.github}\n`; hasPortfolio = true; }
      if (keys.includes('linkedin') && userProfile.linkedin) { portfolioStr += `💼 *LinkedIn:* ${userProfile.linkedin}\n`; hasPortfolio = true; }
      if (hasPortfolio) output += portfolioStr;

      // Resources Group
      let hasResources = false;
      let resourceStr = "\n📁 *RESOURCES*\n";
      if (keys.includes('resume') && userProfile.resume_link) { resourceStr += `📝 *Resume:* ${userProfile.resume_link}\n`; hasResources = true; }
      if (keys.includes('internship') && userProfile.internship_link) { resourceStr += `🎓 *Internship:* ${userProfile.internship_link}\n`; hasResources = true; }
      if (keys.includes('project') && userProfile.project_link) { resourceStr += `🚀 *Projects:* ${userProfile.project_link}\n`; hasResources = true; }
      if (keys.includes('certs') && userProfile.certifications_link) { resourceStr += `📜 *Certifications:* ${userProfile.certifications_link}\n`; hasResources = true; }
      if (hasResources) output += resourceStr;

      output += `\n━━━━━━━━━━━━━━━━━━━━\n_Sent via Second Brain_`;
      
      await navigator.clipboard.writeText(output.trim());
      showToast('Aesthetic details copied! ✨');
    } catch (e) {
      console.error(e);
      showToast('Failed to copy');
    } finally {
      copyProfBtn.disabled = false;
      copyProfBtn.textContent = 'Copy Selected';
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
initTheme();
initAuth();   // runs auth guard, then loads notes
initURLCleaners();
