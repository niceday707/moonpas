-- 018_notifications_actor_and_fix.sql
--
-- 알림 시스템 전체 보강 (idempotent).
--
--   1) notifications.actor_id 컬럼 추가
--      — 알림을 발생시킨 사용자 참조. 나중에 아바타 표시 등에 활용.
--   2) notifications 테이블 + RLS 정책 재확인
--      — 008 마이그레이션이 Supabase 에 미적용된 환경에서도 안전하게 동작.
--   3) profiles.notification_settings 컬럼 재확인
--      — 013 마이그레이션이 미적용된 환경 대비.
--   4) supabase_realtime publication 에 notifications 추가 재확인
--      — 013 마이그레이션이 미적용된 환경 대비.
--   5) 인덱스 보강

-- ────────────────────────────────────────────────────────────
-- 1. notifications 테이블 (008 미적용 환경 대비 재생성)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'mention',
  message    TEXT NOT NULL,
  post_id    UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. actor_id 컬럼 — 알림 발신자 (없으면 추가, 이미 있으면 무시)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_actor_idx
  ON public.notifications(actor_id);

-- ────────────────────────────────────────────────────────────
-- 4. RLS 정책
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회
DROP POLICY IF EXISTS "notifications select self" ON public.notifications;
CREATE POLICY "notifications select self"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 인증된 사용자라면 누구에게나 알림 INSERT 가능
-- (댓글 작성자가 글 작성자 알림을 대신 INSERT 하는 구조)
DROP POLICY IF EXISTS "notifications insert auth" ON public.notifications;
CREATE POLICY "notifications insert auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 본인 알림 읽음 처리(UPDATE) 만 허용
DROP POLICY IF EXISTS "notifications update self" ON public.notifications;
CREATE POLICY "notifications update self"
  ON public.notifications FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. profiles.notification_settings 컬럼 (013 미적용 환경 대비)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB
    NOT NULL
    DEFAULT jsonb_build_object(
      'onComment', true,
      'onReply',   true,
      'onLike',    true,
      'onNotice',  true
    );

-- 기존 row 중 누락 키 보강 (merge)
UPDATE public.profiles
   SET notification_settings =
         jsonb_build_object(
           'onComment', true,
           'onReply',   true,
           'onLike',    true,
           'onNotice',  true
         ) || COALESCE(notification_settings, '{}'::jsonb)
 WHERE notification_settings IS NULL
    OR NOT (notification_settings ? 'onComment')
    OR NOT (notification_settings ? 'onReply')
    OR NOT (notification_settings ? 'onLike')
    OR NOT (notification_settings ? 'onNotice');

-- ────────────────────────────────────────────────────────────
-- 6. Realtime publication (013 미적용 환경 대비)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname    = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename  = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END
$$;
