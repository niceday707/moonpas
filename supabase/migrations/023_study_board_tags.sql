-- 023_study_board_tags.sql
--
-- 학습게시판(board_type='study') 전용 태그 컬럼 3종.
--   · grade         : 학년 ('all' / '1' / '2' / '3' / NULL) — 'all' = 학년 무관 글 (예: 수능 일반 질문)
--   · subject_tag   : 교과 ('korean' / 'english' / 'math' / 'social' / 'science' / 'etc' / NULL)
--   · post_category : 글 종류 ('question' / 'tip' / 'share' / NULL)
--
-- ⚠️ 사용자 요청 파일명은 015 였으나 이미 015_school_notices.sql 가 존재하여
--    충돌을 피하기 위해 023 으로 발급. 마이그레이션 적용 순서/내용엔 영향 없음.
--
-- 멱등 패턴 (ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS) 사용 — 재실행 안전.
-- 기존 'study' 게시글 7 개는 모든 태그가 NULL 로 유지되며, "전체" 필터에서 그대로 노출된다.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS grade         VARCHAR(10);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS subject_tag   VARCHAR(10);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_category VARCHAR(10);

-- ── 값 화이트리스트 CHECK ────────────────────────────────────
-- 코드와 DB 양쪽에서 오타·우회 차단. NULL 은 항상 허용 (legacy 글 + 태그 미선택).

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_grade_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_grade_chk
  CHECK (grade IS NULL OR grade IN ('all', '1', '2', '3'));

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_subject_tag_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_subject_tag_chk
  CHECK (
    subject_tag IS NULL
    OR subject_tag IN ('korean', 'english', 'math', 'social', 'science', 'etc')
  );

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_category_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_category_chk
  CHECK (
    post_category IS NULL
    OR post_category IN ('question', 'tip', 'share')
  );

-- ── 학습게시판 필터 조회용 부분 인덱스 ──────────────────────
-- 다른 board_type 의 카운트가 압도적으로 많으므로 study 만 인덱싱해 비용 절감.
CREATE INDEX IF NOT EXISTS posts_study_grade_idx
  ON public.posts (grade)
  WHERE board_type = 'study' AND grade IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_study_subject_idx
  ON public.posts (subject_tag)
  WHERE board_type = 'study' AND subject_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_study_category_idx
  ON public.posts (post_category)
  WHERE board_type = 'study' AND post_category IS NOT NULL;

-- 참고: 새 컬럼들은 RLS 정책에 영향이 없다. 기존 posts 정책이 모든 컬럼에 그대로 적용됨.
