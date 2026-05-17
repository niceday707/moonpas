-- ============================================================
-- 문파스(MoonPas) — 문태 미디어 인터랙션 테이블
--   · moontube_likes  : 좋아요 (item × user 유니크)
--   · moontube_saves  : 저장(북마크)
--   · moontube_comments: 댓글/대댓글
--
-- 집계 캐시 설계:
--   moontube_items 의 like_count/save_count/comment_count 는 위 3 테이블의
--   INSERT/DELETE 에 맞춰 트리거가 자동 갱신한다. 좋아요를 누른 사용자는
--   영상 소유자가 아니므로 moontube_items UPDATE RLS 를 통과하지 못한다 →
--   트리거 함수를 SECURITY DEFINER 로 두어 RLS 를 우회해 카운트만 조정한다.
--   (클라이언트가 카운트를 직접 조작할 경로는 없음 — 오직 트리거.)
-- ============================================================

-- ── 1. moontube_likes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moontube_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.moontube_items(id) ON DELETE CASCADE,
  -- profiles(id) 참조 — 코드베이스 관례(016/024) + PostgREST 프로필 embed 용.
  -- profiles.id 자체가 auth.users(id) 를 FK 하므로 인증 무결성도 유지된다.
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

ALTER TABLE public.moontube_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moontube_likes select" ON public.moontube_likes;
CREATE POLICY "moontube_likes select"
  ON public.moontube_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "moontube_likes insert self" ON public.moontube_likes;
CREATE POLICY "moontube_likes insert self"
  ON public.moontube_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "moontube_likes delete self" ON public.moontube_likes;
CREATE POLICY "moontube_likes delete self"
  ON public.moontube_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS moontube_likes_item_idx
  ON public.moontube_likes(item_id);
CREATE INDEX IF NOT EXISTS moontube_likes_user_idx
  ON public.moontube_likes(user_id);

-- ── 2. moontube_saves ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moontube_saves (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.moontube_items(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

ALTER TABLE public.moontube_saves ENABLE ROW LEVEL SECURITY;

-- 저장 목록은 본인만 조회 (북마크는 사적 정보)
DROP POLICY IF EXISTS "moontube_saves select self" ON public.moontube_saves;
CREATE POLICY "moontube_saves select self"
  ON public.moontube_saves FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "moontube_saves insert self" ON public.moontube_saves;
CREATE POLICY "moontube_saves insert self"
  ON public.moontube_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "moontube_saves delete self" ON public.moontube_saves;
CREATE POLICY "moontube_saves delete self"
  ON public.moontube_saves FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS moontube_saves_item_idx
  ON public.moontube_saves(item_id);
CREATE INDEX IF NOT EXISTS moontube_saves_user_idx
  ON public.moontube_saves(user_id);

-- ── 3. moontube_comments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moontube_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.moontube_items(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id  UUID        REFERENCES public.moontube_comments(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  like_count INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT moontube_comments_content_len CHECK (char_length(content) BETWEEN 1 AND 1000)
);

ALTER TABLE public.moontube_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moontube_comments select" ON public.moontube_comments;
CREATE POLICY "moontube_comments select"
  ON public.moontube_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "moontube_comments insert self" ON public.moontube_comments;
CREATE POLICY "moontube_comments insert self"
  ON public.moontube_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "moontube_comments update self" ON public.moontube_comments;
CREATE POLICY "moontube_comments update self"
  ON public.moontube_comments FOR UPDATE USING (auth.uid() = user_id);

-- 본인 + admin 삭제 (운영자가 부적절 댓글 정리)
DROP POLICY IF EXISTS "moontube_comments delete self or admin" ON public.moontube_comments;
CREATE POLICY "moontube_comments delete self or admin"
  ON public.moontube_comments FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS moontube_comments_item_idx
  ON public.moontube_comments(item_id, created_at);

DROP TRIGGER IF EXISTS moontube_comments_set_updated_at ON public.moontube_comments;
CREATE TRIGGER moontube_comments_set_updated_at
  BEFORE UPDATE ON public.moontube_comments
  FOR EACH ROW EXECUTE FUNCTION public.moontube_touch_updated_at();

-- ── 4. 집계 캐시 유지 트리거 (SECURITY DEFINER 로 RLS 우회) ─
-- 좋아요 수
CREATE OR REPLACE FUNCTION public.moontube_sync_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.moontube_items
       SET like_count = like_count + 1 WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.moontube_items
       SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS moontube_likes_count_trg ON public.moontube_likes;
CREATE TRIGGER moontube_likes_count_trg
  AFTER INSERT OR DELETE ON public.moontube_likes
  FOR EACH ROW EXECUTE FUNCTION public.moontube_sync_like_count();

-- 저장 수
CREATE OR REPLACE FUNCTION public.moontube_sync_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.moontube_items
       SET save_count = save_count + 1 WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.moontube_items
       SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS moontube_saves_count_trg ON public.moontube_saves;
CREATE TRIGGER moontube_saves_count_trg
  AFTER INSERT OR DELETE ON public.moontube_saves
  FOR EACH ROW EXECUTE FUNCTION public.moontube_sync_save_count();

-- 댓글 수
CREATE OR REPLACE FUNCTION public.moontube_sync_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.moontube_items
       SET comment_count = comment_count + 1 WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.moontube_items
       SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS moontube_comments_count_trg ON public.moontube_comments;
CREATE TRIGGER moontube_comments_count_trg
  AFTER INSERT OR DELETE ON public.moontube_comments
  FOR EACH ROW EXECUTE FUNCTION public.moontube_sync_comment_count();
