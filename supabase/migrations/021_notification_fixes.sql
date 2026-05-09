-- 021_notification_fixes.sql
--
-- 알림 시스템 완전 수정 (idempotent).
--
-- 문제: 018 마이그레이션이 Supabase 에 미적용 시 actor_id 컬럼 부재 →
--       client 에서 INSERT 할 때 "column actor_id does not exist" 오류 → silent fail.
--
-- 변경 내용:
--   1) actor_id 컬럼 확실히 추가 (참조: profiles.id — GET 조인 유지)
--   2) INSERT RLS 정책을 auth.uid() IS NOT NULL 로 교체 (더 표준적인 표현)
--   3) 인덱스 보강
--   4) notification_settings 컬럼 재확인 (013 미적용 환경 대비)
--   5) Realtime publication 재확인

-- ────────────────────────────────────────────────────────────
-- 1. notifications 테이블 (008 미적용 환경 대비)
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

-- ────────────────────────────────────────────────────────────
-- 2. actor_id 컬럼 (018 미적용 환경 대비)
--    profiles.id 를 참조 — GET 쿼리의 actor:profiles!actor_id 조인에 필요
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. 인덱스
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_actor_idx
  ON public.notifications(actor_id);

-- ────────────────────────────────────────────────────────────
-- 4. RLS — 알림 INSERT 는 이제 서버 API (/api/notifications/create) 에서
--    service_role key 로 처리 → RLS 자체는 우회됨.
--    하지만 클라이언트 직접 호출 대비 정책도 올바르게 유지.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회
DROP POLICY IF EXISTS "notifications select self" ON public.notifications;
CREATE POLICY "notifications select self"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 인증된 사용자는 누구에게나 알림 INSERT 가능
-- (댓글 작성자 → 글 작성자 알림 INSERT 구조)
DROP POLICY IF EXISTS "notifications insert auth" ON public.notifications;
CREATE POLICY "notifications insert auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 본인 알림 읽음 처리(UPDATE) 만 허용
DROP POLICY IF EXISTS "notifications update self" ON public.notifications;
CREATE POLICY "notifications update self"
  ON public.notifications FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. profiles.notification_settings (013 미적용 환경 대비)
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
