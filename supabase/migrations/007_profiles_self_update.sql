-- 007_profiles_self_update.sql
--
-- 본인 profiles row 의 SELECT / UPDATE 가 RLS 로 차단되지 않도록 보장.
-- 닉네임 변경 페이지(/profile/setup) 가 profiles.nickname 을 UPDATE 할 때
-- "0행 영향" 으로 실패하던 문제를 방지하기 위한 idempotent 정책 보강.
--
-- 기존 정책이 있어도 안전하게 재정의되도록 DROP IF EXISTS + CREATE 패턴 사용.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 모두에게 SELECT 허용 (글쓴이 닉네임 등 조회용) ─────────
DROP POLICY IF EXISTS "profiles read all" ON public.profiles;
CREATE POLICY "profiles read all"
  ON public.profiles
  FOR SELECT
  USING (TRUE);

-- ── 본인 row INSERT (최초 가입 시 onConflict upsert) ─────
DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE POLICY "profiles insert self"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 본인 row UPDATE (닉네임/아바타 변경) ──────────────────
DROP POLICY IF EXISTS "profiles update self" ON public.profiles;
CREATE POLICY "profiles update self"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- nickname 컬럼이 unique 가 아니라면 case-insensitive unique 인덱스를 추가하고 싶을 수 있다.
-- 다만 기존 데이터가 충돌할 수 있으므로 여기서는 추가하지 않는다 (앱 단에서 ILIKE 검사로 가드).
