-- 017_gallery_source.sql
--
-- school_notices 테이블의 source CHECK 제약에 'gallery' 추가.
-- 행사갤러리: mi=113103, bbsId=113103
--   상세 페이지는 학교 홈페이지 로그인이 필요하므로 제목·날짜·원본 URL만 저장.

ALTER TABLE public.school_notices
  DROP CONSTRAINT IF EXISTS school_notices_source_check;

ALTER TABLE public.school_notices
  ADD CONSTRAINT school_notices_source_check
  CHECK (source IN ('school', 'news', 'letter', 'gallery'));
