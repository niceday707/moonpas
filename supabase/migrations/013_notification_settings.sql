-- 013_notification_settings.sql
--
-- profiles 테이블에 알림 수신 설정(JSONB) 컬럼 추가.
--
--   /profile/settings 페이지에서 토글하는 4개 채널을 그대로 키로 사용한다.
--     onComment : 내 글에 댓글 알림
--     onReply   : 내 댓글에 답글 알림
--     onLike    : 내 글에 좋아요 알림
--     onNotice  : 새 공지사항 알림
--
--   기본값은 모두 true 로 두고, 알림 생성 시 (lib/notify.ts) 수신자의
--   notification_settings 를 조회해 꺼져 있으면 INSERT 하지 않는다.
--   row 가 없거나 컬럼이 NULL 이어도 기본값(true)이 되도록 앱에서도 폴백 처리.
--
--   본인 row UPDATE 만 허용 — RLS 정책은 007 마이그레이션의
--   "profiles update self" 가 그대로 적용되므로 별도 정책 추가 불필요.
--
--   모든 변경은 idempotent (IF NOT EXISTS / DROP+CREATE).

-- ────────────────────────────────────────────────────────────
-- 1. notification_settings 컬럼
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

-- 기존 row 중 NULL/누락 키가 있으면 기본값으로 보강 (idempotent merge)
UPDATE public.profiles
   SET notification_settings = jsonb_build_object(
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
-- 2. notifications 테이블 Realtime 게시
--
--   NotificationProvider 가 INSERT 이벤트를 구독해 새 알림을 즉시 반영한다.
--   PUBLICATION 에 추가하기만 하면 RLS 정책(본인 행만 SELECT) 이 그대로 적용되어
--   다른 사용자의 알림이 새어 나가지 않는다.
--
--   이미 게시되어 있다면 ALTER 가 에러를 내므로 DO 블록으로 가드.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END
$$;
