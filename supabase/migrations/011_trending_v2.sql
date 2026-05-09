-- 011_trending_v2.sql
--
-- 실시간 검색어 v2 — 검색 로그 + 게시글 제목(조회수 가중) 합산.
--
--   기존 009 의 search_logs / get_trending_keywords RPC 는 그대로 유지.
--   새 RPC 는 24시간 윈도우 + 게시글 제목 토큰 + view_count 가중을 반영하여
--   search_logs 가 부족할 때도 의미 있는 키워드 랭킹을 만든다.
--
--   윈도우:
--     · current  = now() - 24h ~ now()
--     · previous = now() - 48h ~ now() - 24h     (순위 변동 비교용)
--
--   가중치(현재):
--     · 검색 1건             → +1.0
--     · 게시글 제목 토큰 1건 → +0.3 * ln(view_count + 2)   (조회수 0이면 ~0.21, 100이면 ~1.4)
--
--   토큰화는 Postgres 정규식으로 한글/영문/숫자 단어만 추출 (길이 2~20).
--   완벽한 형태소 분석은 아니지만 Korean stop-word 가 1글자 위주라 실전엔 충분.

-- ────────────────────────────────────────────────────────────
-- 0. 게시글 created_at 인덱스 (없으면 추가) — RPC 의 시간창 필터를 가속
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_created_at_idx
  ON public.posts(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 1. get_trending_keywords_v2()
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trending_keywords_v2()
RETURNS TABLE (
  rank BIGINT,
  keyword TEXT,
  count NUMERIC,
  prev_count NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- 검색 로그 — 현재 24시간
  search_curr AS (
    SELECT LOWER(TRIM(keyword)) AS kw,
           COUNT(*)::NUMERIC AS w
    FROM public.search_logs
    WHERE created_at > now() - INTERVAL '24 hours'
      AND length(TRIM(keyword)) BETWEEN 2 AND 60
    GROUP BY LOWER(TRIM(keyword))
  ),
  -- 검색 로그 — 직전 24시간 (24h ~ 48h 전)
  search_prev AS (
    SELECT LOWER(TRIM(keyword)) AS kw,
           COUNT(*)::NUMERIC AS w
    FROM public.search_logs
    WHERE created_at > now() - INTERVAL '48 hours'
      AND created_at <= now() - INTERVAL '24 hours'
      AND length(TRIM(keyword)) BETWEEN 2 AND 60
    GROUP BY LOWER(TRIM(keyword))
  ),
  -- 게시글 제목 토큰 — 현재 24시간, 조회수 가중
  posts_curr AS (
    SELECT LOWER(rm.arr[1]) AS kw,
           SUM(0.3 * LN(GREATEST(p.view_count, 0) + 2)) AS w
    FROM public.posts p
    CROSS JOIN LATERAL regexp_matches(
      COALESCE(p.title, ''),
      '[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+',
      'g'
    ) AS rm(arr)
    WHERE p.created_at > now() - INTERVAL '24 hours'
      AND length(rm.arr[1]) BETWEEN 2 AND 20
    GROUP BY LOWER(rm.arr[1])
  ),
  -- 게시글 제목 토큰 — 직전 24시간
  posts_prev AS (
    SELECT LOWER(rm.arr[1]) AS kw,
           SUM(0.3 * LN(GREATEST(p.view_count, 0) + 2)) AS w
    FROM public.posts p
    CROSS JOIN LATERAL regexp_matches(
      COALESCE(p.title, ''),
      '[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+',
      'g'
    ) AS rm(arr)
    WHERE p.created_at > now() - INTERVAL '48 hours'
      AND p.created_at <= now() - INTERVAL '24 hours'
      AND length(rm.arr[1]) BETWEEN 2 AND 20
    GROUP BY LOWER(rm.arr[1])
  ),
  -- 두 소스 합산
  combined_curr AS (
    SELECT kw, SUM(w) AS w FROM (
      SELECT kw, w FROM search_curr
      UNION ALL
      SELECT kw, w FROM posts_curr
    ) AS u
    -- 너무 일반적인 단어는 제외 (필요 시 늘릴 것)
    WHERE kw NOT IN (
      'the','and','for','that','with','this','have','http','https','www',
      '있는','있음','없는','없음','그리고','그러나','그런데','하지만','그래서',
      '이거','저거','그거','때문','정도','진짜','너무','우리','오늘','내일','어제'
    )
    GROUP BY kw
  ),
  combined_prev AS (
    SELECT kw, SUM(w) AS w FROM (
      SELECT kw, w FROM search_prev
      UNION ALL
      SELECT kw, w FROM posts_prev
    ) AS u
    GROUP BY kw
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.w DESC, c.kw) AS rank,
    c.kw AS keyword,
    ROUND(c.w, 2) AS count,
    ROUND(COALESCE(p.w, 0), 2) AS prev_count
  FROM combined_curr c
  LEFT JOIN combined_prev p ON p.kw = c.kw
  WHERE c.w > 0
  ORDER BY c.w DESC, c.kw
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_keywords_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_keywords_v2() TO anon;
