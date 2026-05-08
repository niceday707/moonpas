-- 010_post_likes.sql
--
-- 좋아요 토글 인프라.
--   기존 posts.like_count 는 단순 카운터였고, 누가 눌렀는지 기록이 없어서
--   중복/취소가 불가능했음. (클라이언트 localStorage 캐시로만 막고 있었음)
--
--   이제 post_likes(user_id, post_id) 테이블에 누가 어떤 글을 좋아요했는지 기록하고,
--   AFTER INSERT/DELETE 트리거로 posts.like_count 를 자동 동기화한다.
--   기존 like_count 값은 baseline 으로 유지 — 새 토글이 +1/-1 델타로 작동.
--
-- 모든 객체는 IF NOT EXISTS / DROP+CREATE 로 idempotent.

-- ────────────────────────────────────────────────────────────
-- 1. post_likes 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- 게시글별 좋아요 집계 / 글 삭제 시 역참조 빠르게
CREATE INDEX IF NOT EXISTS post_likes_post_idx
  ON public.post_likes(post_id);

-- 사용자별 누른 글 모음 — 목록 페이지에서 user_id 로 IN(...) 조회
CREATE INDEX IF NOT EXISTS post_likes_user_idx
  ON public.post_likes(user_id, created_at DESC);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- SELECT — 누가 좋아요했는지는 공개 (목록에서 본인 liked 표시 + 향후 좋아요한 사람 보기 등)
DROP POLICY IF EXISTS "post_likes select all" ON public.post_likes;
CREATE POLICY "post_likes select all"
  ON public.post_likes FOR SELECT
  USING (true);

-- INSERT — 본인만 자신을 좋아요로 등록 가능
DROP POLICY IF EXISTS "post_likes insert own" ON public.post_likes;
CREATE POLICY "post_likes insert own"
  ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE — 본인 좋아요만 취소 가능 (요청 핵심)
DROP POLICY IF EXISTS "post_likes delete own" ON public.post_likes;
CREATE POLICY "post_likes delete own"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 2. posts.like_count 자동 동기화 트리거
--   - INSERT  → +1
--   - DELETE  → -1 (음수 방지 GREATEST 0)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._post_likes_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
       SET like_count = COALESCE(like_count, 0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
       SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_likes_after_change ON public.post_likes;
CREATE TRIGGER post_likes_after_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public._post_likes_after_change();
