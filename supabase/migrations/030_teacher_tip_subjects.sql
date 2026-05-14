-- 030_teacher_tip_subjects.sql
--
-- 쌤 꿀팁 공유(board_type='teacher_tip') 게시판 — subject_tag 컬럼을
-- 12 개 교과 + etc 까지 허용하도록 CHECK 제약 확장.
--
-- 023 에서 study 전용 6 개 (korean/english/math/social/science/etc) 만 허용 중이라
-- 신규 6 개(info/chinese/music/art/pe/career)가 막힘. study 와 teacher_tip 이
-- subject_tag 컬럼을 공유하므로 두 보드의 교과 합집합으로 화이트리스트 갱신.
--
-- 멱등 패턴 (DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT) 사용 — 재실행 안전.

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_subject_tag_chk;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_subject_tag_chk
  CHECK (
    subject_tag IS NULL
    OR subject_tag IN (
      -- study 6 개
      'korean', 'english', 'math', 'social', 'science', 'etc',
      -- teacher_tip 신규 6 개
      'info', 'chinese', 'music', 'art', 'pe', 'career'
    )
  );

-- teacher_tip 게시판 필터 조회용 부분 인덱스 — study 와 동일 패턴.
CREATE INDEX IF NOT EXISTS posts_teacher_tip_subject_idx
  ON public.posts (subject_tag)
  WHERE board_type = 'teacher_tip' AND subject_tag IS NOT NULL;
