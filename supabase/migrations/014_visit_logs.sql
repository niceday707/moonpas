-- 014_visit_logs.sql
--
-- 방문 로그 + 오늘 방문자 수(DISTINCT visitor_hash) 집계 RPC.
--
--   visitor_hash 는 서버에서 IP + User-Agent 를 해시한 값(SHA-256 hex, 64자).
--   같은 사람이 하루에 여러 번 와도 INSERT 는 그대로 받되,
--   집계는 DISTINCT visitor_hash 로 처리해 1명으로만 카운트한다.
--
--   user_id 는 로그인 유저면 채워지고, 비로그인이면 NULL.
--
--   RLS:
--     - INSERT  : 누구나 (anon + authenticated). 단 클라이언트가 visitor_hash 를
--                 자유롭게 만들 수 있으므로 카운트가 부풀려질 위험은 있음.
--                 → 실제 INSERT 는 서버 라우트(/api/visit) 가 service role 로 수행.
--                 정책은 방어적으로 INSERT 만 열어둔다.
--     - SELECT  : 정책 없음 → anon/authenticated 는 조회 불가 (개인 방문 기록 보호).
--                 service role 만 raw 데이터 접근 가능. UI 에서는 RPC 만 호출.
--
--   집계 RPC:
--     count_distinct_visitors_today()
--       SECURITY DEFINER 로 RLS 우회, anon/authenticated 에 EXECUTE 부여.
--       KST 자정 ~ 현재 사이의 DISTINCT visitor_hash 를 INTEGER 로 반환.
--
--   모든 객체는 IF NOT EXISTS / DROP+CREATE 로 idempotent.

-- ────────────────────────────────────────────────────────────
-- 1. visit_logs 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_hash TEXT        NOT NULL,
  visited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 오늘 방문자 집계 — 시간 범위 + DISTINCT visitor_hash 두 컬럼을 동시에 사용
CREATE INDEX IF NOT EXISTS visit_logs_visited_hash_idx
  ON public.visit_logs (visited_at DESC, visitor_hash);

-- 회원별 방문 추적용(향후 활용)
CREATE INDEX IF NOT EXISTS visit_logs_user_idx
  ON public.visit_logs (user_id, visited_at DESC)
  WHERE user_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. RLS — INSERT 만 열고 SELECT 는 차단 (서비스 키로만 조회 가능)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_logs insert any" ON public.visit_logs;
CREATE POLICY "visit_logs insert any"
  ON public.visit_logs FOR INSERT
  WITH CHECK (TRUE);

-- SELECT/UPDATE/DELETE 정책은 의도적으로 만들지 않음 → 모두 차단
-- (service role 은 RLS 를 우회하므로 영향 없음)

-- ────────────────────────────────────────────────────────────
-- 3. count_distinct_visitors_today() RPC
--
--   KST(Asia/Seoul) 자정 ~ 지금 사이의 visit_logs.visitor_hash DISTINCT COUNT.
--
--   timezone('Asia/Seoul', now()) → 현재 시각을 KST naive timestamp 로 변환
--   date_trunc('day', ...)         → KST 자정 (naive)
--   ... AT TIME ZONE 'Asia/Seoul'  → 그 KST 자정을 UTC timestamptz 로 (DB 저장 형식)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_distinct_visitors_today()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT visitor_hash)::INTEGER
    FROM public.visit_logs
   WHERE visited_at >=
         (date_trunc('day', timezone('Asia/Seoul', now()))
            AT TIME ZONE 'Asia/Seoul');
$$;

GRANT EXECUTE ON FUNCTION public.count_distinct_visitors_today() TO anon, authenticated;
