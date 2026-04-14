-- ================================================================
-- SECOND BRAIN — setup.sql
-- Run this in your Supabase SQL Editor
-- This script is "Safe" — it will NOT delete existing data.
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
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;


-- ── 5. RLS Policies for Notes ─────────────────────────────────
-- SELECT
DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes" ON notes FOR SELECT USING (auth.uid() = user_id);

-- INSERT
DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE
DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes" ON notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DELETE
DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes" ON notes FOR DELETE USING (auth.uid() = user_id);


-- ── 6. Profile table ──────────────────────────────────────────
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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely add new columns if they don't exist
ALTER TABLE profile ADD COLUMN IF NOT EXISTS portfolio_link TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;


-- ── 7. RLS Policies for Profile ───────────────────────────────
-- Select own profile
DROP POLICY IF EXISTS "select_own_profile" ON profile;
CREATE POLICY "select_own_profile" ON profile FOR SELECT USING (auth.uid() = user_id);

-- Select any profile (Public read for shared links)
DROP POLICY IF EXISTS "Public read profiles" ON profile;
CREATE POLICY "Public read profiles" ON profile FOR SELECT USING (true);

-- Insert own profile
DROP POLICY IF EXISTS "insert_own_profile" ON profile;
CREATE POLICY "insert_own_profile" ON profile FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update own profile
DROP POLICY IF EXISTS "update_own_profile" ON profile;
CREATE POLICY "update_own_profile" ON profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Delete own profile
DROP POLICY IF EXISTS "delete_own_profile" ON profile;
CREATE POLICY "delete_own_profile" ON profile FOR DELETE USING (auth.uid() = user_id);


-- ── 8. Storage Bucket Setup ──────────────────────────────────
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


-- ── 9. Resume Storage Bucket Setup ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('resumes', 'resumes', true, 5242880, ARRAY['application/pdf']) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- Resume Storage RLS: Public read, private manage
DROP POLICY IF EXISTS "Public View Resumes" ON storage.objects;
CREATE POLICY "Public View Resumes" ON storage.objects FOR SELECT USING (bucket_id = 'resumes');

DROP POLICY IF EXISTS "Users can manage own resume" ON storage.objects;
CREATE POLICY "Users can manage own resume" 
ON storage.objects FOR ALL 
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
