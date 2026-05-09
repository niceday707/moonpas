-- 019_push_tokens.sql
--
-- FCM 푸시 토큰 저장 테이블.
-- 한 사용자가 여러 기기에서 로그인할 수 있으므로 (user_id, token) 복합 UNIQUE.
-- firebase-admin 이 만료 토큰 감지 시 /api/push 에서 자동 삭제.

-- ────────────────────────────────────────────────────────────
-- 1. push_tokens 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  device_info TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- ────────────────────────────────────────────────────────────
-- 2. 인덱스
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS push_tokens_user_idx
  ON public.push_tokens(user_id);

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 본인 토큰만 INSERT
DROP POLICY IF EXISTS "push_tokens insert own" ON public.push_tokens;
CREATE POLICY "push_tokens insert own"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 토큰만 SELECT
DROP POLICY IF EXISTS "push_tokens select own" ON public.push_tokens;
CREATE POLICY "push_tokens select own"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 토큰만 DELETE (만료 토큰 정리)
DROP POLICY IF EXISTS "push_tokens delete own" ON public.push_tokens;
CREATE POLICY "push_tokens delete own"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);
