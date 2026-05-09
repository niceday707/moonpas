-- 015_school_notices.sql
--
-- 문태고 홈페이지 공지 게시판 3종 크롤링 결과 저장.
--
--   대상:
--     · 학교공지 : mi=113099, bbsId=113099  → source='school'
--     · 문태소식 : mi=113100, bbsId=113100  → source='news'
--     · 가정통신문: mi=113111, bbsId=113111  → source='letter'
--
--   본문은 가져오지 않고 (제목·날짜·원문 링크) 만 저장한다.
--   ntt_sn (원본 글번호) 을 (source, ntt_sn) 복합 UNIQUE 로 두어
--   동일 게시판의 같은 글이 중복되지 않게 한다 — 게시판마다 nttSn 이
--   별도 시퀀스를 갖기 때문에 source 까지 묶어야 안전.
--
--   RLS:
--     · SELECT  : 누구나 (anon + authenticated)
--     · INSERT/UPDATE/DELETE : 정책 없음 → service role 만 가능
--                  /api/school-notices 라우트가 서비스 키로 upsert.
--
--   모든 변경은 idempotent (IF NOT EXISTS / DROP+CREATE).

-- ────────────────────────────────────────────────────────────
-- 1. school_notices 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_notices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT        NOT NULL CHECK (source IN ('school', 'news', 'letter')),
  title         TEXT        NOT NULL,
  date          DATE        NOT NULL,
  original_url  TEXT        NOT NULL,
  ntt_sn        TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_notices_source_ntt_sn_uniq UNIQUE (source, ntt_sn)
);

-- 게시판 + 최신 정렬 — 페이지 로드 시 source 별 최신 N개 조회용
CREATE INDEX IF NOT EXISTS school_notices_source_date_idx
  ON public.school_notices (source, date DESC, created_at DESC);

-- 대시보드 합산 정렬 — source 무관 전체 최신
CREATE INDEX IF NOT EXISTS school_notices_date_idx
  ON public.school_notices (date DESC, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 2. RLS — SELECT 만 공개, 쓰기는 service role 전용
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.school_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_notices select all" ON public.school_notices;
CREATE POLICY "school_notices select all"
  ON public.school_notices FOR SELECT
  USING (TRUE);

-- INSERT/UPDATE/DELETE 정책은 의도적으로 비워둠 → anon/authenticated 차단.
-- service role 은 RLS 우회.
