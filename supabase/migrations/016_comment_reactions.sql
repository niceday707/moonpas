-- 댓글 좋아요/싫어요 리액션 테이블
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID      NOT NULL REFERENCES public.comments(id)  ON DELETE CASCADE,
  user_id    UUID      NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  reaction   TEXT      NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT comment_reactions_unique UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_reactions_comment_idx ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS comment_reactions_user_idx    ON public.comment_reactions(user_id);

-- RLS 활성화
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 조회 가능 (익명 게시판 포함 — 누가 눌렀는지는 UI 에서 숨김)
CREATE POLICY "comment_reactions_select"
  ON public.comment_reactions FOR SELECT
  USING (true);

-- 본인만 INSERT
CREATE POLICY "comment_reactions_insert"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 UPDATE (like ↔ dislike 변경)
CREATE POLICY "comment_reactions_update"
  ON public.comment_reactions FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인만 DELETE (리액션 취소)
CREATE POLICY "comment_reactions_delete"
  ON public.comment_reactions FOR DELETE
  USING (auth.uid() = user_id);
