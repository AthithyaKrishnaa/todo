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

/* ── App state ──────────────────────────────────────────────── */
let currentUser    = null;
let allNotes       = [];
let activeFilter   = 'all';
let searchQuery    = '';
let toastTimer     = null;
let pendingDeleteId = null;

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   Runs before anything is shown to the user.
═══════════════════════════════════════════════════════════════ */
async function initAuth() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) {
      window.location.replace('index.html');
      return;
    }
    currentUser = session.user;
    authGuard.classList.add('hidden');
    await loadNotes();
  } catch (err) {
    window.location.replace('index.html');
  }
}

/* Re-check auth whenever the tab becomes visible again */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) window.location.replace('index.html');
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
    window.location.replace('index.html');
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
   INIT
═══════════════════════════════════════════════════════════════ */
initTheme();
initAuth();   // runs auth guard, then loads notes
