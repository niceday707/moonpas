-- ============================================================
-- 문파스(MoonPas) — 문태 미디어 댓글 좋아요 + 멘션 컬럼
--   · moontube_comments 에 mention_user_id 컬럼 추가
--   · moontube_comment_likes 테이블 신설 (comment × user 유니크)
--   · 좋아요 INSERT/DELETE 트리거 → moontube_comments.like_count 동기화
--     (SECURITY DEFINER 로 RLS 우회 — 비소유자 댓글에도 +1/-1)
--
-- like_count / parent_id 컬럼 자체는 033 에서 이미 만들었으므로 IF NOT EXISTS
-- 가드만 두고 다시 만들지 않는다(중복 마이그레이션 방어).
-- ============================================================

-- ── 1. 멘션 대상 사용자 컬럼 (NULL 허용) ───────────────────
-- "이 댓글이 누구를 @멘션 했는가" 의 구조화 포인터. 알림/검색에 활용.
ALTER TABLE public.moontube_comments
  ADD COLUMN IF NOT EXISTS mention_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS moontube_comments_mention_idx
  ON public.moontube_comments(mention_user_id)
  WHERE mention_user_id IS NOT NULL;

-- ── 2. 댓글 좋아요 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moontube_comment_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID        NOT NULL REFERENCES public.moontube_comments(id) ON DELETE CASCADE,
  -- profiles(id) — 다른 좋아요 테이블과 동일 관례
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.moontube_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moontube_comment_likes select" ON public.moontube_comment_likes;
CREATE POLICY "moontube_comment_likes select"
  ON public.moontube_comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "moontube_comment_likes insert self" ON public.moontube_comment_likes;
CREATE POLICY "moontube_comment_likes insert self"
  ON public.moontube_comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "moontube_comment_likes delete self" ON public.moontube_comment_likes;
CREATE POLICY "moontube_comment_likes delete self"
  ON public.moontube_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS moontube_comment_likes_comment_idx
  ON public.moontube_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS moontube_comment_likes_user_idx
  ON public.moontube_comment_likes(user_id);

-- ── 3. 좋아요 수 동기화 트리거 ─────────────────────────────
-- moontube_comments.like_count 컬럼은 033 에서 이미 만들었음.
-- 좋아요를 누른 사용자는 댓글 소유자가 아니어서 일반 UPDATE 권한이 없으므로,
-- SECURITY DEFINER 함수로 RLS 를 우회해 카운트만 ±1.
CREATE OR REPLACE FUNCTION public.moontube_sync_comment_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.moontube_comments
       SET like_count = like_count + 1
     WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.moontube_comments
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS moontube_comment_likes_count_trg ON public.moontube_comment_likes;
CREATE TRIGGER moontube_comment_likes_count_trg
  AFTER INSERT OR DELETE ON public.moontube_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.moontube_sync_comment_like_count();
