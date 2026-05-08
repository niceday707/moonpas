-- ============================================================
-- 문파스(MoonPas) — 대시보드 배너 슬라이더 관리 시스템
--   · banners 테이블 + RLS + storage 'banners' 버킷
--   · admin role 만 쓰기, 활성 배너는 누구나 읽기
-- ============================================================

-- ── 1. banners 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.banners (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  link             TEXT,
  image_url        TEXT,
  background_color TEXT NOT NULL DEFAULT '#6C63FF',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS banners_active_order_idx
  ON public.banners(is_active, order_index, created_at DESC);

-- ── 2. RLS 정책 ────────────────────────────────────────────
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 활성 배너는 누구나 읽기
DROP POLICY IF EXISTS "banners read active" ON public.banners;
CREATE POLICY "banners read active"
  ON public.banners FOR SELECT
  USING (
    is_active = TRUE
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- INSERT: admin 만
DROP POLICY IF EXISTS "banners insert admin" ON public.banners;
CREATE POLICY "banners insert admin"
  ON public.banners FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- UPDATE: admin 만
DROP POLICY IF EXISTS "banners update admin" ON public.banners;
CREATE POLICY "banners update admin"
  ON public.banners FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- DELETE: admin 만
DROP POLICY IF EXISTS "banners delete admin" ON public.banners;
CREATE POLICY "banners delete admin"
  ON public.banners FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 3. Storage 'banners' 버킷 (public 읽기, admin 쓰기)
--   · storage.buckets 에 직접 INSERT — Dashboard 의 Storage UI 와 동일 효과
--   · 이미 존재하면 무시
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- storage.objects RLS — bucket_id = 'banners' 한정
DROP POLICY IF EXISTS "banners storage read" ON storage.objects;
CREATE POLICY "banners storage read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "banners storage insert admin" ON storage.objects;
CREATE POLICY "banners storage insert admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "banners storage update admin" ON storage.objects;
CREATE POLICY "banners storage update admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "banners storage delete admin" ON storage.objects;
CREATE POLICY "banners storage delete admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
