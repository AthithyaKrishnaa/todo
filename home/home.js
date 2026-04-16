

const sb = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);


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
const profPortfolio  = document.getElementById('prof-portfolio');
const profSaveStatus = document.getElementById('prof-save-status');
const saveProfBtn    = document.getElementById('save-prof-btn');
const shareOptions   = document.getElementById('share-options');
const copyProfBtn    = document.getElementById('copy-prof-btn');
const shareLinkBtn   = document.getElementById('share-link-btn');


const avatarImg      = document.getElementById('avatar-img');
const avatarPlaceholder = document.getElementById('avatar-placeholder');
const avatarUploadBtn = document.getElementById('avatar-upload-btn');
const avatarDeleteBtn = document.getElementById('avatar-delete-btn');
const avatarFileInput = document.getElementById('avatar-file-input');


const resumeFileInput = document.getElementById('resume-file-input');
const resumeUploadBtn = document.getElementById('resume-upload-btn');
const resumeFileName  = document.getElementById('resume-file-name');


const cropperOverlay     = document.getElementById('cropper-overlay');
const cropperImage       = document.getElementById('cropper-image');
const cropperCloseBtn     = document.getElementById('cropper-close-btn');
const cropperCancelBtn    = document.getElementById('cropper-cancel-btn');
const cropperConfirmBtn   = document.getElementById('cropper-confirm-btn');


const sidebarItems   = document.querySelectorAll('.side-nav-item');


let currentUser    = null;
let allNotes       = [];
let currentFilter  = 'pending';
let searchQuery    = '';
let pendingDeleteId= null;
let userProfile    = null;
let cropperInstance = null;


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


function initTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('theme', 'light');
}


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
}

function renderNotes() {
  notesList.innerHTML = '';
  const filtered = allNotes.filter(n => {
    if (currentFilter === 'pending')      return !n.done;
    if (currentFilter === 'accomplished') return n.done;
    return true;
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

  
  const header = document.createElement('div');
  header.className = 'card-header';

  
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'card-tags';
  (note.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = `note-tag ${tag}`;
    span.textContent = tag;
    tagsDiv.appendChild(span);
  });

  
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.79-.9A.5.5 0 0 1 16 12.1V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7.1a.5.5 0 0 1-.1.41l-1.79.9A2 2 0 0 0 5 15.24V17z"></path></svg>`;
  const doneSvg = note.done
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const delSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;

  const pinBtn = makeActionBtn(
    pinSvg,
    note.pinned ? 'Unpin note' : 'Pin note',
    note.pinned ? 'action-btn pin-btn' + (note.pinned ? ' is-pinned' : '') : 'action-btn pin-btn'
  );

  const doneBtn = makeActionBtn(
    doneSvg,
    note.done ? 'Mark active' : 'Mark done',
    note.done ? 'action-btn done-btn is-done' : 'action-btn done-btn'
  );

  const delBtn = makeActionBtn(delSvg, 'Delete note', 'action-btn delete-btn');

  actionsDiv.append(pinBtn, doneBtn, delBtn);
  header.append(tagsDiv, actionsDiv);

  
  const contentP = document.createElement('p');
  contentP.className = 'card-content';
  contentP.innerHTML = linkify(escapeHTML(note.content));

  card.append(header, contentP);

  
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

    doneBtn.disabled = true;

    const { error } = await sb.from('notes').update({
      done: isNowDone
    }).eq('id', note.id);

    if (error) {
      console.error('Done toggle error:', JSON.stringify(error));
      showStatus('Failed: ' + (error.message || 'Unknown error'));
      doneBtn.disabled = false;
    } else {
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
  btn.innerHTML   = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.title       = ariaLabel;
  return btn;
}


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

    if (pendingDeleteId === '__AVATAR__') {
      confirmOverlay.classList.add('hidden');
      avatarDeleteBtn.disabled = true;
      showStatus('Removing photo...');
      try {
        const { error: dbError } = await sb
          .from('profile')
          .update({ avatar_url: null })
          .eq('user_id', currentUser.id);
        if (dbError) throw dbError;
        showStatus('Photo removed');
        loadProfile();
      } catch (err) {
        console.error('Avatar delete error:', err);
        showStatus('Failed to remove photo');
      } finally {
        avatarDeleteBtn.disabled = false;
        pendingDeleteId = null;
      }
      return;
    }

    const { error } = await sb.from('notes').delete().eq('id', pendingDeleteId);
    confirmOverlay.classList.add('hidden');
    pendingDeleteId = null;
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


filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;

    const filterBar = document.getElementById('filter-bar');
    if (filterBar) filterBar.dataset.state = currentFilter;

    renderNotes();
  });
});


tagChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const pressed = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', !pressed);
  });
});





function showStatus(msg) {
  if (!statusCard || !statusMsg || !statusBar) return;

  if (statusCard._timer) clearTimeout(statusCard._timer);

  statusCard.classList.remove('visible', 'active');
  void statusCard.offsetWidth;

  statusMsg.textContent = msg;
  statusCard.classList.add('visible', 'active');

  statusCard._timer = setTimeout(() => {
    statusCard.classList.remove('visible', 'active');
  }, 3000);
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}


function linkify(escaped) {
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}


function cleanURL(url) {
  try {
    const u = new URL(url);
    const paramsToRemove = ['usp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si', 'fbclid', 'igsh'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}


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




function switchTab(targetId) {
  localStorage.setItem('activeSection', targetId);

  navItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));

  const mainTabs = document.getElementById('main-tabs');
  if (mainTabs) {
    mainTabs.setAttribute('data-state', targetId);
    const mainButtons = mainTabs.querySelectorAll('.filter-btn');
    mainButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
  }

  const isDesktop = window.innerWidth >= 768;

  appSections.forEach(sec => {
    const isActive = sec.id === targetId;
    sec.classList.toggle('active', isActive);
    sec.classList.toggle('hidden', !isActive);
  });

  if (targetId === 'section-notes' || isDesktop) {
    document.body.classList.add('locked-mode');
  } else {
    document.body.classList.remove('locked-mode');
  }

  const footerTagline = document.getElementById('footer-tagline');
  if (footerTagline) {
    footerTagline.textContent = targetId === 'section-notes'
      ? 'Organize your second brain'
      : 'Your personal knowledge vault';
  }
}

if (navItems.length > 0) {
  navItems.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.target)));
}
if (sidebarItems.length > 0) {
  sidebarItems.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.target)));
}

const mainTabButtons = document.querySelectorAll('.main-nav-liquid .filter-btn');
if (mainTabButtons.length > 0) {
  mainTabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.target)));
}




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
      if (profPortfolio)  profPortfolio.value = userProfile.portfolio_link || '';

      if (userProfile.resume_link && resumeFileName && resumeUploadBtn) {
        resumeFileName.textContent = 'Current Resume Uploaded (PDF)';
        resumeFileName.style.color = 'var(--ink-mid)';
        resumeUploadBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Replace PDF
        `;
      }
    }

    if (userProfile && userProfile.avatar_url) {
      avatarImg.src = userProfile.avatar_url;
      avatarImg.classList.remove('hidden');
      avatarPlaceholder.classList.add('hidden');
      avatarDeleteBtn.classList.remove('hidden');
    } else {
      avatarImg.src = '';
      avatarImg.classList.add('hidden');
      avatarPlaceholder.classList.remove('hidden');
      avatarDeleteBtn.classList.add('hidden');
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
        portfolio_link: profPortfolio.value.trim(),
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
    { key: 'certs', label: 'Certifications Details', val: userProfile.certifications_link },
    { key: 'portfolio', label: 'Portfolio Link', val: userProfile.portfolio_link }
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

      let output = "";

      if (keys.includes('name') && p.name) {
        output += `${p.name.toUpperCase()}\n\n`;
      }

      const contactKeys = ['phone', 'email'];
      if (contactKeys.some(k => keys.includes(k) && p[k])) {
        output += `Contact Information\n`;
        if (keys.includes('phone') && p.phone) output += `Phone: ${p.phone}\n`;
        if (keys.includes('email') && p.email) output += `Email: ${p.email}\n`;
        output += `\n`;
      }

      const socialKeys = ['github', 'linkedin', 'portfolio'];
      if (socialKeys.some(k => keys.includes(k) && (p[k] || p.portfolio_link))) {
        output += `Professional Profiles\n`;
        if (keys.includes('github') && p.github) output += `GitHub: ${p.github}\n`;
        if (keys.includes('linkedin') && p.linkedin) output += `LinkedIn: ${p.linkedin}\n`;
        if (keys.includes('portfolio') && p.portfolio_link) output += `Portfolio: ${p.portfolio_link}\n`;
        output += `\n`;
      }

      if (keys.includes('resume') && p.resume_link) {
        output += `Resume\nResume Link: ${p.resume_link}\n\n`;
      }

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

if (shareLinkBtn) {
  shareLinkBtn.addEventListener('click', () => {
    if (!currentUser) return;
    const shareUrl = `${window.location.origin}/share?u=${currentUser.id}`;
    navigator.clipboard.writeText(shareUrl);
    showStatus('Public Profile Link copied! 🔗');
  });
}


if (avatarUploadBtn) {
  avatarUploadBtn.addEventListener('click', () => avatarFileInput.click());
}

if (avatarFileInput) {
  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showStatus('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      cropperImage.src = event.target.result;
      cropperOverlay.classList.remove('hidden');

      if (cropperInstance) cropperInstance.destroy();
      cropperInstance = new Cropper(cropperImage, {
        aspectRatio: 1,
        viewMode: 1,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
      });
    };
    reader.readAsDataURL(file);
  });
}

cropperCloseBtn?.addEventListener('click', () => {
  cropperOverlay.classList.add('hidden');
  avatarFileInput.value = '';
});

cropperCancelBtn?.addEventListener('click', () => {
  cropperOverlay.classList.add('hidden');
  avatarFileInput.value = '';
});

cropperConfirmBtn?.addEventListener('click', async () => {
  if (!cropperInstance) return;

  cropperConfirmBtn.disabled = true;
  cropperConfirmBtn.textContent = 'Uploading...';

  try {
    const canvas = cropperInstance.getCroppedCanvas({
      width: 400,
      height: 400,
    });

    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error('Failed to create blob');

      const fileName = `${currentUser.id}/avatar_${Date.now()}.png`;

      const { data: uploadData, error: uploadError } = await sb.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = sb.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: dbError } = await sb
        .from('profile')
        .upsert({
          user_id: currentUser.id,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      showStatus('Profile photo updated! ✨');
      loadProfile();
      cropperOverlay.classList.add('hidden');
    }, 'image/png');

  } catch (err) {
    console.error('Avatar upload error:', err);
    showStatus('Failed to upload photo');
  } finally {
    cropperConfirmBtn.disabled = false;
    cropperConfirmBtn.textContent = 'Set Profile Photo';
    avatarFileInput.value = '';
  }
});

if (avatarDeleteBtn) {
  avatarDeleteBtn.addEventListener('click', () => {
    pendingDeleteId = '__AVATAR__';
    confirmMsg.textContent = 'Remove your profile photo?';
    confirmOk.textContent = 'Remove';
    confirmOverlay.classList.remove('hidden');
  });
}


if (resumeUploadBtn && resumeFileInput) {
  resumeUploadBtn.addEventListener('click', () => resumeFileInput.click());

  resumeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showStatus('Please select a PDF file');
      return;
    }

    resumeUploadBtn.textContent = 'Uploading...';
    resumeUploadBtn.disabled = true;

    try {
      if (!currentUser) throw new Error("Not authenticated");

      const fileName = `${currentUser.id}/resume_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('resumes')
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = sb.storage
        .from('resumes')
        .getPublicUrl(fileName);

      const { error: dbError } = await sb
        .from('profile')
        .upsert({
          user_id: currentUser.id,
          resume_link: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      profResumeLink.value = publicUrl;
      resumeFileName.textContent = `Uploaded: ${file.name}`;
      resumeFileName.style.color = '#10B981';
      showStatus('Resume uploaded! ✨');

    } catch (err) {
      console.error(err);
      showStatus('Failed to upload Resume');
    } finally {
      resumeUploadBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Replace PDF
      `;
      resumeUploadBtn.disabled = false;
      resumeFileInput.value = '';
    }
  });
}


initTheme();
initAuth();
initURLCleaners();

const savedSection = localStorage.getItem('activeSection') || 'section-notes';
switchTab(savedSection);

function updateClock() {
  const clockEl = document.getElementById('header-clock');
  if (!clockEl) return;
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const h = ist.getHours();
  const m = String(ist.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  clockEl.textContent = `${h12}:${m} ${ampm}`;
}
updateClock();
setInterval(updateClock, 1000);


/* ── Smart Save ─────────────────────────────── */
const smartSaveBtn = document.getElementById('smart-save-btn');
if (smartSaveBtn) {
  smartSaveBtn.addEventListener('click', async () => {
    if (!window.GEMINI) { showStatus('AI module not loaded 😕'); return; }
    const text = noteInput?.value?.trim();
    if (!text) { showStatus('Write something first! ✏️'); return; }
    if (text.length < 10) { showStatus('Too short for AI splitting — just save it normally!'); return; }

    const originalHTML = smartSaveBtn.innerHTML;
    smartSaveBtn.disabled = true;
    smartSaveBtn.innerHTML = '⏳ Thinking...';

    try {
      const notes = await window.GEMINI.smartSplitNotes(text);
      if (!Array.isArray(notes) || notes.length === 0) throw new Error('No notes returned');

      let saved = 0;
      for (const note of notes) {
        const { error } = await sb.from('notes').insert({
          user_id: currentUser.id,
          content: note.content?.trim(),
          tags: note.tags || [],
          pinned: false,
          done: false
        });
        if (!error) saved++;
      }

      noteInput.value = '';
      await loadNotes();
      showStatus(`✨ Smart saved ${saved} note${saved !== 1 ? 's' : ''}!`);
    } catch (err) {
      console.error('[SmartSave]', err);
      if (err.message?.includes('Limit')) {
        showStatus(err.message);
      } else if (err.message?.includes('API')) {
        showStatus('AI service unavailable. Try again shortly 🔌');
      } else {
        showStatus('Smart save failed — notes not split 😕');
      }
    } finally {
      smartSaveBtn.disabled = false;
      smartSaveBtn.innerHTML = originalHTML;
    }
  });
}









/* ── Smart Fill ─────────────────────────────── */
const smartProfBtn = document.getElementById('smart-prof-btn');
if (smartProfBtn) {
  smartProfBtn.addEventListener('click', async () => {
    if (!window.GEMINI) { showStatus('AI module not loaded 😕'); return; }
    const smartInput = document.getElementById('smart-ai-input');
    const fillStatus = document.getElementById('smart-fill-status');
    const text = smartInput?.value?.trim();

    if (!text) { showStatus('Paste some links or details first! 🔗'); return; }

    const originalHTML = smartProfBtn.innerHTML;
    smartProfBtn.disabled = true;
    smartProfBtn.innerHTML = '⏳ Analysing...';
    if (fillStatus) fillStatus.textContent = 'AI is reading your details...';

    try {
      const parsed = await window.GEMINI.smartParseProfile(text);
      if (!parsed) throw new Error('Empty response');

      let filled = 0;
      const map = {
        name: profName, phone: profPhone, email: profEmail,
        github: profGithub, linkedin: profLinkedin,
        internship_link: profInternship, project_link: profProject,
        certifications_link: profCerts, portfolio_link: profPortfolio
      };
      for (const [key, el] of Object.entries(map)) {
        if (parsed[key] && el) { el.value = parsed[key]; filled++; }
      }

      if (smartInput) smartInput.value = '';
      if (fillStatus) fillStatus.textContent = '';

      if (filled === 0) {
        showStatus("AI couldn't find any recognisable fields 🤔 Try pasting clearer info.");
      } else {
        showStatus(`✨ ${filled} field${filled !== 1 ? 's' : ''} filled! Click "Update Details" to save.`);
      }
    } catch (err) {
      console.error('[SmartFill]', err);
      if (fillStatus) fillStatus.textContent = '';
      if (err.message?.includes('Limit')) {
        showStatus(err.message);
      } else if (err.message?.includes('API')) {
        showStatus('AI service unavailable. Try again shortly 🔌');
      } else {
        showStatus('Smart Fill failed — try again 😕');
      }
    } finally {
      smartProfBtn.disabled = false;
      smartProfBtn.innerHTML = originalHTML;
    }
  });
}

