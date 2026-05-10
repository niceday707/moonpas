-- 027_challenges_view_count.sql
--
-- 챌린지 상세 페이지 조회수.
-- posts.view_count + increment_post_view 와 같은 패턴을 challenges 에 그대로 적용.
--
-- 멱등 — 재실행 안전.

-- ── 1) view_count 컬럼 추가 ─────────────────────────────────
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- ── 2) 조회수 +1 RPC ────────────────────────────────────────
-- SECURITY DEFINER 로 권한을 우회 — 비로그인이라도 (혹은 RLS 가 막더라도) 카운트는 증가.
-- posts.increment_post_view 와 동일한 패턴.
CREATE OR REPLACE FUNCTION public.increment_challenge_view(c_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.challenges
  SET view_count = view_count + 1
  WHERE id = c_id;
$$;

REVOKE ALL ON FUNCTION public.increment_challenge_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_challenge_view(uuid) TO anon, authenticated;
