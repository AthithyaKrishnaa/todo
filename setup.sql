-- ================================================================
-- SECOND BRAIN — setup.sql
-- Run this in your Supabase SQL Editor (once, in order)
-- ================================================================


-- ── 1. Enable UUID generation ─────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── 2. Notes table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  tags       TEXT[]       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  remind_at  TIMESTAMPTZ,
  done       BOOLEAN      NOT NULL DEFAULT FALSE,
  pinned     BOOLEAN      NOT NULL DEFAULT FALSE
);


-- ── 3. Indexes for fast queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS notes_user_id_idx    ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS notes_remind_at_idx  ON notes(remind_at) WHERE remind_at IS NOT NULL;


-- ── 4. Enable Row Level Security ──────────────────────────────
-- This ensures every user can ONLY access their OWN notes.
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;


-- ── 5. RLS Policies ───────────────────────────────────────────
-- SELECT: can only read own notes
CREATE POLICY "select_own_notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: can only create notes for themselves
CREATE POLICY "insert_own_notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: can only update own notes
CREATE POLICY "update_own_notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: can only delete own notes
CREATE POLICY "delete_own_notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);


-- ── 6. (Optional) Restrict signups to invited users only ──────
-- After creating YOUR account, run this to block new registrations.
-- This makes it truly private — only your account can ever log in.
--
-- In Supabase dashboard → Authentication → Settings:
--   Disable "Enable email confirmations" for dev
--   OR set "Signup disabled" to block new users
--
-- Alternatively, add a trigger to block extra signups:
--
-- CREATE OR REPLACE FUNCTION block_new_signups()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   IF (SELECT COUNT(*) FROM auth.users) >= 1 THEN
--     RAISE EXCEPTION 'Signups are closed.';
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER enforce_single_user
--   BEFORE INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION block_new_signups();


-- ================================================================
-- Done. Your database is secure and ready.
-- ================================================================
