/**
 * GEMINI AI Integration — gemini.js
 * Handles all AI-powered logic for splitting notes, parsing profile links, and generating briefs.
 *
 * ============================================================
 *  MODEL ROUTING + FAILOVER POLICY  (LIVE QUOTA AWARE)
 * ============================================================
 *
 *  STRICT FALLBACK ORDER:
 *    1. gemini-3-flash-preview     → Primary (Gemini 3)
 *    2. gemini-3.1-lite-preview    → Emergency fallback (v3.1)
 *    3. gemini-3.1-pro-preview     → Last resort only (v3.1)
 *
 *  RATE LIMIT HANDLING:
 *    - RPD exceeded  → skip model for the remainder of the reset cycle
 *    - RPM throttled → switch immediately, no retry on same model
 *    - TPM high      → route to Lite to reduce token pressure
 *    - All models exhausted → return STATUS: RATE_LIMIT_REACHED payload
 *
 *  OPTIMIZATION ORDER: availability → cost → speed → quality
 *  Never select a higher-tier model when a lower-tier one is healthy.
 *
 *  SNAPSHOT THAT TRIGGERED THIS BUILD (treat as dynamic):
 *    gemini-3-flash       → RPD EXCEEDED (21/20) — BLOCKED ✗
 *    gemini-2.5-flash     → ACTIVE (2/5 RPM, 931/250K TPM, 11/20 RPD)
 *    gemini-2.0-flash-lite→ AVAILABLE — highest stability fallback ✓
 *    gemini-2.5-pro       → AVAILABLE — secondary fallback only ✓
 *
 *  API key sourced from config.js (gitignored) via window.CONFIG.GEMINI_API_KEY
 * ============================================================
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.error('[Gemini] API key missing — add VITE_GEMINI_API_KEY to your Vercel env or .env file');
}

// ─────────────────────────────────────────────────────────────
//  MODEL REGISTRY
//  Listed strictly in priority order: lowest-cost healthy first.
//  "blocked" is set at runtime when a quota error is detected.
// ─────────────────────────────────────────────────────────────
const MODEL_REGISTRY = [
  {
    id: 'gemini-3-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
    tier: 'primary',
    blocked: false,
    blockReason: null,
  },
  {
    id: 'gemini-3-lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent',
    tier: 'speed-fallback',
    blocked: false,
    blockReason: null,
  },
  {
    id: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    tier: 'stability-fallback',
    blocked: false,
    blockReason: null,
  },
  {
    id: 'gemini-3-pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
    tier: 'last-resort',
    blocked: false,
    blockReason: null,
  },
];

// ─────────────────────────────────────────────────────────────
//  SESSION PERSISTENCE
//  RPD blocks survive page refresh (daily quota doesn't reset on reload).
//  RPM blocks do NOT persist — they self-heal in 60s.
// ─────────────────────────────────────────────────────────────
const _SESSION_KEY = 'gemini_router_blocked';

function _persistBlock(modelId) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(_SESSION_KEY) || '{}');
    stored[modelId] = { blockedAt: Date.now() };
    sessionStorage.setItem(_SESSION_KEY, JSON.stringify(stored));
  } catch (_) {}
}

function _restorePersistedBlocks() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(_SESSION_KEY) || '{}');
    MODEL_REGISTRY.forEach(m => {
      if (stored[m.id]) {
        m.blocked = true;
        m.blockReason = 'RPD (persisted from previous session)';
        console.warn(`[Gemini Router] ↩ Restoring block for ${m.id} from sessionStorage`);
      }
    });
  } catch (_) {}
}

function _clearPersistedBlock(modelId) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(_SESSION_KEY) || '{}');
    delete stored[modelId];
    sessionStorage.setItem(_SESSION_KEY, JSON.stringify(stored));
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL QUOTA LOGGER
//  Tracks why each model was skipped/blocked this session.
// ─────────────────────────────────────────────────────────────
const _quotaLog = [];

function _logQuotaEvent(modelId, reason, statusCode) {
  const entry = {
    model: modelId,
    reason,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  _quotaLog.push(entry);
  console.warn(`[Gemini Router] ⚠ Model blocked — ${modelId} | ${reason} (HTTP ${statusCode})`);
}

// ─────────────────────────────────────────────────────────────
//  MODEL SELECTOR
//  Returns the first non-blocked model in the registry.
// ─────────────────────────────────────────────────────────────
function _selectModel() {
  const available = MODEL_REGISTRY.find(m => !m.blocked);
  if (!available) return null;
  return available;
}

// ─────────────────────────────────────────────────────────────
//  PROMPT REDUCER
//  When switching models mid-failure, reduce prompt size by ~30%.
//  Removes optional filler & trims whitespace aggressively.
// ─────────────────────────────────────────────────────────────
function _reducePrompt(prompt, reductionFactor = 0.30) {
  const lines = prompt.split('\n');
  const keepCount = Math.max(1, Math.floor(lines.length * (1 - reductionFactor)));
  return lines
    .filter(line => line.trim() !== '')   // remove blank lines first
    .slice(0, keepCount)
    .join('\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────
//  RATE-LIMIT ERROR CLASSIFIER
//  Maps HTTP status + error message to a quota category.
// ─────────────────────────────────────────────────────────────
function _classifyRateLimitError(statusCode, errorBody) {
  const message = (errorBody?.error?.message || '').toLowerCase();

  if (statusCode === 429) {
    if (message.includes('requests per day') || message.includes('rpd') || message.includes('daily')) {
      return 'RPD'; // Daily quota — skip until reset
    }
    if (message.includes('tokens per minute') || message.includes('tpm')) {
      return 'TPM'; // Token rate — try smaller model
    }
    // Default 429 → treat as RPM throttle
    return 'RPM';
  }

  // 503 Service Unavailable sometimes means quota exhaustion on Pro
  if (statusCode === 503) return 'SERVICE_UNAVAILABLE';

  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────
//  CORE ROUTER — callGemini()
//  Attempts each model in priority order with failover.
//  prompt: string
//  options: { reduceOnFallback: boolean }
// ─────────────────────────────────────────────────────────────
async function callGemini(prompt, options = { reduceOnFallback: true }) {
  let currentPrompt = prompt;
  let attemptCount = 0;

  while (true) {
    const model = _selectModel();

    // All models exhausted
    if (!model) {
      console.error('[Gemini Router] ✗ All models exhausted. Returning RATE_LIMIT_REACHED.');
      return {
        __routerError: true,
        STATUS: 'RATE_LIMIT_REACHED',
        REASON: 'All available Gemini models exhausted or blocked',
        ACTION: 'Retry after cooldown window (RPD resets at midnight Pacific, RPM resets every 60s)',
        quotaLog: _quotaLog,
      };
    }

    attemptCount++;
    console.log(`[Gemini Router] → Attempt ${attemptCount} — using model: ${model.id} (${model.tier})`);

    try {
      const response = await fetch(`${model.endpoint}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: currentPrompt }] }],
        }),
      });

      // ── SUCCESS PATH ──────────────────────────────────────
      if (response.ok) {
        const data = await response.json();
        let rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawContent) {
          throw new Error('Empty response body from Gemini API');
        }

        // Strip markdown code fences if AI ignored response_mime_type
        if (rawContent.includes('```json')) {
          rawContent = rawContent.split('```json')[1].split('```')[0].trim();
        } else if (rawContent.includes('```')) {
          rawContent = rawContent.split('```')[1].split('```')[0].trim();
        }

        console.log(`[Gemini Router] ✓ Success via ${model.id}`);
        return JSON.parse(rawContent);
      }

      // ── FAILURE PATH ──────────────────────────────────────
      const errorBody = await response.json().catch(() => ({}));
      const errorType = _classifyRateLimitError(response.status, errorBody);

      console.error(`[Gemini Router] ✗ ${model.id} failed — HTTP ${response.status} | type: ${errorType}`);
      console.error('[Gemini Router] Error detail:', errorBody?.error?.message || response.statusText);

      // Block this model and record why
      model.blocked = true;
      model.blockReason = errorType;
      _logQuotaEvent(model.id, errorType, response.status);

      // ── RPM auto-recovery: unblock after 65s (RPM window is 60s) ──
      // RPD blocks persist; RPM + TPM + SERVICE blocks self-heal.
      if (errorType === 'RPM' || errorType === 'TPM' || errorType === 'SERVICE_UNAVAILABLE') {
        const recoveryMs = errorType === 'SERVICE_UNAVAILABLE' ? 30_000 : 65_000;
        console.log(`[Gemini Router] ⏱ ${model.id} will auto-recover in ${recoveryMs / 1000}s`);
        setTimeout(() => {
          model.blocked = false;
          model.blockReason = null;
          console.log(`[Gemini Router] ✓ ${model.id} auto-recovered (${errorType} window passed)`);
        }, recoveryMs);
      }

      // ── RPD blocks are persistent — save to sessionStorage ──
      if (errorType === 'RPD') {
        _persistBlock(model.id);
        console.warn(`[Gemini Router] 📅 ${model.id} RPD block persisted to sessionStorage (resets at midnight PT)`);
      }

      // Reduce prompt on fallback to minimize token usage on cheaper model
      if (options.reduceOnFallback && attemptCount >= 1) {
        currentPrompt = _reducePrompt(currentPrompt, 0.30);
        console.log(`[Gemini Router] Prompt reduced to ${currentPrompt.length} chars for next attempt.`);
      }

      // Continue loop → _selectModel() will pick next available
      continue;

    } catch (networkError) {
      // Network-level failure (timeout, DNS, CORS etc.)
      console.error(`[Gemini Router] ✗ Network error on ${model.id}:`, networkError.message);
      model.blocked = true;
      model.blockReason = 'NETWORK_ERROR';
      _logQuotaEvent(model.id, 'NETWORK_ERROR', 0);
      continue;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  ROUTER STATE INSPECTOR (dev/debug utility)
//  Call window.GEMINI.getRouterState() from the console.
// ─────────────────────────────────────────────────────────────
function getRouterState() {
  return {
    models: MODEL_REGISTRY.map(m => ({
      id: m.id,
      tier: m.tier,
      status: m.blocked ? `BLOCKED (${m.blockReason})` : 'AVAILABLE',
    })),
    quotaLog: _quotaLog,
    activeModel: _selectModel()?.id || 'NONE — all exhausted',
  };
}

// ─────────────────────────────────────────────────────────────
//  RESET ROUTER (use after cooldown window if all models blocked)
//  Call window.GEMINI.resetRouter() from the console.
// ─────────────────────────────────────────────────────────────
function resetRouter() {
  MODEL_REGISTRY.forEach(m => {
    m.blocked = false;
    m.blockReason = null;
    _clearPersistedBlock(m.id);
  });
  _quotaLog.length = 0;
  console.log('[Gemini Router] ↺ All models unblocked. Router reset.');
}

// ─────────────────────────────────────────────────────────────
//  callGeminiText — plain-text variant (no JSON parsing)
//  Use when the AI response is prose, not structured data.
// ─────────────────────────────────────────────────────────────
async function callGeminiText(prompt, options = { reduceOnFallback: false }) {
  let currentPrompt = prompt;
  let attemptCount = 0;

  while (true) {
    const model = _selectModel();

    if (!model) {
      return {
        __routerError: true,
        STATUS: 'RATE_LIMIT_REACHED',
        REASON: 'All available Gemini models exhausted or blocked',
        ACTION: 'Retry after cooldown window',
        quotaLog: _quotaLog,
      };
    }

    attemptCount++;
    console.log(`[Gemini Router/Text] → Attempt ${attemptCount} — using model: ${model.id}`);

    try {
      const response = await fetch(`${model.endpoint}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: currentPrompt }] }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty text response from Gemini API');
        console.log(`[Gemini Router/Text] ✓ Success via ${model.id}`);
        return text.trim();
      }

      const errorBody = await response.json().catch(() => ({}));
      const errorType = _classifyRateLimitError(response.status, errorBody);
      model.blocked = true;
      model.blockReason = errorType;
      _logQuotaEvent(model.id, errorType, response.status);

      if (errorType === 'RPM' || errorType === 'TPM') {
        setTimeout(() => { model.blocked = false; model.blockReason = null; }, 65_000);
      }
      if (errorType === 'RPD') _persistBlock(model.id);

      if (options.reduceOnFallback) {
        currentPrompt = _reducePrompt(currentPrompt, 0.30);
      }
      continue;

    } catch (networkError) {
      console.error(`[Gemini Router/Text] ✗ Network error on ${model.id}:`, networkError.message);
      model.blocked = true;
      model.blockReason = 'NETWORK_ERROR';
      _logQuotaEvent(model.id, 'NETWORK_ERROR', 0);
      continue;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  FEATURE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Splits a lump of text into individual structured notes.
 */
async function smartSplitNotes(text) {
  const prompt = `
    You are an AI assistant for a "Second Brain" notes app.
    The user has provided a lump of text containing multiple notes or tasks.
    Your job is to identify each individual note and assign relevant tags from this set: [idea, study, important, task].
    
    Format your response as a JSON array of objects:
    [
      {"content": "note content here", "tags": ["tag1", "tag2"]}
    ]

    Input text:
    "${text}"
  `;
  const result = await callGemini(prompt);
  if (result?.__routerError) throw new Error(result.REASON);
  return result;
}

/**
 * Parses links and personal info into profile fields.
 */
async function smartParseProfile(text) {
  const prompt = `
    You are an AI assistant. The user has pasted some links or information for their professional profile.
    Identify and extract the following fields: name, phone, email, github, linkedin, internship_link, project_link, certifications_link, portfolio_link.
    
    If you don't find a field, return null for it.
    Return a JSON object with these keys.

    Input text:
    "${text}"
  `;
  const result = await callGemini(prompt);
  if (result?.__routerError) throw new Error(result.REASON);
  return result;
}



/**
 * Generates a short, punchy title for a single note's content.
 * Returns a plain string (uses callGeminiText — no JSON overhead).
 */
async function generateNoteTitle(content) {
  if (!content || content.trim().length < 5) return null;

  const prompt = `
    You are a concise title generator for a personal notes app.
    Given the note content below, generate ONE short title (max 6 words).
    Rules:
    - No punctuation at the end
    - No quotes around the title
    - Title-case only
    - Return ONLY the title, nothing else

    Note content:
    "${content.slice(0, 400)}"
  `;
  const result = await callGeminiText(prompt, { reduceOnFallback: false });
  if (typeof result === 'object' && result?.__routerError) throw new Error(result.REASON);
  // Sanitise: strip quotes, newlines, punctuation at end
  return result.replace(/^["']|["']$/g, '').replace(/[.!?,;]+$/, '').trim();
}

/**
 * AI-powered note search: given a natural language query,
 * returns the IDs of notes that best match the intent.
 * `notes` = array of { id, content, tags[] }
 * Returns an array of matching IDs in ranked order.
 */
async function generateSmartSearch(query, notes) {
  if (!query || !notes || notes.length === 0) return [];

  // Only send content + id to the model (no extra metadata = fewer tokens)
  const slim = notes.slice(0, 60).map(n => ({
    id: n.id,
    text: n.content?.slice(0, 200),
    tags: (n.tags || []).join(', '),
  }));

  const prompt = `
    You are a semantic search assistant for a personal notes app.
    Given the user's search query and a list of notes, return the IDs of notes
    that are semantically relevant to the query. Rank them best-match first.

    Rules:
    - Return ONLY a JSON array of note IDs (strings), e.g. ["id1", "id2"]
    - If no notes match, return an empty array []
    - Do not include any explanation
    - Max 10 results

    Search query: "${query}"

    Notes:
    ${JSON.stringify(slim)}
  `;

  const result = await callGemini(prompt);
  if (result?.__routerError) throw new Error(result.REASON);
  if (!Array.isArray(result)) return [];
  return result;
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────
// Restore any persisted blocks from previous page loads
_restorePersistedBlocks();

export const GEMINI = {
  // ── Core caller (JSON response) ──
  callGemini,

  // ── Core caller (plain text response) ──
  callGeminiText,

  // ── Feature functions ──
  smartSplitNotes,
  smartParseProfile,

  generateNoteTitle,
  generateSmartSearch,

  // ── Router utilities (dev/debug) ──
  getRouterState,   // window.GEMINI.getRouterState()  → model status table
  resetRouter,      // window.GEMINI.resetRouter()     → unblock all models
};

// Also expose to window for console debugging
window.GEMINI = GEMINI;

console.log(
  `%c[Gemini Router] ✓ Loaded — active model: ${_selectModel()?.id ?? 'NONE'}`,
  'color: #6ee7b7; font-weight: bold;'
);
