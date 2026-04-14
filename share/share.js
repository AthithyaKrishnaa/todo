/**
 * share.js — Public Profile Viewer
 */

const sb = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);

const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const errorEl   = document.getElementById('error');

const viewAvatar      = document.getElementById('view-avatar');
const viewPlaceholder = document.getElementById('view-placeholder');
const viewName        = document.getElementById('view-name');

// Info items
const valPhone = document.getElementById('val-phone');
const valEmail = document.getElementById('val-email');

// Links
const linkGithub   = document.getElementById('link-github');
const linkLinkedin = document.getElementById('link-linkedin');

// Resources
const resResume     = document.getElementById('res-resume');
const resInternship = document.getElementById('res-internship');
const resProject    = document.getElementById('res-project');
const resCerts      = document.getElementById('res-certs');
const linkPortfolio = document.getElementById('link-portfolio');

// Modal
const resumeModal       = document.getElementById('resume-modal');
const closeResumeModal  = document.getElementById('close-resume-modal');
const viewResumeBtn     = document.getElementById('view-resume-btn');
const downloadResumeBtn = document.getElementById('download-resume-btn');

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('u');

  if (!userId) {
    showError();
    return;
  }

  try {
    const { data: profile, error } = await sb
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !profile) {
      showError();
      return;
    }

    renderProfile(profile);
  } catch (err) {
    console.error(err);
    showError();
  }
}

function renderProfile(p) {
  // Name
  viewName.textContent = p.name || 'Professional Portfolio';

  // Avatar
  if (p.avatar_url) {
    viewAvatar.src = p.avatar_url;
    viewAvatar.classList.remove('hidden');
    viewPlaceholder.classList.add('hidden');
  }

  // Contact
  if (p.phone) {
    valPhone.textContent = p.phone;
    valPhone.href = `tel:${p.phone}`;
  } else {
    document.getElementById('item-phone').classList.add('hidden');
  }

  if (p.email) {
    valEmail.textContent = p.email;
    valEmail.href = `mailto:${p.email}`;
  } else {
    document.getElementById('item-email').classList.add('hidden');
  }

  if (!p.phone && !p.email) {
    document.getElementById('sec-contact').classList.add('hidden');
  }

  // Social
  let hasSocial = false;
  if (p.github) {
    linkGithub.href = p.github;
    hasSocial = true;
  } else {
    linkGithub.classList.add('hidden');
  }

  if (p.linkedin) {
    linkLinkedin.href = p.linkedin;
    hasSocial = true;
  } else {
    linkLinkedin.classList.add('hidden');
  }

  if (p.portfolio_link) {
    linkPortfolio.href = p.portfolio_link;
    hasSocial = true;
  } else {
    linkPortfolio.classList.add('hidden');
  }

  if (!hasSocial) {
    document.getElementById('sec-social').classList.add('hidden');
  }

  // Resources
  let hasResources = false;
  const resources = [
    { el: resResume, url: p.resume_link },
    { el: resInternship, url: p.internship_link },
    { el: resProject, url: p.project_link },
    { el: resCerts, url: p.certifications_link }
  ];

  resources.forEach(r => {
    if (r.url) {
      if (r.el === resResume) {
        // Special Handling for Resume to launch Modal
        r.el.href = '#';
        r.el.addEventListener('click', (e) => {
          e.preventDefault();
          let downloadUrl = r.url;
          // Force download parameter for Supabase hosted files
          if (r.url.includes('supabase.co/storage/v1/object/public/')) {
            downloadUrl += (r.url.includes('?') ? '&' : '?') + 'download=';
          }
          viewResumeBtn.href = r.url;
          downloadResumeBtn.href = downloadUrl;
          resumeModal.classList.remove('hidden');
        });
      } else {
        r.el.href = r.url;
      }
      hasResources = true;
    } else {
      r.el.classList.add('hidden');
    }
  });

  if (!hasResources) {
    document.getElementById('sec-resources').classList.add('hidden');
  }

  // Show content
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

function showError() {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
}

if (closeResumeModal) {
  closeResumeModal.addEventListener('click', () => {
    resumeModal.classList.add('hidden');
  });
}

init();
