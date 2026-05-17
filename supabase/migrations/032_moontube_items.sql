-- ============================================================
-- 문파스(MoonPas) — 문태 미디어(MoonTube) 통합 영상 테이블
--   · moontube_items: 롱폼(16:9) + 쇼츠(9:16) 를 한 테이블에서 관리
--   · 기존 muntz_items(쇼츠 전용) 의 상위 호환 — video_type 으로 구분
--   · 좋아요/저장/조회수/댓글 수는 집계 캐시 컬럼(033 트리거가 유지)
--   · 영상 자체는 저장하지 않음 — youtube_id + 메타데이터만, iframe embed 재생
--
-- ⚠️ 트리거 함수: 코드베이스에 update_updated_at_column() 이 없으므로
--    031 패턴대로 전용 함수(moontube_touch_updated_at)를 정의한다.
-- ============================================================

-- ── 1. moontube_items 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.moontube_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id      TEXT        NOT NULL,
  youtube_url     TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  channel_title   TEXT,
  thumbnail_url   TEXT,                                       -- img.youtube.com 썸네일 URL
  author_nickname TEXT        NOT NULL,                        -- 문파스에서 등록한 사람 닉네임
  -- 영상 유형: 'short'(9:16 쇼츠) / 'long'(16:9 롱폼)
  video_type      TEXT        NOT NULL,
  category        TEXT        NOT NULL,
  target_grade    TEXT        NOT NULL DEFAULT '전 학년',
  description     TEXT,
  safety_note     TEXT,
  -- 출처: 'manual'(수동 등록) / 'youtube_auto'(API 자동 수집)
  source          TEXT        NOT NULL DEFAULT 'manual',
  -- 검수 상태: visible(즉시 노출) / pending(검수 대기) / hidden(숨김)
  --            / auto_approved(자동 승인 채널) / rejected(검수 탈락)
  review_status   TEXT        NOT NULL DEFAULT 'visible',
  -- 집계 캐시 — 033 의 트리거가 likes/saves/comments 에 맞춰 자동 갱신
  like_count      INTEGER     NOT NULL DEFAULT 0,
  save_count      INTEGER     NOT NULL DEFAULT 0,
  view_count      INTEGER     NOT NULL DEFAULT 0,
  comment_count   INTEGER     NOT NULL DEFAULT 0,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT moontube_items_youtube_id_uniq UNIQUE (youtube_id),  -- 같은 영상 중복 등록 방지
  CONSTRAINT moontube_items_youtube_id_len CHECK (char_length(youtube_id) BETWEEN 6 AND 16),
  CONSTRAINT moontube_items_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT moontube_items_video_type_chk CHECK (video_type IN ('short','long')),
  CONSTRAINT moontube_items_source_chk CHECK (source IN ('manual','youtube_auto')),
  CONSTRAINT moontube_items_review_status_chk CHECK (
    review_status IN ('visible','pending','hidden','auto_approved','rejected')
  )
);

-- 피드 조회 최적화 — 노출 상태 최신순 (가장 잦은 쿼리)
CREATE INDEX IF NOT EXISTS moontube_items_feed_idx
  ON public.moontube_items(review_status, created_at DESC)
  WHERE review_status IN ('visible','auto_approved');

-- 유형별 필터(롱폼/쇼츠 탭) 최적화
CREATE INDEX IF NOT EXISTS moontube_items_type_idx
  ON public.moontube_items(video_type, review_status, created_at DESC);

-- 자동 수집기 upsert(youtube_id 충돌 검사) 용
CREATE INDEX IF NOT EXISTS moontube_items_youtube_id_idx
  ON public.moontube_items(youtube_id);

-- ── 2. updated_at 자동 갱신 트리거 ─────────────────────────
CREATE OR REPLACE FUNCTION public.moontube_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS moontube_items_set_updated_at ON public.moontube_items;
CREATE TRIGGER moontube_items_set_updated_at
  BEFORE UPDATE ON public.moontube_items
  FOR EACH ROW EXECUTE FUNCTION public.moontube_touch_updated_at();

-- ── 3. 조회수 증가 RPC ─────────────────────────────────────
-- 비소유자도 조회수를 올릴 수 있어야 하는데, 아래 UPDATE RLS 는 소유자/admin
-- 만 허용한다. SECURITY DEFINER 로 RLS 를 우회해 안전하게 +1 만 수행한다.
-- (임의 컬럼 수정 불가 — 오직 view_count 1 증가)
CREATE OR REPLACE FUNCTION public.moontube_bump_view(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.moontube_items
     SET view_count = view_count + 1
   WHERE id = p_item_id
     AND review_status IN ('visible','auto_approved');
END;
$$;

REVOKE ALL ON FUNCTION public.moontube_bump_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moontube_bump_view(UUID) TO authenticated, anon;

-- ── 4. RLS ────────────────────────────────────────────────
ALTER TABLE public.moontube_items ENABLE ROW LEVEL SECURITY;

-- SELECT: 노출 가능 상태는 누구나, 그 외(pending/hidden/rejected)는 admin 만
DROP POLICY IF EXISTS "moontube_items read visible" ON public.moontube_items;
CREATE POLICY "moontube_items read visible"
  ON public.moontube_items FOR SELECT
  USING (
    review_status IN ('visible','auto_approved')
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- INSERT: 로그인 사용자 누구나 — created_by 사칭/상태 위조 차단.
--   · 수동 등록은 source='manual' / review_status='visible' 만 허용.
--   · 자동 수집기는 service-role key 로 직접 upsert (이 RLS 우회).
DROP POLICY IF EXISTS "moontube_items insert authed" ON public.moontube_items;
CREATE POLICY "moontube_items insert authed"
  ON public.moontube_items FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND source = 'manual'
    AND review_status = 'visible'
  );

-- UPDATE: 본인 글 또는 admin. (집계 카운트는 033 트리거가 SECURITY DEFINER
--   로 갱신하므로 비소유자가 like_count 등을 직접 못 바꿔도 무방.)
DROP POLICY IF EXISTS "moontube_items update author or admin" ON public.moontube_items;
CREATE POLICY "moontube_items update author or admin"
  ON public.moontube_items FOR UPDATE
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

-- DELETE: admin 만 (학생/교사는 회수=hidden 만)
DROP POLICY IF EXISTS "moontube_items delete admin" ON public.moontube_items;
CREATE POLICY "moontube_items delete admin"
  ON public.moontube_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
