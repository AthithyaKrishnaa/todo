import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── DOM Elements ───────────────────────────────────
const loadingEl      = document.getElementById('loading');
const contentEl      = document.getElementById('content');
const errorEl        = document.getElementById('error-screen');

const pfpEl          = document.getElementById('pfp');
const pfpPlaceholder = document.getElementById('pfp-placeholder');
const nameEl         = document.getElementById('name');
const headerEmail    = document.getElementById('header-email');

const githubLink     = document.getElementById('github-link');
const linkedinLink   = document.getElementById('linkedin-link');
const portfolioLink  = document.getElementById('portfolio-link');
const resumeBtn      = document.getElementById('resume-btn');

const proSection     = document.getElementById('pro-section');
const internLink     = document.getElementById('intern-link');
const projectLink    = document.getElementById('project-link');
const certLink       = document.getElementById('cert-link');

const contactSection = document.getElementById('contact-section');
const phoneLink      = document.getElementById('phone-link');
const phoneText      = document.getElementById('phone-text');
const emailLink      = document.getElementById('email-link');
const emailText      = document.getElementById('email-text');

// ── Init ───────────────────────────────────────────
async function init() {
  const userId = new URLSearchParams(window.location.search).get('u');

  if (!userId) { showError(); return; }

  try {
    const { data: profile, error } = await sb
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !profile) { showError(); return; }

    renderProfile(profile);
  } catch (err) {
    console.error(err);
    showError();
  }
}

// ── Render ─────────────────────────────────────────
function renderProfile(p) {

  // Header
  nameEl.textContent = p.name || 'Professional Portfolio';

  if (p.email) {
    headerEmail.textContent = p.email;
    headerEmail.href = `mailto:${p.email}`;
  }

  // Avatar
  if (p.avatar_url) {
    pfpEl.src = p.avatar_url;
    pfpEl.classList.remove('hidden');
    pfpPlaceholder.classList.add('hidden');
  }

  // Primary Actions
  show(githubLink,    p.github,          p.github);
  show(linkedinLink,  p.linkedin,        p.linkedin);
  show(portfolioLink, p.portfolio_link,  p.portfolio_link);
  show(resumeBtn,     p.resume_link,     p.resume_link);

  // Professional Section
  const hasIntern  = !!p.internship_link;
  const hasProject = !!p.project_link;
  const hasCert    = !!p.certifications_link;

  show(internLink,  p.internship_link,    p.internship_link);
  show(projectLink, p.project_link,       p.project_link);
  show(certLink,    p.certifications_link, p.certifications_link);

  if (hasIntern || hasProject || hasCert) {
    proSection.classList.remove('hidden');
  }

  // Contact Section
  const hasPhone = !!p.phone;
  const hasEmail = !!p.email;

  if (hasPhone) {
    phoneLink.href = `tel:${p.phone}`;
    phoneText.textContent = p.phone;
    phoneLink.classList.remove('hidden');
  }

  if (hasEmail) {
    emailLink.href = `mailto:${p.email}`;
    emailText.textContent = p.email;
    emailLink.classList.remove('hidden');
  }

  if (hasPhone || hasEmail) {
    contactSection.classList.remove('hidden');
  }

  // Reveal page
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

// ── Helper: show a button if a value exists ────────
function show(el, href, exists) {
  if (!exists) return;
  el.href = href;
  el.classList.remove('hidden');
}

// ── Error ───────────────────────────────────────────
function showError() {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
}

init();
