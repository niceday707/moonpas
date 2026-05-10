-- 024_challenge_categories.sql
--
-- 챌린지 게시판 고도화 — 카테고리 3종 + 관리자 인증 취소 + 참여자 관리.
--
-- 1) post_category CHECK 화이트리스트 확장
--    기존: 'question' / 'tip' / 'share' (학습게시판 전용)
--    추가: 'attendance' / 'study_cert' / 'exercise' (챌린지 전용)
--    board_type 으로 의미가 분리되므로 같은 컬럼을 재사용.
--
-- 2) challenge_status / challenge_rejected_reason 컬럼
--    'approved' (기본값) — 정상 인증
--    'rejected'         — 관리자가 인증 취소
--
-- 3) challenge_participants 테이블
--    유저별 참여 카테고리 관리 (active/inactive 토글).
--
-- 멱등 패턴 사용 — 재실행 안전.

-- ── 1) post_category CHECK 확장 ───────────────────────────────
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_category_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_category_chk
  CHECK (
    post_category IS NULL
    OR post_category IN (
      'question', 'tip', 'share',
      'attendance', 'study_cert', 'exercise'
    )
  );

-- ── 2) 챌린지 인증 상태 컬럼 ──────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS challenge_status         VARCHAR(16) DEFAULT 'approved';
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS challenge_rejected_reason TEXT;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_challenge_status_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_challenge_status_chk
  CHECK (
    challenge_status IS NULL
    OR challenge_status IN ('approved', 'rejected')
  );

-- 챌린지 보드 카테고리/상태별 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS posts_challenge_category_idx
  ON public.posts (post_category)
  WHERE board_type = 'challenge' AND post_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_challenge_status_idx
  ON public.posts (challenge_status)
  WHERE board_type = 'challenge';

-- ── 3) 챌린지 참여자 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  user_id    UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category   VARCHAR(20)  NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category),
  CONSTRAINT challenge_participants_category_chk
    CHECK (category IN ('attendance', 'study_cert', 'exercise'))
);

CREATE INDEX IF NOT EXISTS challenge_participants_active_idx
  ON public.challenge_participants (category)
  WHERE is_active = TRUE;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_participants_select_all" ON public.challenge_participants;
CREATE POLICY "challenge_participants_select_all"
  ON public.challenge_participants FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "challenge_participants_insert_self" ON public.challenge_participants;
CREATE POLICY "challenge_participants_insert_self"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "challenge_participants_update_self" ON public.challenge_participants;
CREATE POLICY "challenge_participants_update_self"
  ON public.challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "challenge_participants_delete_self" ON public.challenge_participants;
CREATE POLICY "challenge_participants_delete_self"
  ON public.challenge_participants FOR DELETE
  USING (auth.uid() = user_id);
