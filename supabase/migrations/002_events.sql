-- ============================================================
-- 문파스(MoonPas) 문태 이벤트 — 5개 게시판 스키마
--   · event_member  회원 참여방 (정회원 미션)
--   · event_find    찹쌀 꽈배기 (숨은 이모지 찾기)
--   · event_praise  칭찬합시다  (칭찬 카드)
--   · event_study   공부 인증  (계획+인증+스트릭)
--   · event_quiz    오늘의 퀴즈
-- ============================================================

-- ── posts.board_type CHECK 제약 갱신 ────────────────────────
-- 기존 제약 이름은 환경마다 다를 수 있으므로, 새 제약을 추가하기 전에
-- pg_constraint 에서 board_type 관련 CHECK 를 모두 떼어낸다.
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
      'event_member', 'event_find', 'event_praise', 'event_study', 'event_quiz'
    )
  );

-- ── posts 보조 컬럼 ─────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mission_type   TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quiz_answer    TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS streak_count   INTEGER NOT NULL DEFAULT 0;

-- ── profiles.badge (정회원/꾸준왕 등) ────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge TEXT;

-- ── 1. user_missions (정회원 미션) ──────────────────────────
CREATE TABLE IF NOT EXISTS user_missions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_key  TEXT         NOT NULL,
  completed    BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mission_key)
);

CREATE INDEX IF NOT EXISTS user_missions_user_idx ON user_missions(user_id);

ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_missions read all" ON user_missions;
CREATE POLICY "user_missions read all"
  ON user_missions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "user_missions write own" ON user_missions;
CREATE POLICY "user_missions write own"
  ON user_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_missions update own" ON user_missions;
CREATE POLICY "user_missions update own"
  ON user_missions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_missions delete own" ON user_missions;
CREATE POLICY "user_missions delete own"
  ON user_missions FOR DELETE
  USING (auth.uid() = user_id);

-- ── 2. praise_cards (칭찬합시다) ────────────────────────────
CREATE TABLE IF NOT EXISTS praise_cards (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_nickname TEXT         NOT NULL,
  message           TEXT         NOT NULL,
  card_theme        TEXT         NOT NULL DEFAULT 'spring',
  is_anonymous      BOOLEAN      NOT NULL DEFAULT FALSE,
  like_count        INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS praise_cards_recv_idx    ON praise_cards(receiver_nickname);
CREATE INDEX IF NOT EXISTS praise_cards_created_idx ON praise_cards(created_at DESC);

ALTER TABLE praise_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "praise_cards read all" ON praise_cards;
CREATE POLICY "praise_cards read all"
  ON praise_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "praise_cards insert auth" ON praise_cards;
CREATE POLICY "praise_cards insert auth"
  ON praise_cards FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 좋아요 카운트는 모두가 +1 할 수 있게 (자체 throttling 은 클라에서)
DROP POLICY IF EXISTS "praise_cards update like" ON praise_cards;
CREATE POLICY "praise_cards update like"
  ON praise_cards FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "praise_cards delete own" ON praise_cards;
CREATE POLICY "praise_cards delete own"
  ON praise_cards FOR DELETE
  USING (auth.uid() = sender_id);

-- ── 3. study_plans (공부 계획서 + 인증) ─────────────────────
CREATE TABLE IF NOT EXISTS study_plans (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date        DATE         NOT NULL,
  subjects         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  plan_text        TEXT         NOT NULL,
  proof_image_url  TEXT,
  is_completed     BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  streak_count     INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS study_plans_user_idx ON study_plans(user_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS study_plans_date_idx ON study_plans(plan_date DESC);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_plans read all" ON study_plans;
CREATE POLICY "study_plans read all"
  ON study_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "study_plans insert own" ON study_plans;
CREATE POLICY "study_plans insert own"
  ON study_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_plans update own" ON study_plans;
CREATE POLICY "study_plans update own"
  ON study_plans FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_plans delete own" ON study_plans;
CREATE POLICY "study_plans delete own"
  ON study_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. daily_quiz (관리자가 등록) ───────────────────────────
CREATE TABLE IF NOT EXISTS daily_quiz (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  question        TEXT         NOT NULL,
  options         JSONB        NOT NULL,            -- ["보기1","보기2","보기3","보기4"]
  correct_answer  TEXT         NOT NULL,            -- 정답 보기 텍스트와 동일
  hint            TEXT,
  quiz_date       DATE         NOT NULL UNIQUE,
  created_by      UUID         REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_quiz_date_idx ON daily_quiz(quiz_date DESC);

ALTER TABLE daily_quiz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_quiz read all" ON daily_quiz;
CREATE POLICY "daily_quiz read all"
  ON daily_quiz FOR SELECT USING (true);

-- 작성/수정/삭제는 admin/teacher 만. profiles.role 확인.
DROP POLICY IF EXISTS "daily_quiz write staff" ON daily_quiz;
CREATE POLICY "daily_quiz write staff"
  ON daily_quiz FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "daily_quiz update staff" ON daily_quiz;
CREATE POLICY "daily_quiz update staff"
  ON daily_quiz FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "daily_quiz delete staff" ON daily_quiz;
CREATE POLICY "daily_quiz delete staff"
  ON daily_quiz FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'teacher')
    )
  );

-- ── 5. quiz_answers (사용자 응답) ───────────────────────────
CREATE TABLE IF NOT EXISTS quiz_answers (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id          UUID         NOT NULL REFERENCES daily_quiz(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_answer  TEXT         NOT NULL,
  is_correct       BOOLEAN      NOT NULL,
  answered_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(quiz_id, user_id)
);

CREATE INDEX IF NOT EXISTS quiz_answers_quiz_idx ON quiz_answers(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_answers_user_idx ON quiz_answers(user_id);

ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_answers read all" ON quiz_answers;
CREATE POLICY "quiz_answers read all"
  ON quiz_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "quiz_answers insert own" ON quiz_answers;
CREATE POLICY "quiz_answers insert own"
  ON quiz_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_answers update own" ON quiz_answers;
CREATE POLICY "quiz_answers update own"
  ON quiz_answers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_answers delete own" ON quiz_answers;
CREATE POLICY "quiz_answers delete own"
  ON quiz_answers FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Storage 버킷 (수동 생성 권장)
--   · avatars        — 프로필 사진 (이미 생성됨)
--   · study-proofs   — 공부 인증 사진. public read, 본인만 쓰기.
-- ============================================================
