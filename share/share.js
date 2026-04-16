import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Containers
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const errorEl   = document.getElementById('error-screen');

// Profile Header
const pfpEl         = document.getElementById('pfp');
const pfpPlaceholder = document.getElementById('pfp-placeholder');
const nameEl        = document.getElementById('name');
const emailEl       = document.getElementById('email');

// Social Links
const githubLink    = document.getElementById('github-link');
const linkedinLink  = document.getElementById('linkedin-link');
const portfolioLink = document.getElementById('portfolio-link');

// Main Contact Footer
const phoneEl       = document.getElementById('phone');
const phoneWrap     = document.getElementById('phone-wrap');
const emailFooter   = document.getElementById('email-footer');

// Resources
const resumeBtn     = document.getElementById('resume-btn');
const internWrap    = document.getElementById('intern-wrap');
const internLink    = document.getElementById('intern-link');
const projectWrap   = document.getElementById('project-wrap');
const projectLink   = document.getElementById('project-link');
const certWrap      = document.getElementById('cert-wrap');
const certLink      = document.getElementById('cert-link');

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
  // Name & Header Email
  nameEl.textContent = p.name || 'Professional Portfolio';
  emailEl.textContent = p.email || '';

  // Avatar
  if (p.avatar_url) {
    pfpEl.src = p.avatar_url;
    pfpEl.classList.remove('hidden');
    pfpPlaceholder.classList.add('hidden');
  }

  // Socials
  if (p.github) {
    githubLink.href = p.github;
    githubLink.classList.remove('hidden');
  }
  if (p.linkedin) {
    linkedinLink.href = p.linkedin;
    linkedinLink.classList.remove('hidden');
  }
  if (p.portfolio_link) {
    portfolioLink.href = p.portfolio_link;
    portfolioLink.classList.remove('hidden');
  }

  // Resume
  if (p.resume_link) {
    resumeBtn.href = p.resume_link;
    resumeBtn.classList.remove('hidden');
  }

  // Links & Professional Details
  if (p.internship_link) {
    internLink.href = p.internship_link;
    internWrap.classList.remove('hidden');
  }
  if (p.project_link) {
    projectLink.href = p.project_link;
    projectWrap.classList.remove('hidden');
  }
  if (p.certifications_link) {
    certLink.href = p.certifications_link;
    certWrap.classList.remove('hidden');
  }

  // Contact Info
  if (p.phone) {
    phoneEl.textContent = p.phone;
    phoneWrap.classList.remove('hidden');
  }
  if (p.email && emailFooter) {
    emailFooter.textContent = p.email;
  }

  // Show content
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

function showError() {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
}

init();
