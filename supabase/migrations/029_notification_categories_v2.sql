-- 029_notification_categories_v2.sql
--
-- 알림 카테고리 재편 (028 후속).
--
--   변경 내용:
--     · 028 에서 추가했던 onEta / onChallenge / onSchoolNotice 키는 더 이상 사용하지 않음.
--       (JSONB 컬럼이라 키가 row 에 그대로 남아도 무해 — 클라이언트가 무시.)
--     · 새 키 추가 (기본값 true):
--         onEvent   — 문태 이벤트 새 글 알림
--         onStudent — 재학생 게시판 새 글 알림
--     · DEFAULT 도 새 8개 키 기준으로 갱신.
--
--   최종 사용 키 (8개):
--     onComment, onReply, onLike, onNotice (레거시 유지),
--     onCommunity, onEvent, onStudent, onAlumni
--
--   모든 변경은 idempotent.

-- ────────────────────────────────────────────────────────────
-- 1. 컬럼 DEFAULT 를 신규 8개 키로 교체
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN notification_settings
  SET DEFAULT jsonb_build_object(
    'onComment',   true,
    'onReply',     true,
    'onLike',      true,
    'onNotice',    true,
    'onCommunity', true,
    'onEvent',     true,
    'onStudent',   true,
    'onAlumni',    true
  );

-- ────────────────────────────────────────────────────────────
-- 2. 기존 row 에 새 키(onEvent, onStudent) 보강
--    || 은 오른쪽 우선이므로 사용자가 이미 토글한 값(onCommunity / onAlumni 등)은 그대로 보존된다.
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
   SET notification_settings =
         jsonb_build_object(
           'onComment',   true,
           'onReply',     true,
           'onLike',      true,
           'onNotice',    true,
           'onCommunity', true,
           'onEvent',     true,
           'onStudent',   true,
           'onAlumni',    true
         ) || COALESCE(notification_settings, '{}'::jsonb)
 WHERE notification_settings IS NULL
    OR NOT (notification_settings ? 'onEvent')
    OR NOT (notification_settings ? 'onStudent');
