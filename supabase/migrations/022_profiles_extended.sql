-- 022_profiles_extended.sql
--
-- profiles 테이블에 프로필 카드 기능용 컬럼 추가.
--   · bio          : 한줄 소개 (항상 공개)
--   · grade        : 학년 1/2/3 (공개 여부는 show_grade)
--   · birth_month  : 생일 월 1~12 (항상 비공개 — 오늘의 생일 이벤트용)
--   · birth_day    : 생일 일 1~31
--   · show_grade   : 학년 공개 여부
--   · show_stats   : 활동통계(쓴 글/댓글/받은 좋아요) 공개 여부
--
-- ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS 패턴으로 idempotent.
-- 기존 데이터에는 영향 없음 (모두 nullable 또는 default false).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grade        SMALLINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_month  SMALLINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_day    SMALLINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_grade   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_stats   BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 값 범위 CHECK 제약 ────────────────────────────────────────
-- 클라이언트가 우회해도 DB 단에서 비정상 값 차단.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_len_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len_chk
  CHECK (bio IS NULL OR char_length(bio) <= 30);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_grade_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_grade_chk
  CHECK (grade IS NULL OR grade BETWEEN 1 AND 3);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_month_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_month_chk
  CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_day_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_day_chk
  CHECK (birth_day IS NULL OR birth_day BETWEEN 1 AND 31);

-- 월/일 둘 다 입력되거나 둘 다 NULL 이어야 한다 — "월만 있고 일 없음" 같은 어긋남 방지.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_pair_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_pair_chk
  CHECK (
    (birth_month IS NULL AND birth_day IS NULL)
    OR (birth_month IS NOT NULL AND birth_day IS NOT NULL)
  );

-- ── "오늘의 생일" 빠른 조회용 인덱스 ────────────────────────
-- 월/일 조합으로 자주 필터링될 컬럼이므로 부분 인덱스로 NULL 행 제외하여 비용 절감.
CREATE INDEX IF NOT EXISTS profiles_birthday_idx
  ON public.profiles (birth_month, birth_day)
  WHERE birth_month IS NOT NULL AND birth_day IS NOT NULL;

-- 참고: bio/show_grade/show_stats 는 RLS 정책 측면에서 기존 007 마이그레이션
-- ("profiles read all" + "profiles update self") 가 그대로 적용되어 별도 정책 불필요.
-- 단, birth_month/birth_day 는 항상 비공개 정책이므로 SELECT 단계에서 클라이언트가
-- 절대 select 하지 말 것 — 코드 단에서만 노출 컬럼을 통제한다.
