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


-- ================================================================
-- SECOND BRAIN — Phase 2: Vault & Profile
-- ================================================================

-- ── 7. Links table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS links (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  heading    TEXT         NOT NULL CHECK (char_length(heading) BETWEEN 1 AND 255),
  url        TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS links_user_id_idx ON links(user_id);
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_links" ON links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_links" ON links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_links" ON links FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_links" ON links FOR DELETE USING (auth.uid() = user_id);


-- ── 8. Documents table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  heading    TEXT         NOT NULL CHECK (char_length(heading) BETWEEN 1 AND 255),
  file_path  TEXT         NOT NULL,
  file_name  TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_documents" ON documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_documents" ON documents FOR DELETE USING (auth.uid() = user_id);


-- ── 9. Profile table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT,
  phone        TEXT,
  github       TEXT,
  linkedin     TEXT,
  project_link TEXT,
  resume_path  TEXT,
  resume_name  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_profile" ON profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_profile" ON profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_profile" ON profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_profile" ON profile FOR DELETE USING (auth.uid() = user_id);


-- ── 10. Storage Bucket Setup ──────────────────────────────────
-- Create a private bucket called "vault" if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only upload, read, update, delete their own files via folder path or ownership
CREATE POLICY "vault_select" ON storage.objects FOR SELECT USING (bucket_id = 'vault' AND auth.uid() = owner);
CREATE POLICY "vault_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vault' AND auth.uid() = owner);
CREATE POLICY "vault_update" ON storage.objects FOR UPDATE USING (bucket_id = 'vault' AND auth.uid() = owner) WITH CHECK (bucket_id = 'vault' AND auth.uid() = owner);
CREATE POLICY "vault_delete" ON storage.objects FOR DELETE USING (bucket_id = 'vault' AND auth.uid() = owner);
