-- ============================================================
-- 문태에타 게시 400 에러 진단 + 안전한 수정
-- 사용법:
--   1) [진단 1~4] 블록을 Supabase Dashboard → SQL Editor 에서 먼저 실행하여 결과 확인
--   2) 결과를 보고 [수정 A], [수정 B] 중 필요한 것만 골라 실행
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- [진단 1] posts 테이블 컬럼 / NOT NULL / 기본값 확인
-- ─────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- [진단 2] posts 테이블 CHECK 제약 (title 빈 문자열 금지 같은 게 있는지)
-- ─────────────────────────────────────────────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.posts'::regclass
  AND contype = 'c';

-- ─────────────────────────────────────────────────────────────
-- [진단 3] posts 테이블 RLS 정책 — INSERT 정책 존재 여부 / 조건 확인
-- ─────────────────────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'posts';

-- ─────────────────────────────────────────────────────────────
-- [진단 4] 현재 board_type CHECK 가 'anonymous' 를 포함하는지
-- (003 마이그레이션이 적용 안 됐다면 'anonymous' 가 빠져있어서 INSERT 실패함)
-- ─────────────────────────────────────────────────────────────
SELECT
  pg_get_constraintdef(oid) AS board_type_check
FROM pg_constraint
WHERE conrelid = 'public.posts'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%board_type%';

-- ============================================================
-- [수정 A] title CHECK 제약(예: length(title) > 0) 이 보이면 제거
--   → 진단 2에서 'length(title)' 또는 'char_length(title)' 가 포함된 CHECK 가 보일 때만 실행
--   → 안전하게 모든 title 관련 CHECK 제약을 떼어낸다
-- ============================================================
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%title%'
  LOOP
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- ============================================================
-- [수정 B] posts INSERT RLS 정책이 비어있거나 잘못된 경우 표준 정책 재설치
--   → 진단 3에서 INSERT 정책이 안 보이거나 with_check 가 이상하면 실행
--   → 인증된 사용자가 본인 author_id 로 글 작성 가능하도록 설정
-- ============================================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts read all" ON posts;
CREATE POLICY "posts read all"
  ON posts FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "posts insert own" ON posts;
CREATE POLICY "posts insert own"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts update own" ON posts;
CREATE POLICY "posts update own"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts delete own" ON posts;
CREATE POLICY "posts delete own"
  ON posts FOR DELETE
  USING (auth.uid() = author_id);
