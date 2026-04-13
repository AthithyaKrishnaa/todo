/**
 * SECOND BRAIN — home.js
 * Supabase client is initialized via <script src="config.js">
 */

const sb = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);

/* ── DOM References ─────────────────────────────────────────── */
const authGuard      = document.getElementById('auth-guard');
const logoutBtn      = document.getElementById('logout-btn');
const noteBadge      = document.getElementById('note-badge');

const noteInput      = document.getElementById('note-input');
const tagChips       = document.querySelectorAll('.tag-chip');
const saveBtn        = document.getElementById('save-btn');
const charCount      = document.getElementById('char-count');
const saveStatus     = document.getElementById('save-status');

const filterBtns     = document.querySelectorAll('.filter-btn');
const notesLoading   = document.getElementById('notes-loading');
const notesList      = document.getElementById('notes-list');
const emptyState     = document.getElementById('empty-state');

const statusCard     = document.getElementById('status-card');
const statusMsg      = document.getElementById('status-msg');
const statusBar     = document.getElementById('status-bar');

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmMsg     = document.getElementById('confirm-msg');
const confirmCancel  = document.getElementById('confirm-cancel');
const confirmOk      = document.getElementById('confirm-ok');

const navItems       = document.querySelectorAll('.nav-item');
const appSections    = document.querySelectorAll('.app-section');

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
let currentFilter  = 'pending';
let searchQuery    = '';
let pendingDeleteId= null;
let userProfile    = null;

/* ═══════════════════════════════════════════════════════════════
   AUTH & INITIALIZATION
═══════════════════════════════════════════════════════════════ */
// Always enforce the light theme for the Exceldent palette
document.documentElement.setAttribute('data-theme', 'light');

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.replace('../login/index.html');
    return;
  }
  currentUser = session.user;
  if (authGuard) authGuard.classList.add('hidden');
  
  loadNotes();
  loadProfile();
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.replace('../login/index.html');
  });
}

/* ═══════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════ */
function initTheme() {
  // Always light theme for the Exceldent palette
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('theme', 'light');
}

/* ═══════════════════════════════════════════════════════════════
   NOTES: LOAD & RENDER
═══════════════════════════════════════════════════════════════ */
async function loadNotes() {
  if (!currentUser) return;
  notesLoading.classList.remove('hidden');
  notesList.classList.add('hidden');
  emptyState.classList.add('hidden');

  const { data, error } = await sb
    .from('notes')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  notesLoading.classList.add('hidden');

  if (error) {
    showStatus('Failed to load notes');
    console.error(error);
    return;
  }

  allNotes = data || [];
  updateNoteBadge();
  renderNotes();
}

function updateNoteBadge() {
  if (noteBadge) noteBadge.textContent = allNotes.length;
}

function renderNotes() {
  notesList.innerHTML = '';
  const filtered = allNotes.filter(n => {
    if (currentFilter === 'pending')      return !n.done;
    if (currentFilter === 'accomplished') return n.done;
    return true; // fallback
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  notesList.classList.remove('hidden');
  filtered.forEach(n => {
    notesList.appendChild(renderNote(n));
  });
}

function renderNote(note) {
  const card = document.createElement('div');
  card.className = note.done ? 'note-card done' : 'note-card';

  /* ── Header ── */
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

  const delBtn = makeActionBtn('—', 'Delete note', 'action-btn delete-btn');

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
  
  if (note.done) {
     const start = new Date(note.created_at);
     const end = note.completed_at ? new Date(note.completed_at) : new Date(note.updated_at || note.created_at);
     const diffMs = end - start;
     const diffStr = getDurationString(diffMs);
     const startStr = start.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
     const endStr = end.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
     timeSpan.innerHTML = `Started: ${startStr}<br>Finished: ${endStr}<br>Elapsed: ${diffStr}`;
  } else {
     const startStr = new Date(note.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
     timeSpan.textContent = `Saved at: ${startStr}`;
  }
  
  footer.appendChild(timeSpan);

  card.append(header, contentP, footer);

  /* ── Events ── */
  pinBtn.addEventListener('click', async () => {
    const isPinned = !note.pinned;
    const { error } = await sb.from('notes').update({ pinned: isPinned }).eq('id', note.id);
    if (!error) {
      loadNotes();
      showStatus(isPinned ? 'Note pinned to top' : 'Note unpinned');
    }
  });

  doneBtn.addEventListener('click', async () => {
    const isNowDone = !note.done;
    const completedAt = isNowDone ? new Date().toISOString() : null;
    
    doneBtn.disabled = true;
    
    const { error } = await sb.from('notes').update({ 
      done: isNowDone,
      completed_at: completedAt
    }).eq('id', note.id);
    
    if (error) {
      console.error('Done toggle error:', error);
      showStatus('Failed to update note');
      doneBtn.disabled = false;
    } else {
      // Animate card exit then reload
      card.classList.add('exit');
      setTimeout(() => {
        loadNotes();
        showStatus(isNowDone ? 'Moved to Accomplished 🏆' : 'Moved back to Pending ↻');
      }, 350);
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
   NOTES: CREATE & DELETE
═══════════════════════════════════════════════════════════════ */
if (saveBtn) {
  saveBtn.addEventListener('click', saveNote);
}
if (noteInput) {
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNote();
    }
  });
  noteInput.addEventListener('input', () => {
    charCount.textContent = `${noteInput.value.length} / 2000`;
  });
}

async function saveNote() {
  const text = noteInput.value.trim();
  if (!text) return;

  saveBtn.disabled = true;
  saveStatus.textContent = 'Saving...';
  saveStatus.classList.remove('hidden');

  const selectedTags = Array.from(tagChips)
    .filter(c => c.getAttribute('aria-pressed') === 'true')
    .map(c => c.dataset.tag);

  const payload = {
    user_id: currentUser.id,
    content: text,
    tags: selectedTags
  };

  const { error } = await sb.from('notes').insert([payload]);

  saveBtn.disabled = false;
  saveStatus.classList.add('hidden');

  if (error) {
    showStatus('Failed to save note');
    console.error(error);
  } else {
    noteInput.value = '';
    charCount.textContent = '0 / 2000';
    tagChips.forEach(c => c.setAttribute('aria-pressed', 'false'));
    loadNotes();
    showStatus('Note captured');
  }
}

if (confirmOk) {
  confirmOk.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const { error } = await sb.from('notes').delete().eq('id', pendingDeleteId);
    confirmOverlay.classList.add('hidden');
    if (error) {
      showStatus('Failed to delete');
    } else {
      loadNotes();
      showStatus('Note deleted forever 🗑️');
    }
  });
}
if (confirmCancel) {
  confirmCancel.addEventListener('click', () => confirmOverlay.classList.add('hidden'));
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH & FILTERS
═══════════════════════════════════════════════════════════════ */
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderNotes();
  });
});

/* ═══════════════════════════════════════════════════════════════
   TAG CHIPS
═══════════════════════════════════════════════════════════════ */
tagChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const pressed = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', !pressed);
  });
});



/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */
/** Premium Status Feedback Card */
function showStatus(msg) {
  if (!statusCard || !statusMsg || !statusBar) return;
  
  // Clear any existing timeout
  if (statusCard._timer) clearTimeout(statusCard._timer);
  
  // Reset
  statusCard.classList.remove('visible', 'active');
  void statusCard.offsetWidth; // Trigger reflow
  
  // Update & Show
  statusMsg.textContent = msg;
  statusCard.classList.add('visible', 'active');
  
  // Auto-hide after 3s (matches CSS animation)
  statusCard._timer = setTimeout(() => {
    statusCard.classList.remove('visible', 'active');
  }, 3000);
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
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
        showStatus('Cleaned! 🧹');
      }
    };
    input.addEventListener('paste', () => setTimeout(handleClean, 10));
    input.addEventListener('blur', handleClean);
  });
}

/** Shorten URL using is.gd API */
async function shortenURL(url) {
  if (!url || url.length < 25) return url;
  try {
    const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return data.shorturl || url;
  } catch {
    return url;
  }
}

/** Duration string */
function getDurationString(diffMs) {
  if (diffMs < 0) return '0 seconds';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} seconds`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minutes`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hours`;
  const days = Math.floor(hr / 24);
  return `${days} days`;
}

/** Relative time string */
function relativeTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const day   = 86400000, hr = 3600000, min = 60000;
  if (diff < min) return 'Just now';
  if (diff < hr)  return Math.floor(diff/min) + 'm ago';
  if (diff < day) return Math.floor(diff/hr) + 'h ago';
  return new Date(iso).toLocaleDateString();
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
function switchTab(targetId) {
  // Update state
  navItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  
  // Switch section
  appSections.forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));

  // HYBRID LAYOUT: Lock body scroll only for Notes section
  if (targetId === 'section-notes') {
    document.body.classList.add('locked-mode');
  } else {
    document.body.classList.remove('locked-mode');
  }
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
      showStatus('Profile saved');
      buildShareOptions();
    } catch (e) {
      console.error(e);
      showStatus('Failed to save profile');
    } finally {
      saveProfBtn.disabled = false;
      if (profSaveStatus)      profSaveStatus.textContent = '';
      showStatus('Profile updated successfully ✨');
      loadProfile();
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
  copyProfBtn.addEventListener('click', () => {
    if (!userProfile) return;
    
    try {
      const allCheckboxes = shareOptions.querySelectorAll('input[type="checkbox"]');
      let checkedBoxes = Array.from(allCheckboxes).filter(cb => cb.checked);
      const includeWatermark = document.getElementById('include-watermark')?.checked ?? true;
      
      if (checkedBoxes.length === 0 && allCheckboxes.length > 0) {
        checkedBoxes = Array.from(allCheckboxes);
      } else if (checkedBoxes.length === 0) {
        showStatus('Nothing to copy');
        return;
      }
      
      const keys = checkedBoxes.map(cb => cb.dataset.key);
      const p = userProfile;
      
      // FINAL Grouped Text Format
      let output = "";
      
      // 1. Name
      if (keys.includes('name') && p.name) {
        output += `${p.name.toUpperCase()}\n\n`;
      }

      // 2. Contact Information
      const contactKeys = ['phone', 'email'];
      if (contactKeys.some(k => keys.includes(k) && p[k])) {
        output += `Contact Information\n`;
        if (keys.includes('phone') && p.phone) output += `Phone: ${p.phone}\n`;
        if (keys.includes('email') && p.email) output += `Email: ${p.email}\n`;
        output += `\n`;
      }

      // 3. Professional Profiles
      const socialKeys = ['github', 'linkedin'];
      if (socialKeys.some(k => keys.includes(k) && p[k])) {
        output += `Professional Profiles\n`;
        if (keys.includes('github') && p.github) output += `GitHub: ${p.github}\n`;
        if (keys.includes('linkedin') && p.linkedin) output += `LinkedIn: ${p.linkedin}\n`;
        output += `\n`;
      }

      // 4. Resume
      if (keys.includes('resume') && p.resume_link) {
        output += `Resume\nResume Link: ${p.resume_link}\n\n`;
      }

      // 5. Documents & Resources
      const docKeys = ['internship', 'project', 'certs'];
      if (docKeys.some(k => keys.includes(k) && p[`${k}_link`])) {
        output += `Documents & Resources\n`;
        if (keys.includes('internship') && p.internship_link) output += `Internships: ${p.internship_link}\n`;
        if (keys.includes('project') && p.project_link) output += `Projects: ${p.project_link}\n`;
        if (keys.includes('certs') && p.certifications_link) output += `Certifications: ${p.certifications_link}\n`;
        output += `\n`;
      }

      if (includeWatermark) {
        output += `──────────────────────────\nGenerated via Second Brain`;
      }
      
      navigator.clipboard.writeText(output.trim());
      showStatus('Details copied to clipboard ✨');
    } catch (e) {
      console.error(e);
      showStatus('Failed to copy');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
initTheme();
initAuth();   // runs auth guard, then loads notes
initURLCleaners();

// Apply locked-mode on initial load for the Notes section
document.body.classList.add('locked-mode');
