/* ═══════════════════════════════════════════════════════
   SECOND BRAIN — login.js
   Handles: sign in, sign up, forgot password
   Security: input validation, rate-limit awareness,
             no sensitive data in URL, secure session
═══════════════════════════════════════════════════════ */

'use strict';

/* ── Init Supabase ──────────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,   // prevent token leaking via URL
  }
});

/* ── DOM refs ───────────────────────────────────────── */
const form        = document.getElementById('auth-form');
const emailInput  = document.getElementById('email');
const pwInput     = document.getElementById('password');
const submitBtn   = document.getElementById('submit-btn');
const btnLabel    = document.getElementById('btn-label');
const spinner     = document.getElementById('spinner');
const alertEl     = document.getElementById('alert');
const switchBtn   = document.getElementById('switch-btn');
const switchPrompt= document.getElementById('switch-prompt');
const togglePwBtn = document.getElementById('toggle-pw');
const forgotBtn   = document.getElementById('forgot-btn');
const forgotWrap  = document.getElementById('forgot-wrap');

/* ── State ──────────────────────────────────────────── */
let mode        = 'login';   // 'login' | 'signup'
let isLoading   = false;

/* ── On load: redirect if already logged in ─────────── */
(async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      window.location.replace('../home/home.html');
    }
  } catch (err) {
    // silently ignore — just show the login form
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
  submitBtn.disabled = loading;
  spinner.classList.toggle('hidden', !loading);
  btnLabel.style.opacity = loading ? '0.5' : '1';
}

function sanitizeEmail(val) {
  return val.trim().toLowerCase();
}

function validateForm(email, password) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add('invalid');
    emailInput.focus();
    return 'Enter a valid email address.';
  }
  emailInput.classList.remove('invalid');

  if (!password || password.length < 8) {
    pwInput.classList.add('invalid');
    pwInput.focus();
    return 'Password must be at least 8 characters.';
  }
  pwInput.classList.remove('invalid');

  return null;  // no error
}

function friendlyError(error) {
  const msg = error?.message || '';
  if (msg.includes('Invalid login'))      return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))return 'Please confirm your email first. Check your inbox.';
  if (msg.includes('already registered')) return 'This email is already registered. Try signing in.';
  if (msg.includes('rate limit'))         return 'Too many attempts. Please wait a moment.';
  if (msg.includes('Signup disabled'))    return 'New registrations are closed.';
  if (msg.includes('network'))            return 'Network error. Check your connection.';
  return 'Something went wrong. Please try again.';
}

/* ── Sign In ────────────────────────────────────────── */
async function handleSignIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/* ── Sign Up ────────────────────────────────────────── */
async function handleSignUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/* ── Form Submit ────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isLoading) return;

  hideAlert();

  const email    = sanitizeEmail(emailInput.value);
  const password = pwInput.value;

  const validationError = validateForm(email, password);
  if (validationError) {
    showAlert(validationError, 'error');
    return;
  }

  setLoading(true);
  btnLabel.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';

  try {
    if (mode === 'login') {
      await handleSignIn(email, password);
      window.location.replace('../home/home.html');
    } else {
      const data = await handleSignUp(email, password);
      // Check if email confirmation is required
      if (data.user && !data.session) {
        showAlert('Account created! Check your email to confirm before signing in.', 'success');
        setMode('login');
      } else if (data.session) {
        window.location.replace('../home/home.html');
      }
    }
  } catch (err) {
    showAlert(friendlyError(err), 'error');
  } finally {
    setLoading(false);
    btnLabel.textContent = mode === 'login' ? 'Sign in' : 'Create account';
  }
});

/* ── Toggle login / signup mode ─────────────────────── */
function setMode(newMode) {
  mode = newMode;
  hideAlert();
  pwInput.value = '';
  if (mode === 'login') {
    btnLabel.textContent   = 'Sign in';
    switchPrompt.textContent = "Don't have an account?";
    switchBtn.textContent  = 'Create one';
    forgotWrap.style.display = '';
  } else {
    btnLabel.textContent   = 'Create account';
    switchPrompt.textContent = 'Already have an account?';
    switchBtn.textContent  = 'Sign in instead';
    forgotWrap.style.display = 'none';
    pwInput.setAttribute('autocomplete', 'new-password');
  }
}

switchBtn.addEventListener('click', () => {
  setMode(mode === 'login' ? 'signup' : 'login');
});

/* ── Show / hide password ───────────────────────────── */
togglePwBtn.addEventListener('click', () => {
  const isHidden = pwInput.type === 'password';
  pwInput.type         = isHidden ? 'text' : 'password';
  togglePwBtn.textContent = isHidden ? 'Hide' : 'Show';
});

/* ── Forgot password ────────────────────────────────── */
forgotBtn.addEventListener('click', async () => {
  const email = sanitizeEmail(emailInput.value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert('Enter your email above first, then click Forgot password.', 'error');
    emailInput.focus();
    return;
  }

  setLoading(true);
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login/index.html',
    });
    if (error) throw error;
    showAlert('Password reset email sent. Check your inbox.', 'success');
  } catch (err) {
    showAlert(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
});

/* ── Clear invalid state on input ───────────────────── */
emailInput.addEventListener('input', () => emailInput.classList.remove('invalid'));
pwInput.addEventListener('input',   () => pwInput.classList.remove('invalid'));
