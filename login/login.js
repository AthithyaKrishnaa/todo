/* ═══════════════════════════════════════════════════════
   SECOND BRAIN — login.js
   Handles: Google OAuth sign in
   Security: no sensitive data in URL, secure session
═══════════════════════════════════════════════════════ */

'use strict';

/* ── Init Supabase ──────────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,    // needed for OAuth redirects
  }
});

/* ── DOM refs ───────────────────────────────────────── */
const googleBtn   = document.getElementById('google-btn');
const btnLabel    = document.getElementById('btn-label');
const spinner     = document.getElementById('spinner');
const alertEl     = document.getElementById('alert');

/* ── State ──────────────────────────────────────────── */
let isLoading = false;

/* ── On load: redirect if already logged in ─────────── */
(async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      window.location.replace('../home/home.html');
    }
  } catch (err) {
    // silently ignore — just show the login button
  }
})();

/* ── Helpers ────────────────────────────────────────── */
function showAlert(message, type = 'error') {
  alertEl.textContent = message;
  alertEl.className   = `alert ${type}`;
}

function hideAlert() {
  alertEl.className = 'alert hidden';
  alertEl.textContent = '';
}

function setLoading(loading) {
  isLoading = loading;
  googleBtn.disabled = loading;
  spinner.classList.toggle('hidden', !loading);
  btnLabel.style.opacity = loading ? '0.5' : '1';
}

/* ── Sign In With Google ────────────────────────────── */
googleBtn.addEventListener('click', async () => {
  if (isLoading) return;
  hideAlert();
  setLoading(true);
  btnLabel.textContent = 'Redirecting to Google…';

  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/home/home.html'
      }
    });
    if (error) throw error;
  } catch (err) {
    const msg = err?.message || 'Something went wrong. Please try again.';
    showAlert(msg, 'error');
    setLoading(false);
    btnLabel.textContent = 'Continue with Google';
  }
});
