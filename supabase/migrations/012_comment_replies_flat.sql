-- 012_comment_replies_flat.sql
--
-- 인스타그램 스타일 대댓글(답글의 답글) 지원.
--
--   기존 comments.parent_id 는 그대로 유지하되, 답글의 답글을 달 때도
--   parent_id 는 항상 "최상위 댓글의 id" 를 가리키도록 앱 레이어에서 강제한다.
--   (DB 트리 구조는 1단계 깊이 → flat 한 표시가 가능)
--
--   누구를 향한 답글인지 별도로 표시하기 위해 mention_user_id 컬럼을 추가.
--   본문의 "@닉네임" 텍스트와 함께 구조화된 포인터로 사용된다.
--
--   익명 게시판은 author 마스킹이 필요하므로 mention_user_id 도 항상 NULL 로 저장.
--
--   모든 변경은 idempotent (IF NOT EXISTS / DROP+CREATE).

-- ────────────────────────────────────────────────────────────
-- 1. mention_user_id 컬럼 추가
--
--   FK 는 public.profiles(id) 를 향한다.
--   - profiles.id 는 auth.users.id 와 동일한 UUID (1:1 매핑)
--   - PostgREST 가 comments → profiles 임베딩 (mention_user 조회) 을
--     자동 해석할 수 있도록 정확한 FK 지정이 필요
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS mention_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 멘션받은 사용자별 답글 모음 조회를 위한 인덱스 (옵션 — 향후 알림함 등에서 활용)
CREATE INDEX IF NOT EXISTS comments_mention_user_idx
  ON public.comments(mention_user_id)
  WHERE mention_user_id IS NOT NULL;
