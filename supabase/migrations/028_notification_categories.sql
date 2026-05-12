-- 028_notification_categories.sql
--
-- profiles.notification_settings 에 게시판별 새 글 알림 키 5종 추가.
--
--   기존 키 유지 (하위호환):
--     onComment, onReply, onLike, onNotice
--
--   추가되는 키 (기본값 모두 true):
--     onCommunity     : 커뮤니티 새 글 (free / lost / market / debate / qa / guess_who 등)
--     onEta           : 문태 에타 새 글 (anonymous)
--     onChallenge     : 학생 챌린지 새 글 (challenge)
--     onAlumni        : 문태 교우 새 글 (alumni / alumni_news / senior)
--     onSchoolNotice  : 학교 알림 새 글 (notice) — 기존 onNotice 의 역할을 이어받음
--
--   모든 변경은 idempotent (IF NOT EXISTS / DROP+CREATE / merge).

-- ────────────────────────────────────────────────────────────
-- 1. 컬럼 DEFAULT 갱신 — 신규 가입자가 받을 기본값에 새 키 추가
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN notification_settings
  SET DEFAULT jsonb_build_object(
    'onComment',      true,
    'onReply',        true,
    'onLike',         true,
    'onNotice',       true,
    'onCommunity',    true,
    'onEta',          true,
    'onChallenge',    true,
    'onAlumni',       true,
    'onSchoolNotice', true
  );

-- ────────────────────────────────────────────────────────────
-- 2. 기존 row 의 누락 키 보강 (merge)
--    || 연산자는 오른쪽 우선 — 기존 값이 있으면 보존되고, 없는 키만 채워진다.
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
   SET notification_settings =
         jsonb_build_object(
           'onComment',      true,
           'onReply',        true,
           'onLike',         true,
           'onNotice',       true,
           'onCommunity',    true,
           'onEta',          true,
           'onChallenge',    true,
           'onAlumni',       true,
           'onSchoolNotice', true
         ) || COALESCE(notification_settings, '{}'::jsonb)
 WHERE notification_settings IS NULL
    OR NOT (notification_settings ? 'onCommunity')
    OR NOT (notification_settings ? 'onEta')
    OR NOT (notification_settings ? 'onChallenge')
    OR NOT (notification_settings ? 'onAlumni')
    OR NOT (notification_settings ? 'onSchoolNotice');
