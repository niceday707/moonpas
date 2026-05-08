-- 008_mentions_and_notifications.sql
--
-- @멘션 자동완성 + 멘션 알림 인프라.
--   1) public.mentions          — 어떤 댓글이 어떤 유저를 언급했는지 기록
--   2) public.notifications     — 멘션/댓글/좋아요 등 통합 알림 큐
--   3) public.search_mentionable_users(...)
--      — @ 자동완성용 RPC. 댓글 작성자 우선 → starts-with 우선 → 최근 활동 순.
--
-- 모든 객체는 IF NOT EXISTS / DROP+CREATE 로 idempotent.

-- ────────────────────────────────────────────────────────────
-- 1. mentions 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 동일 댓글에서 같은 유저를 두 번 언급해도 알림은 한 번만
  UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS mentions_user_idx     ON public.mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mentions_comment_idx  ON public.mentions(comment_id);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentions select self" ON public.mentions;
CREATE POLICY "mentions select self"
  ON public.mentions FOR SELECT
  USING (auth.uid() = mentioned_user_id);

DROP POLICY IF EXISTS "mentions insert auth" ON public.mentions;
CREATE POLICY "mentions insert auth"
  ON public.mentions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 2. notifications 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  message TEXT NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select self" ON public.notifications;
CREATE POLICY "notifications select self"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications insert auth" ON public.notifications;
CREATE POLICY "notifications insert auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 본인 알림만 is_read 갱신 가능
DROP POLICY IF EXISTS "notifications update self" ON public.notifications;
CREATE POLICY "notifications update self"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. search_mentionable_users RPC
--
--    p_query: @ 뒤에 입력된 텍스트. ''(빈 문자열)이면 댓글 작성자만 최근 순.
--    p_post_id: 현재 글 ID — 댓글 작성자 우선 정렬 기준.
--    p_current_user_id: 자기 자신 제외용.
--
--    정렬 우선순위:
--      1) is_commenter (현재 글 댓글 작성자) DESC
--      2) starts_with (닉네임이 query 로 시작) DESC
--      3) last_active (최근 댓글 시각, 없으면 가입일) DESC
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_mentionable_users(
  p_query TEXT,
  p_post_id UUID,
  p_current_user_id UUID
)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  role TEXT,
  avatar_url TEXT,
  is_commenter BOOLEAN,
  starts_with BOOLEAN,
  last_active TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH commenters AS (
    SELECT c.author_id, MAX(c.created_at) AS last_comment
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND c.author_id <> p_current_user_id
    GROUP BY c.author_id
  )
  SELECT
    p.id,
    p.nickname,
    p.role::TEXT AS role,
    p.avatar_url,
    (cm.author_id IS NOT NULL) AS is_commenter,
    (COALESCE(p_query, '') <> '' AND p.nickname ILIKE p_query || '%') AS starts_with,
    COALESCE(cm.last_comment, p.created_at) AS last_active
  FROM public.profiles p
  LEFT JOIN commenters cm ON cm.author_id = p.id
  WHERE p.id <> p_current_user_id
    AND p.nickname IS NOT NULL
    AND (
      -- @만 입력 시: 이 글 댓글 작성자만
      (COALESCE(p_query, '') = '' AND cm.author_id IS NOT NULL)
      -- 검색어 있을 때: ILIKE %query%
      OR (COALESCE(p_query, '') <> '' AND p.nickname ILIKE '%' || p_query || '%')
    )
  ORDER BY
    (cm.author_id IS NOT NULL) DESC,
    (COALESCE(p_query, '') <> '' AND p.nickname ILIKE p_query || '%') DESC,
    COALESCE(cm.last_comment, p.created_at) DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.search_mentionable_users(TEXT, UUID, UUID) TO authenticated;
