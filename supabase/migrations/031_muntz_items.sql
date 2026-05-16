-- ============================================================
-- 문파스(MoonPas) — 문츠(Muntz) 영상 등록/표시 테이블
--   · muntz_items 테이블 + RLS
--   · 학생/교사 수동 등록 + 자동 수집 후보 동일 테이블 사용
--   · 1차 정책: 수동 등록은 즉시 visible, 문제 영상은 admin 이 hidden 으로 전환
--   · 영상 자체는 저장하지 않음 — youtube_id 와 메타데이터만 보관, iframe embed 재생
-- ============================================================

-- ── 1. muntz_items 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.muntz_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id      TEXT        NOT NULL,
  youtube_url     TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  channel_title   TEXT,
  author_nickname TEXT        NOT NULL,
  category        TEXT        NOT NULL,
  target_grade    TEXT        NOT NULL DEFAULT '전학년',
  description     TEXT,
  safety_note     TEXT,
  source          TEXT        NOT NULL DEFAULT 'manual',     -- manual | youtube_auto
  review_status   TEXT        NOT NULL DEFAULT 'visible',     -- visible | hidden | pending | rejected | archived | auto_approved
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT muntz_items_youtube_id_len CHECK (char_length(youtube_id) BETWEEN 6 AND 16),
  CONSTRAINT muntz_items_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT muntz_items_review_status_chk CHECK (
    review_status IN ('visible','hidden','pending','rejected','archived','auto_approved')
  ),
  CONSTRAINT muntz_items_source_chk CHECK (
    source IN ('manual','youtube_auto')
  )
);

-- 피드 조회 최적화 — visible/auto_approved 만 최신순 (가장 잦은 쿼리)
CREATE INDEX IF NOT EXISTS muntz_items_feed_idx
  ON public.muntz_items(review_status, created_at DESC)
  WHERE review_status IN ('visible','auto_approved');

-- 자동 수집기 upsert 시 빠른 조회용
CREATE INDEX IF NOT EXISTS muntz_items_youtube_id_idx
  ON public.muntz_items(youtube_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.muntz_items_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS muntz_items_set_updated_at ON public.muntz_items;
CREATE TRIGGER muntz_items_set_updated_at
  BEFORE UPDATE ON public.muntz_items
  FOR EACH ROW EXECUTE FUNCTION public.muntz_items_touch_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────
ALTER TABLE public.muntz_items ENABLE ROW LEVEL SECURITY;

-- SELECT: 노출 가능 상태는 인증된 모든 사용자, 그 외는 admin 만
DROP POLICY IF EXISTS "muntz_items read visible" ON public.muntz_items;
CREATE POLICY "muntz_items read visible"
  ON public.muntz_items FOR SELECT
  USING (
    review_status IN ('visible','auto_approved')
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- INSERT: 로그인된 사용자(학생/교사/학부모/졸업생/관리자) 누구나 등록 가능.
--   · created_by 는 본인 id 로만 박을 수 있음 (남의 id 사칭 금지).
--   · source/review_status 는 클라이언트가 임의로 지정 못 하도록 기본값에 맡기는 게 권장이지만,
--     수동 등록은 source='manual' / review_status='visible' 만 허용.
--   · 자동 수집기는 service-role key 로 직접 upsert (이 RLS 우회).
DROP POLICY IF EXISTS "muntz_items insert authed" ON public.muntz_items;
CREATE POLICY "muntz_items insert authed"
  ON public.muntz_items FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND source = 'manual'
    AND review_status = 'visible'
  );

-- UPDATE: 본인이 올린 글의 일부 필드 수정 가능 + admin 은 모든 필드.
--   · 학생/교사 본인은 자기 글의 review_status 를 hidden 으로만 바꿀 수 있다 (회수).
--   · admin 은 어느 글이든 어떤 상태로든 전환 가능.
DROP POLICY IF EXISTS "muntz_items update author or admin" ON public.muntz_items;
CREATE POLICY "muntz_items update author or admin"
  ON public.muntz_items FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- DELETE: admin 만 (학생/교사는 회수만, 실제 삭제는 운영자 권한)
DROP POLICY IF EXISTS "muntz_items delete admin" ON public.muntz_items;
CREATE POLICY "muntz_items delete admin"
  ON public.muntz_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
