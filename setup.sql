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
DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: can only create notes for themselves
DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: can only update own notes
DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: can only delete own notes
DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);



-- ── 7. Profile table ──────────────────────────────────────────
DROP TABLE IF EXISTS profile CASCADE;
CREATE TABLE IF NOT EXISTS profile (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT,
  phone               TEXT,
  email               TEXT,
  resume_link         TEXT,
  github              TEXT,
  linkedin            TEXT,
  internship_link     TEXT,
  project_link        TEXT,
  certifications_link TEXT,
  avatar_url          TEXT, -- New field for profile photo
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- Select own profile
DROP POLICY IF EXISTS "select_own_profile" ON profile;
CREATE POLICY "select_own_profile" ON profile FOR SELECT USING (auth.uid() = user_id);

-- Select any profile (Public read for shared links)
DROP POLICY IF EXISTS "Public read profiles" ON profile;
CREATE POLICY "Public read profiles" ON profile FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profile;
CREATE POLICY "insert_own_profile" ON profile FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profile;
CREATE POLICY "update_own_profile" ON profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profile" ON profile;
CREATE POLICY "delete_own_profile" ON profile FOR DELETE USING (auth.uid() = user_id);


-- ── 8. Storage Bucket Setup ──────────────────────────────────
-- Create a public bucket called "avatars" for profile photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar Storage RLS: Public read, private manage
DROP POLICY IF EXISTS "Public View Avatars" ON storage.objects;
CREATE POLICY "Public View Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can manage own avatar" ON storage.objects;
CREATE POLICY "Users can manage own avatar" 
ON storage.objects FOR ALL 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
