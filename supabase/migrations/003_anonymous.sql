-- ============================================================
-- 문파스(MoonPas) 문태 에타 — 익명 게시판 스키마
--   · posts.board_type CHECK 에 'anonymous' 추가
--   · comments.parent_id 대댓글 지원 컬럼 추가
-- ============================================================

-- ── posts.board_type CHECK 제약 갱신 ────────────────────────
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%board_type%'
  LOOP
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE posts
  ADD CONSTRAINT posts_board_type_check CHECK (
    board_type IN (
      'free', 'notice', 'lost', 'market', 'debate', 'challenge',
      'college', 'curriculum', 'council', 'qa',
      'youtube', 'resources', 'study', 'news',
      'alumni', 'senior',
      'event_member', 'event_find', 'event_praise', 'event_study', 'event_quiz',
      'anonymous'
    )
  );

-- ── comments.parent_id — 대댓글 1단계 지원 ────────────────────
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id);
