-- 009_search_logs_and_trending.sql
--
-- 실시간 검색어 인프라.
--   1) public.search_logs                — 모든 검색 실행 로그 (keyword, user_id, created_at)
--   2) public.get_trending_keywords()    — 최근 6시간 vs 직전 6시간 비교한 TOP 10 키워드 RPC
--
-- 모든 객체는 IF NOT EXISTS / DROP+CREATE 로 idempotent.
-- 008 의 mentions / notifications 와 동일한 RLS 정책 패턴.

-- ────────────────────────────────────────────────────────────
-- 1. search_logs 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 집계 RPC 가 created_at 으로 시간창 필터 + LOWER(keyword) 그룹핑하므로
-- (created_at, keyword) 복합 인덱스가 두 작업 모두를 커버.
CREATE INDEX IF NOT EXISTS search_logs_keyword_time_idx
  ON public.search_logs(created_at DESC, keyword);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- INSERT 는 로그인 유저 누구나 가능.
DROP POLICY IF EXISTS "search_logs insert auth" ON public.search_logs;
CREATE POLICY "search_logs insert auth"
  ON public.search_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- SELECT 는 일반 클라이언트에서 막고, 집계는 SECURITY DEFINER 함수로만 노출.
-- (정책을 만들지 않으면 RLS 가 켜진 테이블에 대해 SELECT 는 거부됨.)

-- ────────────────────────────────────────────────────────────
-- 2. get_trending_keywords RPC
--
--   최근 6시간(current) 검색 횟수 기준 상위 10개 키워드를 반환.
--   prev_count 는 직전 6시간(12h ~ 6h 전) 카운트로,
--   클라이언트가 trend(up/down/same/new) 를 계산할 수 있게 함께 내려준다.
--   동률이면 keyword 알파벳순(한글은 유니코드 순)으로 안정 정렬.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trending_keywords()
RETURNS TABLE (
  rank BIGINT,
  keyword TEXT,
  count BIGINT,
  prev_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_period AS (
    SELECT LOWER(keyword) AS kw, COUNT(*) AS cnt
    FROM public.search_logs
    WHERE created_at > now() - INTERVAL '6 hours'
    GROUP BY LOWER(keyword)
  ),
  previous_period AS (
    SELECT LOWER(keyword) AS kw, COUNT(*) AS cnt
    FROM public.search_logs
    WHERE created_at > now() - INTERVAL '12 hours'
      AND created_at <= now() - INTERVAL '6 hours'
    GROUP BY LOWER(keyword)
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.cnt DESC, c.kw) AS rank,
    c.kw AS keyword,
    c.cnt AS count,
    COALESCE(p.cnt, 0) AS prev_count
  FROM current_period c
  LEFT JOIN previous_period p ON p.kw = c.kw
  ORDER BY c.cnt DESC, c.kw
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_keywords() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_keywords() TO anon;
